import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

function accounts() {
  const privateKey = process.env.PRIVATE_KEY;
  return privateKey ? [privateKey] : [];
}

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    arbSepolia: {
      chainId: 421614,
      url: process.env.ARB_SEPOLIA_RPC_URL || "",
      accounts: accounts()
    },
    opSepolia: {
      chainId: 11155420,
      url: process.env.OP_SEPOLIA_RPC_URL || "",
      accounts: accounts()
    }
  },
};

export default config;
