import { useEffect, useMemo, useState } from "react";
import {
  CELO_MAINNET_CHAIN_ID,
  WALLET_STORAGE_KEY,
} from "../config/app-config.js";
import { isWalletAddress, shortenWalletAddress } from "../utils/ui-helpers.js";

function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

function parseChainId(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  try {
    return Number(BigInt(value));
  } catch {
    return Number(value) || null;
  }
}

function toHexChainId(chainId) {
  return `0x${Number(chainId).toString(16)}`;
}

async function ensureCeloMainnet(provider, chainId = CELO_MAINNET_CHAIN_ID) {
  const targetChainId = toHexChainId(chainId);
  const currentChainId = await provider.request({ method: "eth_chainId" });

  if (String(currentChainId).toLowerCase() === targetChainId.toLowerCase()) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (error) {
    if (error?.code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: targetChainId,
        chainName: "Celo Mainnet",
        nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
        rpcUrls: ["https://forno.celo.org"],
        blockExplorerUrls: ["https://celoscan.io"],
      }],
    });
  }
}

function getWalletProviderName(provider) {
  if (!provider) return "No wallet";
  if (provider.isMiniPay) return "MiniPay";
  if (provider.isMetaMask) return "MetaMask";
  return "Injected wallet";
}

function getNetworkLabel(chainId) {
  const normalized = parseChainId(chainId);
  if (!normalized) return "Unknown network";
  if (normalized === CELO_MAINNET_CHAIN_ID) return "Celo Mainnet";
  if (normalized === 11142220) return "Celo Sepolia";
  return `Chain ${normalized}`;
}

export function useWalletSession() {
  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatus, setWalletStatus] = useState("");
  const [walletChainId, setWalletChainId] = useState(null);
  const provider = useMemo(() => getInjectedProvider(), []);
  const isMiniPay = Boolean(provider?.isMiniPay);
  const hasInjectedProvider = Boolean(provider?.request);

  const walletProviderName = useMemo(
    () => getWalletProviderName(provider),
    [provider],
  );
  const walletNetworkLabel = useMemo(
    () => getNetworkLabel(walletChainId),
    [walletChainId],
  );
  const walletReady = Boolean(walletAddress) && parseChainId(walletChainId) === CELO_MAINNET_CHAIN_ID;

  useEffect(() => {
    const storedWallet =
      typeof window !== "undefined"
        ? window.localStorage.getItem(WALLET_STORAGE_KEY) || ""
        : "";

    if (isWalletAddress(storedWallet)) {
      setWalletAddress(storedWallet);
      setWalletStatus("Using previously connected wallet.");
    }

    provider?.request?.({ method: "eth_chainId" })
      .then((chainId) => setWalletChainId(parseChainId(chainId)))
      .catch(() => {});

    provider?.request?.({ method: "eth_accounts" })
      .then((accounts) => {
        const nextWallet = accounts?.[0] || "";
        if (!isWalletAddress(nextWallet)) return;
        setWalletAddress(nextWallet);
        window.localStorage.setItem(WALLET_STORAGE_KEY, nextWallet);
        setWalletStatus(
          provider?.isMiniPay
            ? `MiniPay is available as ${shortenWalletAddress(nextWallet)}.`
            : "Using previously connected wallet.",
        );
      })
      .catch(() => {});

    if (!provider?.on) return undefined;

    function handleAccountsChanged(accounts) {
      const nextWallet = accounts?.[0] || "";
      if (isWalletAddress(nextWallet)) {
        setWalletAddress(nextWallet);
        setWalletStatus("Wallet changed.");
        window.localStorage.setItem(WALLET_STORAGE_KEY, nextWallet);
      } else {
        setWalletAddress("");
        setWalletStatus("Wallet disconnected.");
        window.localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    }

    function handleChainChanged(chainId) {
      const normalized = parseChainId(chainId);
      setWalletChainId(normalized);
      setWalletStatus(normalized === CELO_MAINNET_CHAIN_ID ? "Wallet ready on Celo Mainnet." : `Connected on ${getNetworkLabel(normalized)}.`);
    }

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  async function connectWallet() {
    const provider = getInjectedProvider();

    if (!provider?.request) {
      setWalletStatus("No injected wallet found. Open WordPot inside MiniPay or a wallet browser.");
      return;
    }

    try {
      setWalletStatus(provider.isMiniPay ? "Requesting MiniPay connection..." : "Requesting wallet connection...");
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const nextWallet = accounts?.[0] || "";

      if (!isWalletAddress(nextWallet)) {
        throw new Error("Connected account is not a valid wallet address.");
      }

      setWalletStatus(provider.isMiniPay ? "MiniPay connected. Preparing Celo Mainnet..." : "Wallet connected. Preparing Celo Mainnet...");
      await ensureCeloMainnet(provider, CELO_MAINNET_CHAIN_ID);
      const chainId = await provider.request({ method: "eth_chainId" });

      setWalletAddress(nextWallet);
      setWalletChainId(parseChainId(chainId));
      setWalletStatus(
        provider.isMiniPay
          ? `MiniPay ready on Celo Mainnet as ${shortenWalletAddress(nextWallet)}`
          : `Ready on Celo Mainnet as ${shortenWalletAddress(nextWallet)}`,
      );
      window.localStorage.setItem(WALLET_STORAGE_KEY, nextWallet);
    } catch (error) {
      setWalletStatus(error.message || "Unable to connect wallet.");
    }
  }

  function disconnectWallet() {
    setWalletAddress("");
    setWalletChainId(null);
    setWalletStatus("Wallet disconnected locally.");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }

  return {
    walletAddress,
    walletStatus,
    walletChainId,
    hasInjectedProvider,
    isMiniPay,
    walletProviderName,
    walletNetworkLabel,
    walletReady,
    connectWallet,
    disconnectWallet,
    ensureCeloMainnet,
    parseChainId,
    getInjectedProvider,
    setWalletStatus,
  };
}
