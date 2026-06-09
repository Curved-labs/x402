# @curved/x402

TypeScript SDK for the x402 settlement program.

## Install

```bash
npm install @curved/x402
```

The SDK is ESM-only. Node 20+ required.

## Modules

- `core.ts` - constants, PDAs, instruction builders, relay
- `protocol.ts` - wire format types (PaymentRequired, PaymentPayload)
- `client.ts` - payer-side fetch wrapper
- `server.ts` - payee-side quote builder
- `wall.ts` - Express/fetch middleware
- `cli.ts` - escrow init and status CLI

## Testing

```bash
npm run test:suite      # integration suite
npm run test:wall       # wall middleware e2e
npm test                # localnet e2e
```

## Usage

```typescript
import { openEscrowIx, depositIx, signAuthorization, relay } from '@curved/x402';
```
