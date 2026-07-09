#!/usr/bin/env node
// Agent that pays for API calls within a daily budget.
//
//   node examples/agent-budget.mjs
//
import { wallet } from "../sdk/zero/wallet.mjs";

const fetch = wallet({
  keyFile: "stage-wallet.json",
  policy: {
    maxPerCall: 200_000n,
    maxPerDay: 2_000_000n,
    maxTotal: 50_000_000n,
    allow: ["api.example.com"],
  },
});

const urls = [
  "https://api.example.com/v1/price",
  "https://api.example.com/v1/depth",
  "https://api.example.com/v1/trades",
];

for (const url of urls) {
  try {
    const res = await fetch.wallet.fetch(url);
    console.log(`${url} -> ${res.status}`);
  } catch (e) {
    console.log(`${url} -> refused: ${e.message}`);
  }
}

console.log(`spent today: ${fetch.wallet.spentToday()}`);
console.log(`spent total: ${fetch.wallet.spentTotal()}`);
