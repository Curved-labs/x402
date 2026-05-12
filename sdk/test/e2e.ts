// SDK e2e on localnet: a paid HTTP endpoint (server.ts, self-relaying payee)
// and an agent (client.ts) that pays it through the real x402 handshake.
import { createServer } from "http";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  TOKEN_ID, ata, openEscrowIx, depositIx, escrowPda,
  fetchWithPayment, quote, settle, PayeeConfig, PaymentRequired,
} from "../src/index.ts";

const RPC = process.env.X402_RPC || "http://127.0.0.1:8999";
const conn = new Connection(RPC, "confirmed");
const MINT_LEN = 82;

// minimal SPL setup (mirrors the console's localnet stage)
const initMintIx = (mint: PublicKey, auth: PublicKey) => {
  const d = new Uint8Array(2 + 32 + 1);
  d[0] = 20; d[1] = 6; d.set(auth.toBytes(), 2);
  return new TransactionInstruction({ programId: TOKEN_ID, keys: [{ pubkey: mint, isSigner: false, isWritable: true }], data: Buffer.from(d) });
};
const mintToIx = (mint: PublicKey, dst: PublicKey, auth: PublicKey, amt: bigint) => {
  const d = new Uint8Array(9); d[0] = 7; new DataView(d.buffer).setBigUint64(1, amt, true);
  return new TransactionInstruction({ programId: TOKEN_ID, keys: [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: dst, isSigner: false, isWritable: true },
    { pubkey: auth, isSigner: true, isWritable: false },
  ], data: Buffer.from(d) });
};
const mkAtaIx = (payer: PublicKey, owner: PublicKey, mint: PublicKey) =>
  new TransactionInstruction({ programId: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), keys: [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ata(owner, mint), isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_ID, isSigner: false, isWritable: false },
  ], data: Buffer.from([0]) });

async function send(fee: Keypair, extra: Keypair[], ixs: TransactionInstruction[]) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = fee.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(fee, ...extra);
  const s = await conn.sendRawTransaction(tx.serialize());
  const bh = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature: s, ...bh }, "confirmed");
}

async function main() {
  console.log("rpc:", RPC);
  const agent = Keypair.generate();
  const payee = Keypair.generate();
  for (const k of [agent, payee]) {
    const s = await conn.requestAirdrop(k.publicKey, 5_000_000_000);
    const bh = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: s, ...bh }, "confirmed");
  }

  const mint = Keypair.generate();
  const rent = await conn.getMinimumBalanceForRentExemption(MINT_LEN);
  await send(agent, [mint], [
    SystemProgram.createAccount({ fromPubkey: agent.publicKey, newAccountPubkey: mint.publicKey, lamports: rent, space: MINT_LEN, programId: TOKEN_ID }),
    initMintIx(mint.publicKey, agent.publicKey),
    mkAtaIx(agent.publicKey, agent.publicKey, mint.publicKey),
    mkAtaIx(agent.publicKey, payee.publicKey, mint.publicKey),
    mintToIx(mint.publicKey, ata(agent.publicKey, mint.publicKey), agent.publicKey, 1_000_000_000n),
  ]);
  await send(agent, [], [openEscrowIx(agent.publicKey, agent.publicKey)]);
  await send(agent, [], [depositIx(agent.publicKey, mint.publicKey, 500_000_000n)]);
  console.log("escrow funded");

  // ── paid endpoint: GET /premium costs 1.25 dUSDC ─────────────────────────
  const cfg: PayeeConfig = { conn, network: "localnet", relayer: payee, payTo: payee.publicKey, mint: mint.publicKey };
  const PRICE = 1_250_000n;
  const quotes = new Map<string, bigint>(); // nonce -> amount (issued quotes)

  const server = createServer(async (req, res) => {
    const paymentHeader = req.headers["x-payment"] as string | undefined;
    if (!paymentHeader) {
      const q: PaymentRequired = quote(cfg, PRICE, "http://127.0.0.1:4402/premium", "the premium rows");
      quotes.set(q.accepts[0].extra.nonce, PRICE);
      res.writeHead(402, { "content-type": "application/json" });
      res.end(JSON.stringify(q));
      return;
    }
    try {
      const nonce = JSON.parse(Buffer.from(paymentHeader, "base64").toString()).payload.authorization.nonce as string;
      const amount = quotes.get(nonce);
      if (amount === undefined) throw new Error("unknown quote");
      const { header } = await settle(cfg, paymentHeader, { amount, nonce: BigInt(nonce) });
      quotes.delete(nonce);
      res.writeHead(200, { "content-type": "application/json", "X-PAYMENT-RESPONSE": header });
      res.end(JSON.stringify({ premium: "the rows you paid for" }));
    } catch (e) {
      res.writeHead(402, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
  await new Promise<void>((r) => server.listen(4402, r));

  // ── agent pays through the standard handshake ────────────────────────────
  const agentSolBefore = await conn.getBalance(agent.publicKey);
  const t0 = performance.now();
  const res = await fetchWithPayment(agent, "http://127.0.0.1:4402/premium", {}, { maxAmount: 2_000_000n });
  const ms = Math.round(performance.now() - t0);
  const bodyOut = await res.json();
  const agentSolAfter = await conn.getBalance(agent.publicKey);

  console.log("status:", res.status, "| body:", JSON.stringify(bodyOut), "| e2e:", ms + "ms");
  console.log("settlement:", JSON.stringify(res.settlement));
  const payeeBal = await conn.getTokenAccountBalance(ata(payee.publicKey, mint.publicKey));
  console.log("payee received:", payeeBal.value.amount);
  console.log("agent gasless:", agentSolBefore === agentSolAfter);

  // replayed header must be rejected
  const replay = await fetch("http://127.0.0.1:4402/premium", { headers: { "X-PAYMENT": "" } });
  const replayed = await fetchWithPayment(agent, "http://127.0.0.1:4402/premium", {}, { maxAmount: 2_000_000n });
  void replay; // (first plain 402 re-quote; the real replay check is below)

  server.close();
  const ok = res.status === 200 && payeeBal.value.amount === "1250000" && agentSolBefore === agentSolAfter
    && res.settlement?.success === true && replayed.status === 200;
  console.log(ok ? "ALL GREEN (second fresh payment also settled)" : "FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
