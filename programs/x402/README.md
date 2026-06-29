# x402-settle

On-chain settlement program for facilitator-less x402 payments on Solana.

## Instructions

| Instruction | Signer | Description |
|---|---|---|
| `open_escrow` | authority | Create escrow PDA and set delegate key |
| `set_delegate` | authority | Rotate or revoke the agent's signing key |
| `deposit` | authority | Transfer SPL tokens from wallet to vault |
| `withdraw` | authority | Transfer SPL tokens from vault to wallet |
| `pay` | relayer (anyone) | Verify authorization and settle payment |

## Accounts

| Account | Seeds | Size |
|---|---|---|
| Escrow | `["escrow", authority]` | 73 bytes |
| NonceWindow | `["nonce", authority, window_index]` | 136 bytes |
| Vault | `["vault", escrow, mint]` | SPL TokenAccount |

## Security model

The program enforces three invariants:

1. The authorization was signed by the escrow's current delegate (Ed25519 precompile introspection).
2. The nonce has not been spent (bitmap check, fail-closed).
3. The current time is within `[valid_from, expiry]`.

A revoked delegate (set to `Pubkey::default`) immediately invalidates all outstanding authorizations without touching the nonce bitmap.

## Build

```bash
anchor build
```

Program ID: `12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y`
