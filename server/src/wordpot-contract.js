import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  getContract,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadWordPotArtifact() {
  const artifactPath = path.resolve(
    __dirname,
    "../../contracts/artifacts/contracts/WordPotArena.sol/WordPotArena.json",
  );

  const raw = fs.readFileSync(artifactPath, "utf8");
  return JSON.parse(raw);
}

function normalizePrivateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

export function createWordPotContractService(options) {
  const contractAddress = String(options?.contractAddress || "").trim();
  const rpcUrl = String(options?.rpcUrl || "https://forno.celo.org").trim();
  const operatorKey = normalizePrivateKey(options?.operatorPrivateKey);

  if (!isAddress(contractAddress)) {
    return {
      enabled: false,
      reason: "missing_contract_address",
      async createRoom() {
        return null;
      },
    };
  }

  if (!operatorKey) {
    return {
      enabled: false,
      reason: "missing_operator_key",
      async createRoom() {
        return null;
      },
    };
  }

  const account = privateKeyToAccount(operatorKey);
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(rpcUrl),
  });
  const artifact = loadWordPotArtifact();
  const contract = getContract({
    address: contractAddress,
    abi: artifact.abi,
    client: {
      public: publicClient,
      wallet: walletClient,
    },
  });

  return {
    enabled: true,
    reason: "ready",
    address: contractAddress,
    account: account.address,
    async createRoom(entryFeeWei) {
      const hash = await contract.write.createRoom([BigInt(entryFeeWei)]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let roomId = null;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contractAddress.toLowerCase())
          continue;

        try {
          const decoded = decodeEventLog({
            abi: artifact.abi,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "RoomCreated") {
            roomId = Number(decoded.args.roomId);
            break;
          }
        } catch {
          continue;
        }
      }

      return {
        hash,
        roomId,
      };
    },
    async cancelRoom(contractRoomId, playerAddresses) {
      try {
        console.log("Starting cancelRoom transaction...");
        console.log(`Contract: ${contractAddress}`);
        console.log(`Account: ${account.address}`);
        console.log(`RoomID: ${contractRoomId}`);
        console.log(`Players: ${playerAddresses.length}`);
        
        const hash = await contract.write.cancelRoom([
          BigInt(contractRoomId),
          playerAddresses.map((addr) => String(addr || "").trim()),
        ]);
        console.log("Transaction hash:", hash);
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("Transaction confirmed:", receipt?.transactionHash);
        
        if (receipt?.status === "reverted") {
          throw new Error(`Transaction reverted: ${hash}`);
        }
        
        return { hash };
      } catch (error) {
        console.error("cancelRoom error:", error.message);
        throw error;
      }
    },
    async settleRoom(contractRoomId, playerAddresses, playerScores) {
      const hash = await contract.write.settleRoom([
        BigInt(contractRoomId),
        playerAddresses.map((addr) => String(addr || "").trim()),
        playerScores.map((score) => BigInt(score)),
      ]);
      await publicClient.waitForTransactionReceipt({ hash });
      return { hash };
    },
  };
}
