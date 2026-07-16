# Nonce bitmap

Inspired by Uniswap's Permit2 unordered nonces.

## Problem

A simple incrementing nonce forces payments to settle in order. If payment #5 is delayed, #6 through #100 are stuck behind it. Per-nonce accounts (one PDA per payment) cost rent on every settlement.

## Solution

Nonces are grouped into windows of 1024. Each window is a single on-chain account containing a 128-byte bitmap (1024 bits). A nonce is "spent" by flipping its bit.

```
window_index = nonce / 1024
bit_index    = nonce % 1024
byte_index   = bit_index / 8
bit_mask     = 1 << (bit_index % 8)
```

The PDA is `["nonce", payer_pubkey, window_index_le_bytes]`.

## Properties

- Payments within the same window can settle in any order.
- Rent is paid once per window, not per payment. Over 1024 payments, the per-payment rent cost drops to ~1,794 lamports amortized.
- Replay protection: if the bit is already set, the program returns `NonceSpent` (6005).
- Cross-window payments write to different accounts, so they do not contend for write locks. In the 64-concurrent-payment test, same-window payments serialize while cross-window payments run fully parallel.

## Concurrency implications

All payments in the same 1024-nonce window write to the same PDA. Solana takes a write lock on that account for the duration of a transaction. Under high concurrency (tested with 64 simultaneous settlements), same-window payments will contend and some will fail with account lock errors. Cross-window payments do not contend.

For agents making many payments, spreading nonces across windows (e.g., using `Date.now() * 1000 + i * 1024`) avoids contention.
