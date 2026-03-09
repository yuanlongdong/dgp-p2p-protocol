import { createPublicClient, http } from "viem";
import { arbitrumSepolia, optimismSepolia } from "viem/chains";
import { NETWORKS, SupportedNetwork } from "../config/networks";

export function createRpcClient(network: SupportedNetwork, rpcUrl?: string) {
  const chain = network === "arbSepolia" ? arbitrumSepolia : optimismSepolia;
  const transport = http(rpcUrl || NETWORKS[network].defaultRpc);
  return createPublicClient({ chain, transport });
}
