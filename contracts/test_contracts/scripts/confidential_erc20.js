const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");
const { Wallet } = require("ethers");

const abiPath = path.join(process.cwd(), "abis", "confidential_erc20_abi_flat.txt");
const ABI = JSON.parse(fs.readFileSync(abiPath, "utf8"));

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

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const address = process.env.CONFIDENTIAL_ERC20_ADDRESS;
  const contract = new hre.ethers.Contract(address, ABI, signer);

  console.log("Getting initial values");
  const owner = await contract.getOwner();
  console.log("Owner:", owner.toString());
  const verifier = await contract.getVerifier();
  console.log("Verifier:", verifier.toString());
  const isSupported = await contract.isSupportedToken(process.env.ETH_TOKEN_ADDRESS);
  console.log("Is supported:", isSupported.toString());

  console.log("\n\nRegistering user PK");
  await registerUserKey(contract);

  console.log("\n\nGetting balance of user");
  const balance = await contract.balanceOfEnc(process.env.ETH_TOKEN_ADDRESS, signer.address);
  console.log("Balance of enc:", balance);

}

main().catch(console.error);
