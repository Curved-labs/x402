# x402-client

Rust client library and relay binaries for x402 settlement.

## Binaries

| Binary | Description |
|---|---|
| `s1` | Single-shot payment from CLI |
| `s2_http` | HTTP relay server (accepts authorization payloads, submits transactions) |
| `s3_relay` | Batch relay (reads authorizations from stdin) |

## Build

```bash
cargo build --release
```

This crate uses `solana-sdk 3.x` (agave) and lives in its own workspace, separate from the Anchor program workspace which uses `solana-program 2.x`.

## Library usage

```rust
use x402_client::{authorize, relay};

let auth = authorize(&keypair, &payee, &mint, amount, nonce, expiry);
let sig = relay(&rpc, &relayer, &auth).await?;
```
