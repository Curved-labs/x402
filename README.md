# x402sol

> Facilitator-less x402 payments on Solana

Facilitator-less x402 settlement on Solana.

## Status

Under active development. Program deployed on devnet.

## SDK

```bash
npm install @curved/x402
```

## Architecture

The agent pre-funds a non-custodial escrow, then signs off-chain authorizations for each payment. Nonces are tracked in a Permit2-style bitmap (1024 bits per window account) so concurrent settlements never collide.

Custody split: the authority (human) owns the money, the delegate (agent) borrows a revocable signature right. Setting the delegate to the zero pubkey revokes instantly.
