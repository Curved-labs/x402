#!/usr/bin/env node
// Single payment with the zero-dependency client.
// No npm install needed. Only node:crypto.
//
//   node examples/pay-once.mjs https://api.example.com/resource
//
import { readFileSync } from "node:fs";
import { pay } from "../sdk/zero/client.mjs";

const url = process.argv[2];
if (!url) { console.error("usage: node pay-once.mjs <url>"); process.exit(1); }

const key = Uint8Array.from(JSON.parse(readFileSync("stage-wallet.json", "utf8")));

console.log(`paying ${url} ...`);
const res = await pay(key, url);
console.log(`${res.status} ${res.statusText}`);
if (res.ok) {
  const body = await res.text();
  console.log(body.slice(0, 500));
}
