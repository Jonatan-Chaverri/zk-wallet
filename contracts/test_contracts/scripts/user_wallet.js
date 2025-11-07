const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");

const abiPath = path.join(process.cwd(), "abis", "_abi_flat.txt");
const ABI = JSON.parse(fs.readFileSync(abiPath, "utf8"));

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const address = process.env.CONFIDENTIAL_ERC20_ADDRESS;
  const contract = new hre.ethers.Contract(address, ABI, signer);

  console.log("Getting initial values");
  const value = await getOwner(contract);
  console.log("Owner:", value.toString());
  const verifier = await getVerifier(contract);
  console.log("Verifier:", verifier.toString());
  const isSupported = await isSupportedToken(contract, process.env.ETH_TOKEN_ADDRESS);
  console.log("Is supported:", isSupported.toString());

  console.log("\n\nRegistering user PK");
  const pk = randomBytes(32);
  console.log("Generated PK (hex):", Buffer.from(pk).toString("hex"));
  const pkArray = Array.from(pk);
  const result = await registerUserPk(contract, pkArray);
  console.log("PK registration tx hash:", result.hash);

  console.log("\n\nGetting balance of user");
  const balance = await balanceOfEnc(contract, process.env.ETH_TOKEN_ADDRESS, signer.address);
  console.log("Balance of enc:", balance);

}

main().catch(console.error);
