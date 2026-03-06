import { HardhatUserConfig } from "hardhat/config";
import "dotenv/config";

const PK = process.env.PRIVATE_KEY || "";
const ARB = process.env.ARB_SEPOLIA_RPC_URL || "";

const config: HardhatUserConfig = {
solidity: "0.8.24",
networks: {
hardhat: {},
arbitrumSepolia: {
url: ARB,
accounts: PK ? [PK] : []
}
}
};

export default config;
