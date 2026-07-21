<p align="center">
  <img src="banner.png" alt="CURVED x402" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Curved-labs/x402/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-0891b2?style=flat-square" alt="license" />
  </a>
  <a href="https://github.com/Curved-labs/x402/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/Curved-labs/x402/ci.yml?style=flat-square&label=ci&color=0891b2" alt="ci" />
  </a>
  <a href="https://github.com/Curved-labs/x402/releases">
    <img src="https://img.shields.io/github/v/release/Curved-labs/x402?style=flat-square&color=0891b2" alt="release" />
  </a>
  <a href="https://github.com/Curved-labs/x402/commits/main">
    <img src="https://img.shields.io/github/last-commit/Curved-labs/x402?style=flat-square&color=0891b2" alt="last commit" />
  </a>
  <a href="https://github.com/Curved-labs/x402/stargazers">
    <img src="https://img.shields.io/github/stars/Curved-labs/x402?style=flat-square&color=0891b2" alt="stars" />
  </a>
  <a href="https://github.com/Curved-labs/x402/issues">
    <img src="https://img.shields.io/github/issues/Curved-labs/x402?style=flat-square&color=0891b2" alt="issues" />
  </a>
  <a href="https://curved.dev">
    <img src="https://img.shields.io/badge/website-curved.dev-0891b2?style=flat-square" alt="website" />
  </a>
  <a href="#">
    <img src="https://img.shields.io/github/repo-size/Curved-labs/x402?style=flat-square&color=0891b2" alt="repo size" />
  </a>
</p>

x402 settlement on Solana. The payer signs a 143-byte authorization offline, not a transaction. No facilitator server, no account creation, no per-transaction fee. The on-chain program verifies and settles; any relayer, including the payee, can submit.

Original source lives in `programs/` and `sdk/`. Dependencies under `lib/` (if any) are vendored via git submodule.

---

## Why this exists

HTTP 402 (Payment Required) defines a standard negotiation for web payments. Existing implementations insert a facilitator server between payer and payee: the facilitator co-signs every transaction, gates access, and charges per call. If it refuses or goes offline, the payment cannot settle.

This program removes the facilitator. The payer signs a detached Ed25519 message instead of a Solana transaction, so it needs no RPC endpoint, no recent blockhash, and no chain connection at signing time. The on-chain program enforces what a facilitator would: signature validity against the escrow's delegate key, nonce uniqueness via a 1024-bit bitmap, time window enforcement, and SPL token transfer.

The result: a payment rail where the payer can be a sandboxed LLM tool, a CI job, or a browser extension with zero Solana dependencies. The payee can always self-relay, so no third party can censor a valid payment.

## What the 143 bytes buy you

| Property | Transaction-based (facilitator model) | Detached signature (this program) |
|---|---|---|
| Chain connection at signing | Required (needs recent blockhash) | Not required |
| Signature validity window | ~60 seconds (blockhash expiry) | Arbitrary (expiry field in auth) |
| Who can submit | Payer or facilitator | Anyone, including the payee |
| Payer-side dependencies | `@solana/web3.js`, RPC endpoint | `node:crypto` alone, or nothing |
| Censorship resistance | Facilitator can refuse | Payee self-relays, uncensorable |
| Per-transaction fee | Facilitator charges per call | Zero (gas only, ~6,800 lamports) |

## On-chain cost breakdown

| Component | Lamports | Notes |
|---|---|---|
| Signature (base fee) | 5,000 | Standard Solana tx fee |
| Nonce window rent (amortized) | ~1,794 | Paid once per 1024 payments |
| **Total per payment** | **~6,794** | No facilitator markup |

## Features

| Component | Status | Path |
|---|---|---|
| Settlement program | Stable | `programs/x402/` |
| TypeScript SDK | Stable | `sdk/src/` |
| Zero-dependency client | Stable | `sdk/zero/client.mjs` |
| Agent wallet with policy | Stable | `sdk/zero/wallet.mjs` |
| Wall middleware | Stable | `sdk/src/wall.ts` |
| CLI (escrow setup) | Beta | `sdk/src/cli.ts` |
| Rust client + relay | Alpha | `client/` |

## Architecture

```mermaid
sequenceDiagram
    participant Payer as Payer (offline)
    participant Seller as Seller (payee)
    participant Program as x402 Program
    participant Ed25519 as Ed25519 Precompile

    Payer->>Payer: sign 143-byte auth (Ed25519, no RPC)
    Payer->>Seller: HTTP request + X-PAYMENT header
    Seller->>Program: submit [ed25519_verify, pay] tx
    Program->>Ed25519: introspect prior instruction
    Ed25519-->>Program: signature valid for delegate key
    Program->>Program: check nonce bitmap, expiry, valid_from
    Program->>Seller: SPL transfer from vault to payee ATA
    Seller-->>Payer: HTTP 200 + resource
```

### Account layout

```
Escrow (PDA: ["escrow", authority])
  authority: Pubkey     // owner, can deposit/withdraw
  delegate:  Pubkey     // agent key, can sign authorizations
  bump:      u8

NonceWindow (PDA: ["nonce", authority, window_index])
  bits: [u8; 128]       // 1024 nonces per account

Vault (PDA: ["vault", escrow, mint])
  SPL TokenAccount       // holds payer's deposited tokens
```

## Authorization format (143 bytes)

```
 0..15   AUTH_DOMAIN     "X402SOL_AUTH_V1"
15..47   payer           Pubkey (escrow authority)
47..79   payee           Pubkey (recipient)
79..111  mint            Pubkey (SPL token mint)
111..119 amount          u64 LE
119..127 nonce           u64 LE
127..135 valid_from      i64 LE (0 = immediate)
135..143 expiry          i64 LE (unix seconds)
```

The payer signs these 143 bytes with Ed25519 (no prehash). The on-chain program reconstructs the same bytes from instruction arguments and verifies them against the delegate's public key via the Ed25519 native precompile.

## Build

```bash
git clone https://github.com/Curved-labs/x402.git
cd x402

# on-chain program (requires Anchor 0.31+)
anchor build

# TypeScript SDK
cd sdk && npm install && npm run build

# Rust client (separate workspace, uses agave SDK 3.x)
cd client && cargo build --release
```

The program crate (`programs/x402/`) and the Rust client (`client/`) live in separate workspaces because they target different Solana SDK major versions. The program uses `solana-program 2.x` (Anchor 0.31), the client uses `solana-sdk 3.x` (agave).

## Quick start

### Seller: protect an endpoint

```typescript
import { wall } from "@curved/x402";
import express from "express";

const app = express();

app.use("/api/premium", wall({
  payee: "SELLER_PUBKEY",
  mint: "USDC_MINT",
  amount: 100_000,           // 0.1 USDC (6 decimals)
  rpc: "https://api.devnet.solana.com",
}));

app.get("/api/premium", (req, res) => {
  res.json({ data: "paid content" });
});
// seller receives: { payee, mint, amount, signature, slot }
```

### Payer: pay with zero dependencies

```typescript
import { pay } from "@curved/x402/zero";

const response = await pay(secretKey, "https://api.example.com/premium");
// response is a standard fetch Response, already paid
// agent spent: 0 SOL (payee relayed the settlement)
```

### Payer: agent wallet with spend policy

```typescript
import { wallet } from "@curved/x402/wallet";

const fetch = wallet({
  keyFile: ".curved-key.json",
  policy: {
    maxPerCall:  100_000n,      // 0.1 USDC ceiling per request
    maxPerDay:   5_000_000n,    // 5 USDC daily budget
    allow: ["api.example.com"], // hostname allowlist
  },
});

const res = await fetch("https://api.example.com/premium");
// PolicyError thrown BEFORE signing if limits exceeded
// { amount: 100000n, allowed: false, reasons: ["over daily limit"] }
```

### Payer: set up escrow (CLI)

```bash
npx @curved/x402 init
# creates key, ATA, escrow, deposits, prints .env

npx @curved/x402 init --seller
# creates key + ATA only (no escrow needed for sellers)

npx @curved/x402 status
# USDC balance:  4.75 (escrow) / 0.25 (wallet)
# SOL balance:   0.02
# Can pay:       yes, for about 47 calls at 0.1 USDC
```

### On-chain: Rust client

```rust
use x402_client::{authorize, relay};

let auth = authorize(&agent_keypair, &payee, &mint, amount, nonce, expiry);
// auth.signature: 64 bytes, auth.message: 143 bytes

let sig = relay(&rpc, &relayer_keypair, &auth).await?;
// sig: base58 transaction signature, settled on-chain
```

## Test results

```
suite.ts          15/15  custody split, outsider sig, underpay, wrong payee,
                         replay, expiry, concurrent settlement, escrow overdraft,
                         revocation, HTTP wall, fetchWall

wallet.ts          8/8   per-call limit, daily limit, lifetime limit,
                         hostname allowlist, confirm hook, ledger persistence

concurrent.ts     64/64  same-window burst (313ms), cross-window burst,
                         balance reconciliation after parallel settlement

subscription.ts    4/4   valid_from enforcement, scheduled payment chains
```

## Project structure

```
x402/
  programs/x402/
    src/lib.rs                 settlement program
      open_escrow              create payer escrow + delegate
      set_delegate             rotate or revoke agent key
      deposit, withdraw        fund/drain the vault
      pay                      verify auth + check nonce + transfer
      verify_ed25519           introspect Ed25519 precompile instruction
      authorization            build the 143-byte message
    Cargo.toml
    Xargo.toml

  sdk/
    src/
      core.ts                  instruction builders, PDA derivation, relay
        escrowPda, vaultPda, noncePda, ata
        authorizationBytes, signAuthorization
        ed25519Ix, openEscrowIx, setDelegateIx
        depositIx, withdrawIx, payIx
        escrowDelegate, relay
      wall.ts                  seller middleware (express + fetch)
        check, wall, fetchWall
      cli.ts                   npx @curved/x402 init|status
      client.ts                payer-side x402 handshake
      protocol.ts              x402 quote/response types
      server.ts                server-side quote builder
      index.ts                 re-exports
    zero/
      client.mjs               zero-dependency payer (node:crypto only)
        buildPaymentHeader, pay
      client.d.mts             type declarations
      wallet.mjs               policy-bounded agent wallet
        Wallet, PolicyError, wallet
      wallet.d.mts             type declarations
    test/
      suite.ts                 15 integration tests
      wallet.ts                8 policy tests
      concurrent.ts            64-payment burst test
      subscription.ts          valid_from scheduling tests
      e2e.ts                   basic end-to-end
      wall-e2e.ts              wall middleware test
      fund.ts                  escrow funding helper

  client/
    src/
      lib.rs                   Rust authorization + verification
      main.rs                  single-shot payment binary (s1)
      bin/s2_http.rs           HTTP relay server
      bin/s3_relay.rs          batch relay binary

  idl/
    x402_settle.json           Anchor IDL

  examples/
    pay-once.mjs               single payment example
    wall-express.mjs           express server with wall
    agent-budget.mjs           agent with daily budget

  docs/
    authorization.md           143-byte format specification
    nonce-bitmap.md            Permit2-style nonce design
    custody-split.md           owner vs delegate key model
```

## Deployments

| Network | Program ID | Explorer |
|---|---|---|
| Devnet | `12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y` | [Solana Explorer](https://explorer.solana.com/address/12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y?cluster=devnet) |

## Error codes

| Code | Hex | Name | Cause |
|---|---|---|---|
| 6000 | 0x1770 | MissingSig | No Ed25519 verify instruction before pay |
| 6001 | 0x1771 | BadSigIx | Malformed Ed25519 instruction data |
| 6002 | 0x1772 | WrongSigner | Auth signed by wrong key (not escrow delegate) |
| 6003 | 0x1773 | WrongAuth | Auth fields do not match instruction args |
| 6004 | 0x1774 | Expired | Current time > expiry |
| 6005 | 0x1775 | NonceSpent | Nonce bit already set (replay) |
| 6006 | 0x1776 | NotAuthority | Caller is not the escrow authority |
| 6007 | 0x1777 | DelegateRevoked | Escrow delegate set to default pubkey |
| 6008 | 0x1778 | NotYetValid | Current time < valid_from |

## Performance

| Metric | Value | Conditions |
|---|---|---|
| Authorization signing | 3 ms | Ed25519, node:crypto, M-series Mac |
| Single settlement | 503 ms | Devnet, payer self-relay |
| 64 concurrent (same window) | 313 ms total | Same nonce window account |
| On-chain cost | 6,794 lamports | Signature + amortized nonce rent |
| Authorization size | 143 bytes | Fixed, no variable fields |
| Zero client bundle | 0 bytes npm | Only node:crypto import |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and PR guidelines.

## License

[MIT](LICENSE)

## Links

- Website: https://curved.dev
- GitHub: https://github.com/Curved-labs/x402
- Documentation: https://curved.dev/docs
