const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");
const { Wallet } = require("ethers");

const abiPath = path.join(process.cwd(), "abis", "confidential_erc20_abi_flat.txt");
const ABI = JSON.parse(fs.readFileSync(abiPath, "utf8"));

const weth_abi = [
  "function approve(address guy, uint256 wad) external returns (bool)",
  "function allowance(address src, address guy) external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
]

const verifier_abi = [
  "function verify(bytes calldata _proof, bytes32[] calldata _publicInputs) external returns (bool)",
  "function setForceFail(bool _fail) external",
]

async function generatePairOfKeys() {
  const wallet = Wallet.createRandom(); // creates random secp256k1 keypair
  const privateKey = wallet.privateKey; // 0x-prefixed 32-byte hex
  const publicKey = wallet.publicKey;   // 0x04-prefixed 65-byte hex (uncompressed)
  const address = wallet.address;

  return { privateKey, publicKey, address };
}

async function registerUserKey(contract) {
  const { privateKey, publicKey, address } = await generatePairOfKeys();

  console.log("Generated address:", address);
  console.log("Public key:", publicKey);
  const xCoordHex = "0x" + publicKey.slice(4, 68);
  const pkBytes = hre.ethers.getBytes(xCoordHex);

  // 🚀 Send the transaction
  const tx = await contract.registerUserPk(Array.from(pkBytes));
  console.log("✅ Tx hash:", tx.hash);
  await tx.wait();

  console.log("✔️ Registered key for", address);
}

async function getWETHTokens(amount) {
  const [signer] = await hre.ethers.getSigners();
  await signer.sendTransaction({ to: process.env.WETH_TOKEN_ADDRESS, value: amount });
}

async function approveWETHTransfer(spender, amount) {
  console.log("Approving ETH transfer");
  const [signer] = await hre.ethers.getSigners();
  const weth = new hre.ethers.Contract(process.env.WETH_TOKEN_ADDRESS, weth_abi, signer);
  const result = await weth.approve(spender, amount);
  console.log("✅ Approved tx hash: ", result.hash);
  const allowance = await weth.allowance(signer.address, spender);
  console.log("Allowance:", allowance.toString());
  const balance = await weth.balanceOf(signer.address);
  console.log("WETH balance:", ethers.formatEther(balance));
}

async function setProofValidityMock(value) {
  console.log("Setting validity of proof to:", !value);
  const [signer] = await hre.ethers.getSigners();
  const verifier = new hre.ethers.Contract(process.env.VERIFIER_ADDRESS, verifier_abi, signer);
  await verifier.setForceFail(value);
}

async function deposit(contract, to, is_proof_valid = true) {
  const amount = ethers.parseEther("0.001");
  //await getWETHTokens(amount);
  await approveWETHTransfer(process.env.CONFIDENTIAL_ERC20_ADDRESS, amount);

  await setProofValidityMock(!is_proof_valid);

  console.log("\n\nDepositing 0.001 weth");
  const new_balance_ct_x1 = randomBytes(32);
  const new_balance_ct_x2 = randomBytes(32);

  const proof_inputs = randomBytes(32);
  const proof = randomBytes(32);

  const tx_deposit = await contract.deposit(
    process.env.WETH_TOKEN_ADDRESS, 
    amount, // 0.001 ETH
    Array.from(new_balance_ct_x1),
    Array.from(new_balance_ct_x2),
    to, 
    Array.from(proof_inputs), 
    Array.from(proof)
  );
  console.log("✅ Tx hash:", tx_deposit.hash);
}

async function withdraw(contract, to, is_proof_valid = true) {
  console.log("\n\nWithdrawing 0.001 weth");
  const amount = ethers.parseEther("0.001");
  await setProofValidityMock(!is_proof_valid);

  const new_balance_ct_x1 = randomBytes(32);
  const new_balance_ct_x2 = randomBytes(32);

  let amountHex = amount.toString(16);
  while (amountHex.length < 64) amountHex = "0" + amountHex;
  const proof_inputs = ethers.getBytes("0x" + amountHex);
  const proof = randomBytes(32);

  const tx_withdraw = await contract.withdraw(
    process.env.WETH_TOKEN_ADDRESS,
    to,
    Array.from(new_balance_ct_x1),
    Array.from(new_balance_ct_x2),
    Array.from(proof_inputs),
    Array.from(proof)
  );
  console.log("✅ Tx hash:", tx_withdraw.hash);
}

async function transferConfidential(contract, to) {
  console.log("\n\nTransferring confidential");
  const new_balance_ct_x1 = randomBytes(32);
  const new_balance_ct_x2 = randomBytes(32);
  const new_to_ct_x1 = randomBytes(32);
  const new_to_ct_x2 = randomBytes(32);

  const proof_inputs = randomBytes(32);
  const proof = randomBytes(32);

  const tx_transfer_confidential = await contract.transferConfidential(
    process.env.WETH_TOKEN_ADDRESS,
    to,
    Array.from(new_balance_ct_x1),
    Array.from(new_balance_ct_x2),
    Array.from(new_to_ct_x1),
    Array.from(new_to_ct_x2),
    Array.from(proof_inputs),
    Array.from(proof)
  );
  console.log("✅ Tx hash:", tx_transfer_confidential.hash);
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const address = process.env.CONFIDENTIAL_ERC20_ADDRESS;
  const contract = new hre.ethers.Contract(address, ABI, signer);
  
  const owner = await contract.getOwner();
  if (owner.toString() !== signer.address) {
    console.log("Initializing contract...");
    const tx = await contract.init(process.env.VERIFIER_ADDRESS, process.env.CHAIN_ID);
    console.log("✅ Tx hash:", tx.hash);
  } else {
    console.log("Contract already initialized");
  }
  console.log("\n\nGetting initial values");
  console.log("Owner:", owner.toString());
  const verifier = await contract.getVerifier();
  console.log("Verifier:", verifier.toString());

  console.log("\n\nRegistering user PK");
  await registerUserKey(contract);

  console.log("\n\nSetting support for eth token");
  const tx_token = await contract.setSupportedToken(process.env.WETH_TOKEN_ADDRESS, true);
  console.log("✅ Tx hash:", tx_token.hash);
  const is_supported_token = await contract.isSupportedToken(process.env.WETH_TOKEN_ADDRESS);
  console.log("Is ETH supported:", is_supported_token.toString());

  console.log("\n\nGetting initial balance of user");
  const balance = await contract.balanceOfEnc(process.env.WETH_TOKEN_ADDRESS, signer.address);
  console.log("Balance of enc:", balance);

  await deposit(contract, signer.address);

  console.log("\n\nGetting balance of user");
  const balance_after = await contract.balanceOfEnc(process.env.WETH_TOKEN_ADDRESS, signer.address);
  console.log("Balance of enc:", balance_after);

  try {
    console.log("\n\nDepositing 0.001 weth with invalid proof");
    await deposit(contract, signer.address, false);
    console.log("❌ Deposit successful");
  } catch (error) {
    console.log("✅ Deposit failed");
  }

  await withdraw(contract, signer.address);

  await transferConfidential(contract, signer.address);
}

main().catch(console.error);
