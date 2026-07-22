# Smart Contract Escrow and Settlement Protocol

`WordPotArena.sol` manages decentralized escrow pools for room-based word matches on Celo Mainnet.

## Escrow Lifecycle

```
[1. Room Created] --------> [2. Players Join & Pay Fee] --------> [3. Game Settled]
  - Room ID assigned          - CELO stored in contract             - 90% paid to winners
  - Entry fee specified       - Paid status verified                - 10% paid to treasury
```

## Key Contract Functions

### `createRoom(bytes32 roomId, uint256 entryFee)`
* Registers a new room onchain.
* Enforces fee thresholds to prevent zero-value spam rooms.

### `joinRoom(bytes32 roomId) payable`
* Requires `msg.value == entryFee`.
* Records participant address in `roomPlayers[roomId]`.
* Reverts if room status is not `Lobby` or max capacity is reached.

### `settleRoom(bytes32 roomId, address[] calldata winners, uint256[] calldata scores)`
* Executed by authorized contract operator key after round ends.
* Calculates payouts:
  $$\text{Payout}_i = \frac{\text{Score}_i}{\sum \text{Score}} \times (\text{Total Pool} \times 0.90)$$
* Transfers 10% of total pool to `treasuryAddress`.
* Emits `RoomSettled(roomId, totalPool, treasuryFee)`.

### Emergency Expiry & Refund
If a room fails to start within the 4-minute lobby window, players can trigger `claimRefund(roomId)` to reclaim 100% of their staked entry fee.
