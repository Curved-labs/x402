#!/usr/bin/env node
// Express server with a payment wall on /api/data.
//
//   npm install express
//   PAYEE=<your-pubkey> node examples/wall-express.mjs
//
import express from "express";
import { wall } from "../sdk/src/wall.ts";

const PAYEE = process.env.PAYEE;
if (!PAYEE) { console.error("set PAYEE env var"); process.exit(1); }

const USDC_DEVNET = "9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz";

const app = express();

app.use("/api/data", wall({
  payee: PAYEE,
  mint: USDC_DEVNET,
  amount: 100_000,
  rpc: "https://api.devnet.solana.com",
}));

app.get("/api/data", (_req, res) => {
  res.json({ result: "paid content", ts: Date.now() });
});

app.listen(3000, () => console.log("listening on :3000"));
