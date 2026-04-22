import { useEffect, useMemo, useRef, useState } from "react";
import { zeroAddress } from "viem";
import { AppBottomNav, ChatMessage } from "./components/ui/index.js";
import {
  HomeScreen,
  LeaderboardScreen,
  LobbyScreen,
  MatchRoomScreen,
  PracticeScreen,
  ProfileScreen,
  SettingsScreen,
} from "./components/screens/index.js";
import {
  API_BASE_URL,
  CELO_MAINNET_CHAIN_ID,
  GAME_RULES,
} from "./config/index.js";
import { useWalletSession } from "./hooks/index.js";
import {
  clearRoomSession,
  isWalletAddress,
  readRoomSession,
  saveRoomSession,
  shortenWalletAddress,
} from "./utils/index.js";

const WORDPOT_ARENA_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "roomId", type: "uint256" }],
    name: "joinRoom",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "roomId", type: "uint256" }],
    name: "claimReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export default function App() {
  const [screen, setScreen] = useState("home");
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState("");
  const [roomError, setRoomError] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [roomSyncStatus, setRoomSyncStatus] = useState("idle");
  const [settings, setSettings] = useState({
    sound: true,
    haptics: true,
    darkMode: true,
    highContrast: false,
    largeText: false,
    showEarnings: true,
    showRank: true,
  });
  const {
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
    getPublicClient,
    getWalletClient,
    setWalletStatus,
  } = useWalletSession();

  const walletHint = useMemo(() => {
    if (!walletAddress.trim()) return "";
    const valid = isWalletAddress(walletAddress.trim());
    return valid
      ? walletReady
        ? `Room identity will show as ${shortenWalletAddress(walletAddress.trim())} and your wallet is ready for Celo mainnet play.`
        : `Room identity will show as ${shortenWalletAddress(walletAddress.trim())}. Switch to Celo Mainnet before paying to join a live room.`
      : "Connected account is not a valid EVM wallet address.";
  }, [walletAddress, walletReady]);
  const walletConnectLabel = useMemo(() => {
    if (walletAddress) {
      return walletReady ? "Reconnect Wallet" : "Switch to Celo";
    }

    if (isMiniPay) return "Connect MiniPay";
    return "Connect Wallet";
  }, [isMiniPay, walletAddress, walletReady]);
  const walletEnvironmentHint = useMemo(() => {
    if (isMiniPay) {
      return "MiniPay is available in this session, so room payments can stay fully inside the wallet flow.";
    }

    if (hasInjectedProvider) {
      return "";
    }

    return "Open WordPot inside MiniPay to test the real Celo wallet flow from connection to room payment.";
  }, [hasInjectedProvider, isMiniPay]);
  const paymentProviderLabel = useMemo(() => {
    if (isMiniPay) return "Pay with MiniPay";
    return "Pay";
  }, [isMiniPay]);

  useEffect(() => {
    if (!isWalletAddress(walletAddress)) return undefined;

    const session = readRoomSession();
    if (!session) return undefined;
    if (session.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) return undefined;
    if (room?.id === session.roomId && playerId === session.playerId) return undefined;

    let cancelled = false;

    async function restoreRoomSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/rooms/${session.roomId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to restore your room session.");
        }

        if (cancelled) return;

        const restoredPlayer = (data.room?.players || []).find(
          (entry) => entry.id === session.playerId,
        );

        if (
          !restoredPlayer ||
          restoredPlayer.walletAddress.toLowerCase() !== session.walletAddress.toLowerCase()
        ) {
          throw new Error("Saved room session no longer matches this wallet.");
        }

        setRoom(data.room);
        setPlayerId(session.playerId);
        setScreen(data.room.status === "waiting" ? "lobby" : "match-room");
        setRoomError("");
        setRoomMessage(
          data.room.status === "waiting"
            ? "Room restored from the backend."
            : data.room.status === "finished"
              ? "Finished room restored from the backend."
              : "Live room restored from the backend.",
        );
      } catch (error) {
        if (cancelled) return;
        clearRoomSession();
        setRoomError(error.message || "Unable to restore room session.");
      }
    }

    restoreRoomSession();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, room?.id, playerId]);

  async function handleHomeJoin() {
    setRoomError("");

    if (!walletAddress) {
      await connectWallet();
      return;
    }

    if (!walletReady) {
      await connectWallet();
      return;
    }

    await handleQuickMatch();
  }

  async function handleQuickMatch() {
    setRoomError("");
    setRoomMessage("");

    if (!isWalletAddress(walletAddress.trim())) {
      setRoomError("Connect a valid wallet before joining quick match.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/quick-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress: walletAddress.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to join a quick match.");
      }

      setRoom(data.room);
      setPlayerId(data.playerId);
      saveRoomSession({
        roomId: data.room.id,
        playerId: data.playerId,
        walletAddress: walletAddress.trim(),
      });
      setRoomMessage("You joined a public room. Invite more players or refresh the lobby.");
      setScreen("lobby");
    } catch (error) {
      setRoomError(error.message || "Unable to join quick match.");
    }
  }

  async function refreshRoom(options = {}) {
    if (!room?.id) return;
    const { silent = false } = options;

    try {
      if (!silent) {
        setRoomSyncStatus("syncing");
      }

      const response = await fetch(`${API_BASE_URL}/rooms/${room.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to refresh this room.");
      }

      const previousStatus = room?.status;
      const nextStatus = data.room.status;
      setRoom(data.room);
      setScreen(data.room.status === "waiting" ? "lobby" : "match-room");
      saveRoomSession({
        roomId: data.room.id,
        playerId,
        walletAddress: walletAddress.trim(),
      });

      if (!silent) {
        setRoomMessage(
          nextStatus === "waiting"
            ? "Lobby updated."
            : nextStatus === "finished"
              ? "Results updated."
              : "Room updated.",
        );
      } else if (previousStatus !== nextStatus) {
        setRoomMessage(
          nextStatus === "active"
            ? "The arena is live now."
            : nextStatus === "finished"
              ? "Round finished. Results are ready."
              : "Room state changed.",
        );
      }
      setRoomError("");
      setRoomSyncStatus("live");
    } catch (error) {
      if (!silent) {
        setRoomError(error.message || "Unable to refresh room.");
      } else {
        setRoomSyncStatus("retrying");
      }
    }
  }

  async function payEntryFeeOnchain() {
    if (!room?.id || !playerId) return;

    const provider = getInjectedProvider();
    if (!provider?.request) {
      setRoomError("Open WordPot inside MiniPay or a wallet browser to pay onchain.");
      return;
    }

    if (!isWalletAddress(walletAddress.trim())) {
      setRoomError("Connect a valid wallet before sending the join payment.");
      return;
    }

    const treasuryWallet = room?.onchain?.treasuryWallet;
    const contractAddress = room?.onchain?.contractAddress;
    const contractRoomId = room?.onchain?.contractRoomId;
    const joinMode = room?.onchain?.joinMode || "treasury_beta";
    const joinPaymentWei = room?.onchain?.joinPaymentWei;
    const joinPaymentDisplay = room?.onchain?.joinPaymentDisplay || "0.001 CELO";

    if (
      joinMode === "contract_join" &&
      (!isWalletAddress(contractAddress) || contractAddress === zeroAddress || !contractRoomId)
    ) {
      setRoomError("Contract join is not fully configured yet for this room.");
      return;
    }

    if (
      joinMode !== "contract_join" &&
      (!isWalletAddress(treasuryWallet) || treasuryWallet === zeroAddress || !joinPaymentWei)
    ) {
      setRoomError("Onchain join is not configured yet. Add the treasury wallet in the server env.");
      return;
    }

    try {
      setPaymentBusy(true);
      setRoomError("");
      setRoomMessage(
        isMiniPay
          ? "MiniPay will ask you to confirm the room entry payment."
          : "Confirm the entry payment in your wallet...",
      );

      await ensureCeloMainnet(provider, room?.onchain?.chainId || CELO_MAINNET_CHAIN_ID);
      const targetChainId = room?.onchain?.chainId || CELO_MAINNET_CHAIN_ID;
      const walletClient = getWalletClient(targetChainId);
      const publicClient = getPublicClient(targetChainId);

      let txHash = "";
      if (walletClient && publicClient) {
        const [account] = await walletClient.getAddresses();
        if (joinMode === "contract_join") {
          txHash = await walletClient.writeContract({
            account,
            chain: walletClient.chain,
            address: contractAddress,
            abi: WORDPOT_ARENA_ABI,
            functionName: "joinRoom",
            args: [BigInt(contractRoomId)],
            value: BigInt(joinPaymentWei),
          });
        } else {
          txHash = await walletClient.sendTransaction({
            account,
            chain: walletClient.chain,
            to: treasuryWallet,
            value: BigInt(joinPaymentWei),
          });
        }
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        if (joinMode === "contract_join") {
          setRoomError("Contract join requires the MiniPay-compatible wallet client path.");
          return;
        }

        txHash = await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: walletAddress.trim(),
            to: treasuryWallet,
            value: `0x${BigInt(joinPaymentWei).toString(16)}`,
          }],
        });
      }

      const recordResponse = await fetch(`${API_BASE_URL}/rooms/${room.id}/join-tx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          walletAddress: walletAddress.trim(),
          txHash,
          amount: joinPaymentDisplay,
          mode: joinMode,
        }),
      });
      const recordData = await recordResponse.json();

      if (!recordResponse.ok) {
        throw new Error(recordData.error || "Unable to record the onchain join transaction.");
      }

      setRoom(recordData.room);
      setRoomMessage(
        isMiniPay
          ? joinMode === "contract_join"
            ? "MiniPay contract join confirmed. Your seat is now locked in."
            : "MiniPay payment confirmed. Your seat is now locked in."
          : joinMode === "contract_join"
            ? "Contract join confirmed. Your seat is now locked in."
            : "Entry confirmed. Your seat is now locked in.",
      );
    } catch (error) {
      setRoomError(error.message || "Unable to complete the onchain join payment.");
    } finally {
      setPaymentBusy(false);
    }
  }

  async function startRoom() {
    if (!room?.id || !playerId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${room.id}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          walletAddress: walletAddress.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to start this room.");
      }

      setRoom(data.room);
      saveRoomSession({
        roomId: data.room.id,
        playerId,
        walletAddress: walletAddress.trim(),
      });
      setRoomMessage("");
      setRoomError("");
    } catch (error) {
      setRoomError(error.message || "Unable to start this room.");
    }
  }

  async function cancelRoom() {
    if (!room?.id || !playerId) return;

    if (!window.confirm("Are you sure you want to cancel this room? All players will be refunded.")) {
      return;
    }

    try {
      setRoomError("");
      setRoomMessage("Cancelling room and processing refunds...");

      const response = await fetch(`${API_BASE_URL}/rooms/${room.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          walletAddress: walletAddress.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to cancel this room.");
      }

      setRoom(data.room);
      setRoomMessage("Room cancelled successfully. All players have been refunded.");
    } catch (error) {
      setRoomError(error.message || "Unable to cancel this room.");
    }
      setRoomSyncStatus("live");
      setScreen("match-room");
    } catch (error) {
      setRoomError(error.message || "Unable to start room.");
    }
  }

  async function submitRoomWord(word) {
    if (!room?.id || !playerId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${room.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          walletAddress: walletAddress.trim(),
          word,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit word.");
      }

      setRoom(data.room);
      setRoomMessage(`Locked in ${data.submission.word} for +${data.submission.score} points.`);
      setRoomError("");
      setRoomSyncStatus("live");
    } catch (error) {
      setRoomError(error.message || "Unable to submit word.");
    }
  }

  async function claimRewardOnchain() {
    if (!room?.id || !playerId) return;

    const myPlayer = room?.players?.find((entry) => entry.id === playerId);
    const myPayout = (room?.payouts || []).find(
      (entry) => entry.walletAddress === myPlayer?.walletAddress,
    );

    if (!myPlayer?.walletAddress) {
      setRoomError("Wallet address not found.");
      return;
    }

    if (!myPayout || Number(myPayout?.amount || 0) <= 0) {
      setRoomError("No reward available to claim for this wallet.");
      return;
    }

    if (room?.onchain?.payoutMode !== "contract_claim") {
      setRoomError("Reward claiming will go live after the WordPot payout contract is deployed.");
      return;
    }

    const contractAddress = room?.onchain?.contractAddress;
    const contractRoomId = room?.onchain?.contractRoomId;

    if (!isWalletAddress(contractAddress) || contractAddress === zeroAddress || !contractRoomId) {
      setRoomError("Contract configuration incomplete. Please wait for the operator to settle the room.");
      return;
    }

    const provider = getInjectedProvider();
    if (!provider?.request) {
      setRoomError("Open WordPot inside MiniPay or a wallet browser to claim your reward.");
      return;
    }

    setClaimBusy(true);
    try {
      setRoomError("");
      setRoomMessage(
        isMiniPay
          ? "MiniPay will ask you to confirm the reward claim transaction."
          : "Confirm the reward claim in your wallet...",
      );

      await ensureCeloMainnet(provider, room?.onchain?.chainId || CELO_MAINNET_CHAIN_ID);
      const targetChainId = room?.onchain?.chainId || CELO_MAINNET_CHAIN_ID;
      const walletClient = getWalletClient(targetChainId);
      const publicClient = getPublicClient(targetChainId);

      let txHash = "";
      if (walletClient && publicClient) {
        const [account] = await walletClient.getAddresses();
        
        // Call the smart contract's claimReward function
        txHash = await walletClient.writeContract({
          account,
          chain: walletClient.chain,
          address: contractAddress,
          abi: WORDPOT_ARENA_ABI,
          functionName: "claimReward",
          args: [BigInt(contractRoomId)],
        });

        // Wait for the transaction to be confirmed on the blockchain
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        setRoomError("Wallet client not available. Please use MiniPay or MetaMask.");
        return;
      }

      // Record the claim transaction on the server
      const recordResponse = await fetch(`${API_BASE_URL}/rooms/${room.id}/claim-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          walletAddress: myPlayer.walletAddress,
          txHash,
          amount: String(myPayout.amount),
        }),
      });

      const recordData = await recordResponse.json();

      if (!recordResponse.ok) {
        throw new Error(recordData.error || "Failed to record the claim transaction.");
      }

      setRoom(recordData.room);
      setRoomMessage(
        isMiniPay
          ? `MiniPay claim confirmed! You will receive ${myPayout.amount} cUSD. TX: ${txHash.slice(0, 10)}...`
          : `Claim confirmed! You will receive ${myPayout.amount} cUSD. TX: ${txHash.slice(0, 10)}...`,
      );
    } catch (error) {
      setRoomError(error.message || "Unable to claim reward.");
    } finally {
      setClaimBusy(false);
    }
  }

  function backHome() {
    clearRoomSession();
    setRoom(null);
    setPlayerId("");
    setScreen("home");
    setRoomMessage("");
    setRoomError("");
    setRoomSyncStatus("idle");
  }

  function toggleSetting(key) {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  useEffect(() => {
    if (screen !== "lobby" && screen !== "match-room") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      refreshRoom({ silent: true });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [screen, room?.id, playerId, walletAddress]);

  let content = (
    <HomeScreen
      gameRules={GAME_RULES}
      onStartPractice={() => setScreen("practice")}
      onQuickMatch={handleHomeJoin}
      onOpenLeaderboard={() => setScreen("leaderboard")}
      onOpenProfile={() => setScreen("profile")}
      onOpenSettings={() => setScreen("settings")}
      walletAddress={walletAddress}
      walletStatus={walletStatus}
      walletReady={walletReady}
      walletProviderName={walletProviderName}
      walletNetworkLabel={walletNetworkLabel}
      walletConnectLabel={walletConnectLabel}
      walletEnvironmentHint={walletEnvironmentHint}
      isMiniPay={isMiniPay}
      hasInjectedProvider={hasInjectedProvider}
      onConnectWallet={connectWallet}
      onDisconnectWallet={disconnectWallet}
      walletHint={walletHint}
      roomError={roomError}
      darkMode={settings.darkMode}
      onToggleTheme={() => toggleSetting("darkMode")}
    />
  );

  if (screen === "practice") {
    content = (
      <PracticeScreen
        onExit={() => setScreen("home")}
        apiBaseUrl={API_BASE_URL}
      />
    );
  } else if (screen === "lobby") {
    content = (
      <LobbyScreen
        room={room}
        playerId={playerId}
        statusMessage={roomMessage}
        error={roomError}
        syncStatus={roomSyncStatus}
        onRefresh={refreshRoom}
        onStart={startRoom}
        onCancel={cancelRoom}
        onPayEntryFee={payEntryFeeOnchain}
        paymentBusy={paymentBusy}
        onBack={backHome}
        paymentProviderLabel={paymentProviderLabel}
      />
    );
  } else if (screen === "match-room") {
    content = (
      <MatchRoomScreen
        room={room}
        playerId={playerId}
        roomMessage={roomMessage}
        roomError={roomError}
        syncStatus={roomSyncStatus}
        onRefresh={refreshRoom}
        onSubmitWord={submitRoomWord}
        onClaimReward={claimRewardOnchain}
        claimBusy={claimBusy}
        onBackHome={backHome}
      />
    );
  } else if (screen === "profile") {
    content = (
      <ProfileScreen
        walletAddress={walletAddress}
        onConnectWallet={connectWallet}
        onBack={backHome}
      />
    );
  } else if (screen === "leaderboard") {
    content = (
      <LeaderboardScreen
        apiBaseUrl={API_BASE_URL}
        room={room}
        onQuickMatch={handleQuickMatch}
        onBack={backHome}
      />
    );
  } else if (screen === "settings") {
    content = (
      <SettingsScreen
        settings={settings}
        onToggle={toggleSetting}
        onBack={backHome}
      />
    );
  }

  return (
    <div
      className={[
        settings.darkMode ? "app-dark-mode" : "app-light-mode",
        settings.largeText ? "app-text-scale" : "",
        settings.highContrast ? "app-high-contrast" : "",
      ].filter(Boolean).join(" ")}
    >
      {content}
      <AppBottomNav
        screen={screen}
        onNavigate={setScreen}
        walletAddress={walletAddress}
        onWalletAction={walletAddress ? disconnectWallet : connectWallet}
      />
    </div>
  );
}
