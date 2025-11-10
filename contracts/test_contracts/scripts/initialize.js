const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const abiPath = path.join(process.cwd(), "abis", "confidential_erc20_abi_flat.txt");
const ABI = JSON.parse(fs.readFileSync(abiPath, "utf8"));

async function main() {
    const [signer] = await hre.ethers.getSigners();
    const address = process.env.CONFIDENTIAL_ERC20_ADDRESS;
    const contract = new hre.ethers.Contract(address, ABI, signer);
    
    // Initializing contract if needed
    const owner = await contract.getOwner();
    if (owner.toString() !== signer.address) {
      console.log("Initializing contract...");
      const tx = await contract.init(process.env.VERIFIER_ADDRESS, process.env.CHAIN_ID);
      console.log("✅ Tx hash:", tx.hash);
    } else {
      console.log("Contract already initialized");
    }

    console.log("\n\nSetting support for eth token");
    const tx_token = await contract.setSupportedToken(process.env.WETH_TOKEN_ADDRESS, true);
    console.log("✅ Tx hash:", tx_token.hash);
}

main().catch(console.error);
