# x402 settlement program

Anchor program for facilitator-less x402 payments.

## Account sizes

| Account | Size (bytes) |
|---|---|
| Escrow | 73 |
| NonceWindow | 136 |

## Instructions

- `open_escrow` - open a new escrow PDA
- `deposit` - fund the vault
- `withdraw` - withdraw from the vault
- `pay` - settle an authorized payment
