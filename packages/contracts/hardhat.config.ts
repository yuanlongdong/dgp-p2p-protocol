import { HardhatUserConfig, subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import type { SolcBuild } from "hardhat/types/builtin-tasks/compile";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

function accounts() {
  const privateKey = process.env.PRIVATE_KEY;
  return privateKey ? [privateKey] : [];
}

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(
  async ({ solcVersion }): Promise<SolcBuild> => {
    const compilerPath = require.resolve("solc/soljson.js");
    const bundledVersion = require("solc/package.json").version;

    if (bundledVersion !== solcVersion) {
      console.warn(
        `[hardhat] Requested solc ${solcVersion}, using bundled solc ${bundledVersion} from the local installation.`
      );
    }

    return {
      compilerPath,
      isSolcJs: true,
      version: solcVersion,
      longVersion: `${solcVersion}+local`,
    };
  }
);

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          evmVersion: "istanbul",
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    arbSepolia: {
      chainId: 421614,
      url: process.env.ARB_SEPOLIA_RPC_URL || "",
      accounts: accounts(),
    },
    opSepolia: {
      chainId: 11155420,
      url: process.env.OP_SEPOLIA_RPC_URL || "",
      accounts: accounts(),
    },
  },
};

export default config;
