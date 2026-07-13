# x402sol

> Facilitator-less x402 payments on Solana
>
> Program ID: `12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y`

Facilitator-less x402 settlement on Solana.

## Overview

SDK and on-chain program for facilitator-less x402 payments on Solana. The payer pre-funds a non-custodial escrow once. The agent signs off-chain authorizations. Any relayer settles them. No trusted server can refuse a valid payment.

## SDK

```bash
npm install @curved/x402
```

### Wall middleware

Drop a paywall in front of any Express route:

```typescript
import { wall } from '@curved/x402';
app.use('/api', wall(config));
```

Requires Node 20+.

## Tests

```bash
make test       # 15-case integration suite
make test-all   # suite + wallet policy + 64-concurrent burst
```

All tests run on a local validator. The concurrent test settles 64 payments in parallel across bitmap windows.

## Quick start

```bash
# build
anchor build
cd sdk && npm install && npm run build
cd client && cargo build

# test
make test
```

## Docker

```bash
docker build -t x402-relay .
docker run -e RPC=https://api.devnet.solana.com -p 8080:8080 x402-relay
```

## Project structure

```
programs/x402/  - on-chain Anchor program
sdk/            - TypeScript SDK
client/         - Rust client library and example binaries
examples/       - usage examples
docs/           - specification documents
```

## Error codes

| Code | Name | Description |
|---|---|---|
| 6000 | MissingSig | Missing Ed25519 verification instruction |
| 6001 | BadSigIx | Malformed Ed25519 instruction |
| 6002 | WrongSigner | Authorization not signed by the payer |
| 6003 | WrongAuth | Authorization does not match this payment |
| 6004 | Expired | Authorization expired |
| 6005 | NonceSpent | Authorization already spent |
| 6006 | NotAuthority | Not the escrow authority |
| 6007 | DelegateRevoked | The delegate has been revoked |

## Performance

| Metric | Value |
|---|---|
| Settlement latency | ~503ms (devnet) |
| Authorization size | 143 bytes |
| Concurrent capacity | 1024 per window |
| valid_from support | Yes (scheduled payments) |

## Security model

The on-chain program is the facilitator. No off-chain server can block a settlement. The payee can always self-relay.

## Zero-dependency client

The payer needs zero npm dependencies. `@curved/x402/zero` uses only `node:crypto` for Ed25519 signing.

## Agent wallet

Budget enforcement: per-call, daily, lifetime limits. Hostname allowlist. Persistent ledger.

## Architecture

The agent pre-funds a non-custodial escrow, then signs off-chain authorizations for each payment. Nonces are tracked in a Permit2-style bitmap (1024 bits per window account) so concurrent settlements never collide.

Custody split: the authority (human) owns the money, the delegate (agent) borrows a revocable signature right. Setting the delegate to the zero pubkey revokes instantly.
