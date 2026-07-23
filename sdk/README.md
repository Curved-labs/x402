# @curved/x402

TypeScript SDK for x402 payments on Solana.

## Install

Not on npm yet. Each release ships a tarball:

```bash
npm i https://github.com/Curved-labs/x402/releases/download/v0.5.1/curved-x402-0.5.1.tgz
```

If you only need to pay, you do not need this package at all. The payer is one
file with a single `node:crypto` import:

```bash
curl -O https://raw.githubusercontent.com/Curved-labs/x402/main/sdk/zero/client.mjs
```

## Modules

| Export | Description |
|---|---|
| `@curved/x402` | Full SDK: instruction builders, relay, wall middleware, CLI |
| `@curved/x402/zero` | Zero-dependency payer (node:crypto only) |
| `@curved/x402/wallet` | Agent wallet with spend policy |

The client-side policy above guards before signing. The rail also enforces an
on-chain cap set by the escrow authority (`setPolicyIx`), checked at
settlement, so a leaked key cannot spend past it:

```typescript
import { setPolicyIx, readPolicy } from "@curved/x402";

await send(conn, owner, [], [setPolicyIx(owner.publicKey,
  500_000n,     // 0.50 USDC per call, 0 = uncapped
  5_000_000n,   // 5.00 USDC per UTC day, 0 = uncapped
)]);
const policy = await readPolicy(conn, owner.publicKey);
```

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
