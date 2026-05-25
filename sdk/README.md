# @curved/x402

TypeScript SDK for the x402 settlement program.

## Install

```bash
npm install @curved/x402
```

## Modules

- `core.ts` - constants, PDAs, instruction builders, relay
- `protocol.ts` - wire format types (PaymentRequired, PaymentPayload)
- `client.ts` - payer-side fetch wrapper
- `server.ts` - payee-side quote builder
- `wall.ts` - Express/fetch middleware

## Usage

```typescript
import { openEscrowIx, depositIx, signAuthorization, relay } from '@curved/x402';
```
