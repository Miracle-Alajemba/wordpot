import { createPublicClient, createWalletClient, custom, http } from "viem";
import { celo, celoSepolia } from "viem/chains";

const CHAIN_LOOKUP = {
  42220: celo,
  11142220: celoSepolia,
};

export function getInjectedWalletProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

export function getCeloChain(chainId = 42220) {
  return CHAIN_LOOKUP[Number(chainId)] || celo;
}

export function createInjectedWalletClient(chainId = 42220) {
  const provider = getInjectedWalletProvider();
  if (!provider) return null;

  return createWalletClient({
    chain: getCeloChain(chainId),
    transport: custom(provider),
  });
}

export function createCeloPublicClient(chainId = 42220) {
  return createPublicClient({
    chain: getCeloChain(chainId),
    transport: http(),
  });
}
