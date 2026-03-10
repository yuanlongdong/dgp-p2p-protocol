export type SupportedNetwork = "arbSepolia" | "opSepolia";

export const NETWORKS: Record<SupportedNetwork, { chainId: number; defaultRpc: string }> = {
  arbSepolia: {
    chainId: 421614,
    defaultRpc: "https://sepolia-rollup.arbitrum.io/rpc"
  },
  opSepolia: {
    chainId: 11155420,
    defaultRpc: "https://sepolia.optimism.io"
  }
};
