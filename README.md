# x402sol

> Facilitator-less x402 payments on Solana
>
> Program ID: `12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y`

Facilitator-less x402 settlement on Solana.

## Status

SDK and on-chain program for facilitator-less x402 payments on Solana.

## SDK

```bash
npm install @curved/x402
```

Requires Node 20+.

## Quick start

1. `anchor build` to build the on-chain program
2. `cd sdk && npm install && npm run build` to build the SDK
3. `cd client && cargo build` to build the Rust client

## Docker

```bash
docker build -t x402-relay .
docker run -p 8080:8080 x402-relay
```

## Architecture

The agent pre-funds a non-custodial escrow, then signs off-chain authorizations for each payment. Nonces are tracked in a Permit2-style bitmap (1024 bits per window account) so concurrent settlements never collide.

Custody split: the authority (human) owns the money, the delegate (agent) borrows a revocable signature right. Setting the delegate to the zero pubkey revokes instantly.
