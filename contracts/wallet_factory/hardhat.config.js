require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },

    // 👇 Local Arbitrum Nitro dev node
    nitroLocalDevNode: {
      url: "http://127.0.0.1:8547",             // your local RPC
      chainId: 412346,                          // Arbitrum local dev chain
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : [],
    },

    // 👇 Optional public / testnet Arbitrum
    arbitrumSepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      chainId: 421614,                          // real Arbitrum Sepolia chain ID
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
