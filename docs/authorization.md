# Authorization format

The payer signs a 143-byte message with Ed25519. This is not a Solana transaction. It has no blockhash, no fee payer, and no expiry other than the explicit field.

## Layout

| Offset | Length | Field | Type |
|---|---|---|---|
| 0 | 15 | Domain separator | `"X402SOL_AUTH_V1"` (ASCII) |
| 15 | 32 | Payer | Pubkey (escrow authority) |
| 47 | 32 | Payee | Pubkey (recipient) |
| 79 | 32 | Mint | Pubkey (SPL token) |
| 111 | 8 | Amount | u64 little-endian |
| 119 | 8 | Nonce | u64 little-endian |
| 127 | 8 | Valid from | i64 little-endian (0 = immediate) |
| 135 | 8 | Expiry | i64 little-endian (unix seconds) |

Total: 143 bytes.

## Signing

The payer signs the raw 143 bytes with Ed25519 `sign.detached()` (no prehash, no domain prefix beyond the built-in one). The signature is 64 bytes.

## Verification

The on-chain program does not receive the signature as an argument. Instead, the relayer includes an Ed25519 native program instruction immediately before the `pay` instruction. The program reads that instruction via sysvar introspection and verifies:

1. It references the same transaction (instruction index check).
2. The public key matches the escrow's delegate.
3. The message matches the reconstructed authorization from `pay`'s arguments.

This means the program trusts the Ed25519 precompile's verification, not its own crypto. The precompile runs in native code and is not billable.

## Why not a transaction

A Solana transaction requires a recent blockhash (valid ~60 seconds) and an RPC connection to fetch it. The detached signature has no blockhash field, so:

- The payer needs no RPC endpoint.
- The signature stays valid until the `expiry` field.
- The payer's client can be zero-dependency (no `@solana/web3.js`).
- A sandboxed LLM tool with no network access can still sign payments.
