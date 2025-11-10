import {
  Address,
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DeployWalletRequest, RegisterPublicKeyRequest } from '../types';
import { getArbitrumChain } from '../utils/chain';
import { keccak256 } from 'viem/utils';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { GrumpkinScalar, Schnorr } from '@aztec/aztec.js';
import { ContractService } from '../db/services/contractService';

const execAsync = promisify(exec);

const confidentialERC20Abi = parseAbi([
  'function register_user_pk(bytes pk)',
]);

// Helper function to convert Fr to 32 bytes
function frTo32Bytes(f: any): Buffer {
  const buf = f.toBuffer(); // usually 32 bytes
  if (buf.length !== 32) {
    throw new Error(`Fr.toBuffer() expected 32 bytes, got ${buf.length}`);
  }
  return Buffer.from(buf);
}

// Helper function to generate key bytes from public key
function generateKeyBytes(pk: { x: any; y: any }): Uint8Array {
  const xBytes = frTo32Bytes(pk.x);
  const yBytes = frTo32Bytes(pk.y);

  const pubBytes = new Uint8Array(64);
  pubBytes.set(xBytes, 0);
  pubBytes.set(yBytes, 32);

  return pubBytes;
}

// Generate Noir keypair using GrumpkinScalar and Schnorr
export async function generateNoirKeypair() {
  const sk = GrumpkinScalar.random();
  const schnorr = new Schnorr();
  const pk = await schnorr.computePublicKey(sk); // { x: Fr, y: Fr }

  return { sk, pk }; // pk is Uint8Array[64], sk is GrumpkinScalar
}


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

  const network = process.env.NETWORK;
  if (!network) {
    throw new Error('NETWORK environment variable is not set');
  }

  // Get ConfidentialERC20 contract address from database
  const contract = await ContractService.getContractByNameAndNetwork(
    'CONFIDENTIAL_ERC20',
    network
  );

  if (!contract) {
    throw new Error(`Contract with name CONFIDENTIAL_ERC20 and network ${network} not found in database`);
  }

  const confErc20 = contract.address as Address;

  const rpcUrl = process.env.RPC_URL || process.env.ARBITRUM_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
  
  // Generate user key pair using GrumpkinScalar and Schnorr (like utils.js)
  const { sk, pk } = await generateNoirKeypair();
  console.log('Generated user key pair using GrumpkinScalar');

  // Convert private key to hex string for storage/return
  const userPrivateKey = `0x${Buffer.from(sk.toBuffer()).toString('hex')}` as `0x${string}`;

  // Extract x and y coordinates from public key bytes (64 bytes: 32 bytes x + 32 bytes y)
  const x = `0x${Buffer.from(pk.slice(0, 32)).toString('hex')}`;
  const y = `0x${Buffer.from(pk.slice(32, 64)).toString('hex')}`;

  // Convert public key to Ethereum address
  // Hash the public key bytes with keccak256 and take last 20 bytes (keccak(pubkey)[12..])
  const publicKeyHex = `0x${Buffer.from(pk).toString('hex')}` as `0x${string}`;
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

