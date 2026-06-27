# @curved/x402

TypeScript SDK for x402 payments on Solana.

## Install

```bash
npm install @curved/x402
```

## Modules

| Export | Description |
|---|---|
| `@curved/x402` | Full SDK: instruction builders, relay, wall middleware, CLI |
| `@curved/x402/zero` | Zero-dependency payer (node:crypto only) |
| `@curved/x402/wallet` | Agent wallet with spend policy |

## Usage: seller wall

```typescript
import { wall } from "@curved/x402";

app.use("/api/data", wall({
  payee: "SELLER_ADDRESS",
  mint: "USDC_MINT",
  amount: 100_000,
  rpc: "https://api.devnet.solana.com",
}));
```

## Usage: payer (zero dependencies)

```typescript
import { pay } from "@curved/x402/zero";

const res = await pay(secretKey, "https://api.example.com/data");
// res: standard Response, payment settled by payee
```

## Usage: agent wallet

```typescript
import { wallet } from "@curved/x402/wallet";

const fetch = wallet({
  keyFile: ".curved-key.json",
  policy: { maxPerCall: 100_000n, maxPerDay: 5_000_000n },
});

const res = await fetch("https://api.example.com/data");
// PolicyError if limits exceeded, BEFORE signing
```

## Build

```bash
npm install
npm run build
npm run typecheck
```
