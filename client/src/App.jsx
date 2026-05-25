import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { zeroAddress } from "viem";
import { AppBottomNav } from "./components/ui/index.js";
import { HomeScreen, LobbyScreen, MatchRoomScreen } from "./components/screens/index.js";
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
const ROOM_FEED_LIMIT = 24;
const ROOM_TX_LIMIT = 12;
const SIGNED_MESSAGE_PREFIX = "wordpot-auth:";

const PracticeScreen = lazy(() =>
  import("./components/screens/practice-screen.jsx").then((module) => ({
    default: module.PracticeScreen,
  })),
);
const DailyChallenge = lazy(() =>
  import("./components/screens/daily-challenge.jsx").then((module) => ({
    default: module.DailyChallenge,
  })),
);
const LeaderboardScreen = lazy(() =>
  import("./components/screens/meta-screens.jsx").then((module) => ({
    default: module.LeaderboardScreen,
  })),
);
const ProfileScreen = lazy(() =>
  import("./components/screens/meta-screens.jsx").then((module) => ({
    default: module.ProfileScreen,
  })),
);
const SettingsScreen = lazy(() =>
  import("./components/screens/meta-screens.jsx").then((module) => ({
    default: module.SettingsScreen,
  })),
);

function ScreenLoader({ label = "Loading view..." }) {
  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="results-sheet">
          <p className="eyebrow">Loading</p>
          <h2>...</h2>
          <p>{label}</p>
        </div>
      </section>
    </main>
  );
}

class DailyChallengeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page-shell">
          <section className="play-shell">
            <div className="results-sheet">
              <p className="eyebrow">Daily Challenge Error</p>
              <h2>Could not load</h2>
              <p>{this.state.error.message || "Daily Challenge failed to load."}</p>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState("");
  const [roomError, setRoomError] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [, setDailyScore] = useState(0);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [dailyClaimBusy, setDailyClaimBusy] = useState(false);
  const [dailyClaimTx, setDailyClaimTx] = useState("");
  const [dailyClaimError, setDailyClaimError] = useState("");
  const [dailyClaimMessage, setDailyClaimMessage] = useState("");
  const [roomSyncStatus, setRoomSyncStatus] = useState("idle");
  const inviteRoomJoinAttemptedRef = useRef(false);
  const [settings, setSettings] = useState({
    sound: true,
    haptics: true,
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
        const response = await fetch(
          `${API_BASE_URL}/rooms/${session.roomId}?feedLimit=${ROOM_FEED_LIMIT}&txLimit=${ROOM_TX_LIMIT}`,
        );
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

  useEffect(() => {
    if (inviteRoomJoinAttemptedRef.current) return;
    if (!isWalletAddress(walletAddress.trim()) || !walletReady) return;

    const params = new URLSearchParams(window.location.search);
    const inviteRoomId = String(params.get("room") || "").trim();
    if (!inviteRoomId) return;

    inviteRoomJoinAttemptedRef.current = true;
    handleQuickMatch(inviteRoomId);
  }, [walletAddress, walletReady]);

  async function checkDailyStatus() {
    if (screen !== "daily-challenge") return;
    if (!isWalletAddress(walletAddress.trim())) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/daily/status?walletAddress=${encodeURIComponent(walletAddress.trim())}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to check daily claim status.");
      }

      setDailyClaimed(Boolean(data.claimed));
      setDailyClaimTx(data.txHash || "");
    } catch (error) {
      setDailyClaimError(error.message || "Unable to check daily claim status.");
    }
  }

  useEffect(() => {
    checkDailyStatus();
  }, [screen, walletAddress]);

  async function signWalletMessage(message) {
    const provider = getInjectedProvider();
    if (!provider?.request) {
      throw new Error("Open WordPot inside MiniPay or a wallet browser to sign.");
    }

    return provider.request({
      method: "personal_sign",
      params: [message, walletAddress.trim()],
    });
  }

  async function claimDailyReward(sessionId) {
    setDailyClaimError("");
    setDailyClaimMessage("");

    if (!isWalletAddress(walletAddress.trim())) {
      await connectWallet();
      return;
    }

    if (!sessionId) {
      setDailyClaimError("Daily Challenge session is missing. Start a new round and try again.");
      return;
    }

    setDailyClaimBusy(true);
    try {
      const signature = await signWalletMessage(
        `${SIGNED_MESSAGE_PREFIX}daily-claim:${walletAddress.trim()}`,
      );
      const response = await fetch(`${API_BASE_URL}/daily/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletAddress.trim(),
          sessionId,
          signature,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to claim daily reward.");
      }

      setDailyClaimed(true);
      setDailyClaimTx(data.txHash || "");
      setDailyClaimMessage("Claimed! 0.01 CELO is on its way to your wallet.");
    } catch (error) {
      setDailyClaimError(error.message || "Unable to claim daily reward.");
    } finally {
      setDailyClaimBusy(false);
    }
  }

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

  async function handleQuickMatch(targetRoomId = "") {
    setRoomError("");
    setRoomMessage("");

    if (!isWalletAddress(walletAddress.trim())) {
      setRoomError("Connect a valid wallet before joining quick match.");
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const inviteRoomId = String(targetRoomId || params.get("room") || "").trim();
      const endpoint = inviteRoomId
        ? `${API_BASE_URL}/rooms/${encodeURIComponent(inviteRoomId)}/join`
        : `${API_BASE_URL}/rooms/quick-match`;
      const response = await fetch(endpoint, {
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
      window.history.replaceState({}, "", window.location.pathname);
      setPlayerId(data.playerId);
      saveRoomSession({
        roomId: data.room.id,
        playerId: data.playerId,
        walletAddress: walletAddress.trim(),
      });
      setRoomMessage(
        inviteRoomId
          ? "You joined the invited room. Confirm your entry to lock your seat."
          : "You joined a public room. Invite more players or refresh the lobby.",
      );
      setScreen("lobby");
    } catch (error) {
      setRoomError(error.message || "Unable to join quick match.");
    }
  }

  async function copyInviteLink() {
    if (!room?.id || typeof window === "undefined") return;

    const inviteLink = `${window.location.origin}?room=${room.id}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 3000);
    } catch (error) {
      setRoomError(error.message || "Unable to copy invite link.");
    }
  }

  async function refreshRoom(options = {}) {
    if (!room?.id) return;
    const { silent = false } = options;

    try {
      if (!silent) {
        setRoomSyncStatus("syncing");
      }

      const response = await fetch(
        `${API_BASE_URL}/rooms/${room.id}?feedLimit=${ROOM_FEED_LIMIT}&txLimit=${ROOM_TX_LIMIT}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to refresh this room.");
      }

      const previousStatus = room?.status;
      const nextStatus = data.room.status;
      setRoom(data.room);
      if (data.room.status === "expired") {
        setRoomError("This room expired before the game could start. Go back home and create a new one.");
        setRoomMessage("");
      }
      if (data.room.status === "waiting") {
        setScreen("lobby");
      } else if (data.room.status === "expired") {
        setScreen("lobby");
      } else {
        setScreen("match-room");
      }
      saveRoomSession({
        roomId: data.room.id,
        playerId,
        walletAddress: walletAddress.trim(),
      });

      if (!silent && nextStatus !== "expired") {
        setRoomMessage(
          nextStatus === "expired"
            ? "This room expired before the game could start. Go back and create a new one."
            : nextStatus === "waiting"
            ? "Lobby updated."
            : nextStatus === "finished"
              ? "Results updated."
              : "Room updated.",
        );
      } else if (previousStatus !== nextStatus && nextStatus !== "expired") {
        setRoomMessage(
          nextStatus === "active"
            ? "The arena is live now."
            : nextStatus === "finished"
              ? "Round finished. Results are ready."
              : nextStatus === "expired"
                ? "This room expired before the game could start. Go back and create a new one."
              : "Room state changed.",
        );
      }
      if (nextStatus !== "expired") {
        setRoomError("");
      }
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
          ? "MiniPay will finalize scores onchain, then ask you to confirm the reward claim."
          : "Finalizing scores onchain before reward claim...",
      );

      const settleResponse = await fetch(`${API_BASE_URL}/rooms/${room.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          walletAddress: myPlayer.walletAddress,
        }),
      });
      const settleData = await settleResponse.json();

      if (!settleResponse.ok) {
        throw new Error(settleData.error || "Unable to settle this room onchain yet.");
      }

      if (settleData.room) {
        setRoom(settleData.room);
      }

      setRoomMessage(
        isMiniPay
          ? "MiniPay will now ask you to confirm the reward claim transaction."
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
          ? `MiniPay claim confirmed! You will receive ${myPayout.amount} CELO. TX: ${txHash.slice(0, 10)}...`
          : `Claim confirmed! You will receive ${myPayout.amount} CELO. TX: ${txHash.slice(0, 10)}...`,
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
      onOpenDailyChallenge={() => setScreen("daily-challenge")}
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
    />
  );

  if (screen === "practice") {
    content = (
      <Suspense fallback={<ScreenLoader label="Preparing practice arena..." />}>
        <PracticeScreen
          onExit={() => setScreen("home")}
          apiBaseUrl={API_BASE_URL}
          walletAddress={walletAddress}
          connectWallet={connectWallet}
        />
      </Suspense>
    );
  } else if (screen === "daily-challenge") {
    content = (
      <DailyChallengeErrorBoundary>
        <Suspense fallback={<ScreenLoader label="Loading Daily Challenge..." />}>
          <DailyChallenge
            apiBaseUrl={API_BASE_URL}
            walletAddress={walletAddress}
            walletReady={walletReady}
            onConnectWallet={connectWallet}
            onBack={() => setScreen("home")}
            onScoreUpdate={setDailyScore}
            dailyClaimed={dailyClaimed}
            dailyClaimBusy={dailyClaimBusy}
            dailyClaimTx={dailyClaimTx}
            dailyClaimError={dailyClaimError}
            dailyClaimMessage={dailyClaimMessage}
            onClaimDaily={claimDailyReward}
          />
        </Suspense>
      </DailyChallengeErrorBoundary>
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
        onCopyInvite={copyInviteLink}
        inviteCopied={inviteCopied}
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
      <Suspense fallback={<ScreenLoader label="Loading profile..." />}>
        <ProfileScreen
          walletAddress={walletAddress}
          onConnectWallet={connectWallet}
          onBack={backHome}
        />
      </Suspense>
    );
  } else if (screen === "leaderboard") {
    content = (
      <Suspense fallback={<ScreenLoader label="Loading leaderboard..." />}>
        <LeaderboardScreen
          apiBaseUrl={API_BASE_URL}
          room={room}
          onQuickMatch={handleQuickMatch}
          onBack={backHome}
        />
      </Suspense>
    );
  } else if (screen === "settings") {
    content = (
      <Suspense fallback={<ScreenLoader label="Loading settings..." />}>
        <SettingsScreen
          settings={settings}
          onToggle={toggleSetting}
          onBack={backHome}
        />
      </Suspense>
    );
  }

  return (
    <div
      className={[
        "app-dark-mode",
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
