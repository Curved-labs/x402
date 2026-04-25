# x402sol

Facilitator-less x402 settlement on Solana.

## Status

Under active development. Program deployed on devnet.

## Architecture

The agent pre-funds a non-custodial escrow, then signs off-chain authorizations for each payment. Nonces are tracked in a Permit2-style bitmap (1024 bits per window account) so concurrent settlements never collide.
