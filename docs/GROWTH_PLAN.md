# WordPot Growth & Technical Expansion Plan

WordPot is a highly engaging, low-friction mobile Web3 game. By targeting Celo and MiniPay, it is positioned to capture users in emerging markets (particularly Africa) who value fast gameplay, low transaction fees, and instant utility. 

Below is an analysis of the project's current state, high-value feature updates you can add, and a marketing framework to acquire and retain users.

---

## 1. Project Assessment
* **The Good**: Mobile-first design, fast gameplay (60-second rounds), server-side verification with onchain payouts, and a free practice option. This hybrid model keeps gas costs down while ensuring real staking/rewards.
* **The Opportunity**: The game is currently "single-loop." A user plays, wins/losses, and leaves. To grow organically, it needs viral feedback loops, retention hooks, and direct mobile sharing channels.

---

## 2. Technical Updates to Add

To make the game more engaging and viral, consider adding the following features to the codebase:

### A. One-Click Social Sharing (WhatsApp / Telegram)
Currently, players can copy an invite link to their clipboard. Adding direct sharing buttons makes inviting competitors frictionless.
* **Implementation**: Add direct sharing buttons in `LobbyScreen` that trigger WhatsApp or Telegram share intents with pre-filled text:
  ```javascript
  const inviteText = `Join my WordPot lobby and race me to build words! Prize pool is active. 🏆 Play here: https://wordpot.vercel.app?room=${roomId}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteText)}`;
  ```

### B. Referral and Affiliate Commission
Encourage power-users to market the game for you. 
* **Concept**: When creating a room or joining, users can enter a referral wallet address. When that room settles, the referrer receives a small percentage (e.g., 2%) of the treasury fee directly from the contract.
* **Contract Update**: Add a referral mapping in `WordPotArena.sol` to track and distribute referrers' cuts during the `settleRoom` execution.

### C. Web Push Notification / Telegram Bot Alerts
Lobby-based games suffer when players wait around for others to join.
* **Concept**: Integrate Web Push Notifications or a Telegram Bot. When a player is waiting in a lobby and it reaches the minimum player limit (2 players), send a notification: *"Your WordPot room is full! Tap to start the game."*

### D. Leaderboard "Season" Rewards
Give players a reason to climb the leaderboard.
* **Concept**: Automate a weekly payout script that checks the community leaderboard at Sunday 23:59 UTC and uses the contract's operator key to distribute bonus CELO to the top 3 players (e.g., 1st: 1 CELO, 2nd: 0.5 CELO, 3rd: 0.25 CELO).

---

## 3. Marketing & GTM Strategy

Because WordPot runs on Celo and is optimized for MiniPay, your marketing should be hyper-focused on regions where MiniPay is popular (Nigeria, Kenya, Ghana, Uganda).

### Phase 1: MiniPay Directory Integration (Critical)
* **Goal**: Get featured in the Opera MiniPay DApp list.
* **Action**: Submit WordPot to the Celo/MiniPay developer portal. Since it has a working Daily Challenge that distributes real Celo, it fits the high-engagement category Opera looks for.

### Phase 2: Community Lobbies & Subsidized Tournaments
* **Goal**: Build initial traction and show users that payouts are real.
* **Action**:
  * Run **"WordPot Happy Hours"** (e.g., every Friday night).
  * The team funds a public lobby pool, creating rooms with 0.1 CELO entry fee but matching it with an extra 0.5 CELO from the treasury.
  * Share transaction hashes of the winners' payouts on Twitter/X and community groups. In Web3, **proof of payout** is the best marketing.

### Phase 3: Micro-Influencer & University Campaigns
* **Goal**: Acquire students and casual gamers.
* **Action**: 
  * Partner with campus Web3 leads or micro-influencers in Nigeria/Kenya to host local tournaments.
  * Provide them with a small budget (e.g., 10-20 CELO) to run a custom room tournament for their followers.

### Phase 4: Memetic & Visual Social Marketing
* **Goal**: Make high-scoring rounds shareable.
* **Action**: Add a "Share My Score" button at the end of the round that generates a clean image card showing their score, words found, and a QR code/link to play. Users love showing off their vocabulary/speed.
