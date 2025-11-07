import {
  Address,
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { DeployWalletRequest, RegisterPublicKeyRequest } from '../types';
import { getArbitrumChain } from '../utils/chain';
import { keccak256, toBytes } from 'viem/utils';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getPublicKey } from '@noble/secp256k1';

const execAsync = promisify(exec);

const confidentialERC20Abi = parseAbi([
  'function register_user_pk(bytes pk)',
]);


// --- Internal helpers ---
function getDeploymentWallet() {
  const privateKey = process.env.DEFAULT_WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error('DEFAULT_WALLET_PRIVATE_KEY not configured');

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chain = getArbitrumChain();
  const rpcUrl = process.env.RPC_URL || process.env.ARBITRUM_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  return { walletClient, publicClient, account };
}

// --- Main deployment via CLI ---
export interface DeployUserWalletResponse {
  walletAddress: Address;
  userPrivateKey: `0x${string}`;
  userPublicKey: {
    x: string;
    y: string;
  };
  ownerAddress: Address;
}

export async function deployUserWallet(params: DeployWalletRequest): Promise<DeployUserWalletResponse> {
  const privateKey = process.env.DEFAULT_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEFAULT_WALLET_PRIVATE_KEY not configured');
  }

  const confErc20 = process.env.CONFIDENTIAL_ERC20 as Address;
  if (!confErc20) {
    throw new Error('CONFIDENTIAL_ERC20 not configured');
  }

  const rpcUrl = process.env.RPC_URL || process.env.ARBITRUM_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
  
  // Generate user key pair and derive owner address
  // 1. Generate random private key
  const userPrivateKey = generatePrivateKey();
  console.log('Generated user private key');

  // 2. Get public key from private key (uncompressed, 65 bytes: 0x04 + x + y)
  const privateKeyBytes = toBytes(userPrivateKey);
  const publicKeyBytes = getPublicKey(privateKeyBytes, false); // false = uncompressed
  
  // Convert to hex string for keccak256
  const publicKeyHex = `0x${Buffer.from(publicKeyBytes).toString('hex')}` as `0x${string}`;
  
  // Extract x and y coordinates (skip first byte which is 0x04)
  const x = `0x${Buffer.from(publicKeyBytes.slice(1, 33)).toString('hex')}`;
  const y = `0x${Buffer.from(publicKeyBytes.slice(33, 65)).toString('hex')}`;

  // 3. Convert public key to Ethereum address
  // Hash the public key with keccak256 and take last 20 bytes (keccak(pubkey)[12..])
  const publicKeyHash = keccak256(publicKeyHex);
  const ownerAddress = (`0x${publicKeyHash.slice(-40)}`) as Address;

  console.log('Derived owner address:', ownerAddress);
  console.log('Public key x:', x);
  console.log('Public key y:', y);
  
  // Find the stylus_artifacts directory (try both possible locations)
  const backendDir = process.cwd();
  const stylusArtifactsPath1 = path.join(backendDir, 'stylus_artifacts');
  const stylusArtifactsPath2 = path.join(backendDir, 'src', 'stylus_artifacts');
  
  let stylusArtifactsDir: string;
  if (fs.existsSync(stylusArtifactsPath1) && fs.existsSync(path.join(stylusArtifactsPath1, 'user_wallet.wasm'))) {
    stylusArtifactsDir = stylusArtifactsPath1;
  } else if (fs.existsSync(stylusArtifactsPath2) && fs.existsSync(path.join(stylusArtifactsPath2, 'user_wallet.wasm'))) {
    stylusArtifactsDir = stylusArtifactsPath2;
  } else {
    throw new Error(`stylus_artifacts directory not found at ${stylusArtifactsPath1} or ${stylusArtifactsPath2}`);
  }
  
  // When in stylus_artifacts directory, the wasm file is just user_wallet.wasm
  const wasmFileName = 'user_wallet.wasm';
  
  try {
    console.log('Deploying wallet via CLI...');
    console.log(`Changing to directory: ${stylusArtifactsDir}`);
    
    // Add constructor args: owner_address, conf_erc20
    const command = `cargo stylus deploy --wasm-file ${wasmFileName} --endpoint=${rpcUrl} --private-key=${privateKey} --constructor-args ${ownerAddress} ${confErc20}`;
    
    console.log('Executing command:', command.replace(privateKey, '***'));
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: stylusArtifactsDir,
      env: { ...process.env },
    });

    if (stderr && !stderr.includes('WARNING')) {
      console.warn('Command stderr:', stderr);
    }

    console.log('Command output:', stdout);

    // Parse the deployed address from output
    // Expected format: "deployed code at address: 0x4a2ba922052ba54e29c5417bc979daaf7d5fe4f4"
    const cleaned = stdout.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
    const addressMatch = cleaned.match(
      /deployed code at address:\s*(0x[a-fA-F0-9]{40})/
    );
    
    if (!addressMatch || !addressMatch[1]) {
      throw new Error('Failed to extract deployed wallet address from CLI output');
    }

    const deployedAddress = addressMatch[1] as Address;
    console.log('Wallet deployed at:', deployedAddress);
    
    return {
      walletAddress: deployedAddress,
      userPrivateKey,
      userPublicKey: { x, y },
      ownerAddress,
    };
  } catch (error: any) {
    console.error('Failed to deploy UserWallet contract via CLI:', error);
    if (error.stdout) console.error('Command stdout:', error.stdout);
    if (error.stderr) console.error('Command stderr:', error.stderr);
    throw new Error(`Wallet deployment failed: ${error.message}`);
  }
}

// --- ConfidentialERC20 user registration ---
export async function registerUserPublicKey(
  params: RegisterPublicKeyRequest
): Promise<string> {
  const { walletClient, publicClient } = getDeploymentWallet();

  const pkBytes = Buffer.from(params.publicKey.x.replace('0x', ''), 'hex').slice(0, 32);
  const pkHex = `0x${pkBytes.toString('hex')}`;

  const hash = await walletClient.sendTransaction({
    to: params.confidentialERC20,
    data: encodeFunctionData({
      abi: confidentialERC20Abi,
      functionName: 'register_user_pk',
      args: [pkHex as `0x${string}`],
    }),
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

