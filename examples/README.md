# Examples

Runnable examples for x402 payments. All require a funded devnet wallet.

| File | Description |
|---|---|
| `pay-once.mjs` | Single payment with the zero-dependency client |
| `wall-express.mjs` | Express server with payment wall |
| `agent-budget.mjs` | Agent with daily spending budget (coming soon) |

## Setup

```bash
# create a devnet wallet
solana-keygen new -o stage-wallet.json --no-bip39-passphrase
solana airdrop 2 $(solana address -k stage-wallet.json) --url devnet
```
