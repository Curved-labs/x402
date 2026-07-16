# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-07-21

### Fixed

- `relay()` now reads `confirmTransaction.value.err` and throws on settlement failure. Previously, a failed on-chain settlement was reported as successful, causing the wall to serve resources without payment.
- Zero client type declarations changed from `.d.ts` to `.d.mts` so TypeScript consumers get proper types instead of `any`.

## [0.4.0] - 2026-07-18

### Added

- `valid_from` field in authorization (143 bytes, up from 135). Enables scheduled payments where a stack of pre-signed authorizations cannot all be pulled on day one.
- `NotYetValid` error code (6008 / 0x1778).
- Agent wallet (`sdk/zero/wallet.mjs`) with per-call, daily, and lifetime spend limits, hostname allowlist, confirm hook, and persistent ledger.
- Wall middleware (`sdk/src/wall.ts`): `wall()` for Express, `fetchWall()` for Hono/Workers/Deno. Stateless, no server-side nonce tracking.
- CLI (`npx @curved/x402 init`, `status`).
- Concurrent settlement test (64 payments, same-window and cross-window).
- Subscription test (valid_from enforcement).

### Changed

- `relay()` accepts optional `signer` parameter for cases where the delegate is known.
- Zero client `buildPaymentHeader()` accepts `opts.payer` for custody split.

## [0.3.0] - 2026-06-28

### Added

- Custody split: `open_escrow` takes a `delegate` key. The delegate can sign authorizations but cannot withdraw. `set_delegate` rotates or revokes.
- `escrowDelegate()` function to read the delegate from an escrow account.
- Nonce bitmap: 1024-bit windows replace per-nonce accounts. Rent is amortized ~1000x.
- Ed25519 precompile instruction introspection replaces signature deserialization.

### Changed

- Authorization format now includes `payer` field (was implicit from signer).
- `pay` instruction uses instruction introspection instead of receiving the signature as an argument.

## [0.2.0] - 2026-05-15

### Added

- Rust client library and relay binaries (s1, s2_http, s3_relay).
- TypeScript SDK with instruction builders and relay function.
- Devnet deployment.

## [0.1.0] - 2026-04-12

### Added

- Initial settlement program with basic escrow, deposit, withdraw, and pay.
- Ed25519 signature verification for off-chain authorizations.
