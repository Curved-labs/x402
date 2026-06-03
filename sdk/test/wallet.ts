// The wallet's job is to refuse. These are the refusals.
import { createServer } from "http";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { TOKEN_ID, ATA_ID, ata, escrowPda, vaultPda, openEscrowIx, depositIx } from "../src/core.ts";
import { check, WallConfig } from "../src/wall.ts";
import { Wallet, PolicyError } from "../zero/wallet.mjs";

const conn = new Connection(process.env.X402_RPC || "https://api.devnet.solana.com", "confirmed");
const MINT = new PublicKey(process.env.X402_MINT || "9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz");
const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  readFileSync(new URL("../../stage-wallet.json", import.meta.url).pathname, "utf8"))));

const mkAta = (p: PublicKey, o: PublicKey) => new TransactionInstruction({ programId: ATA_ID, keys: [
  { pubkey: p, isSigner: true, isWritable: true }, { pubkey: ata(o, MINT), isSigner: false, isWritable: true },
  { pubkey: o, isSigner: false, isWritable: false }, { pubkey: MINT, isSigner: false, isWritable: false },
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  { pubkey: TOKEN_ID, isSigner: false, isWritable: false }], data: Buffer.from([1]) });
const mintTo = (dst: PublicKey, auth: PublicKey, amt: bigint) => {
  const d = new Uint8Array(9); d[0] = 7; new DataView(d.buffer).setBigUint64(1, amt, true);
  return new TransactionInstruction({ programId: TOKEN_ID, keys: [
    { pubkey: MINT, isSigner: false, isWritable: true }, { pubkey: dst, isSigner: false, isWritable: true },
    { pubkey: auth, isSigner: true, isWritable: false }], data: Buffer.from(d) });
};
async function send(fee: Keypair, ixs: TransactionInstruction[]) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = fee.publicKey; tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash; tx.sign(fee);
  const s = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: s, ...(await conn.getLatestBlockhash()) }, "confirmed");
}
const bal = async (a: PublicKey) => { const i = await conn.getAccountInfo(a);
  return i ? new DataView(i.data.buffer, i.data.byteOffset).getBigUint64(64, true) : 0n; };

const results: [string, boolean, string][] = [];
const ok = (n: string, p: boolean, note = "") => { results.push([n, p, note]); console.log(`${p ? " PASS" : " FAIL"}  ${n}${note ? `\n        ${note}` : ""}`); };

const agent = Keypair.generate(), seller = Keypair.generate();
console.log("staging...");
await send(funder, [
  SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: agent.publicKey, lamports: 30_000_000 }),
  SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: seller.publicKey, lamports: 30_000_000 })]);
await send(funder, [mkAta(funder.publicKey, agent.publicKey), mkAta(funder.publicKey, seller.publicKey),
                    mintTo(ata(agent.publicKey, MINT), funder.publicKey, 3_000_000n)]);
await send(agent, [openEscrowIx(agent.publicKey, agent.publicKey), depositIx(agent.publicKey, MINT, 3_000_000n)]);
const sellerAta = ata(seller.publicKey, MINT);

const cfg: WallConfig = { conn, network: "devnet", relayer: seller, payTo: seller.publicKey, mint: MINT, price: 200_000n };
const server = createServer(async (req, res) => {
  const r = await check(cfg, req.url!, req.headers["x-payment"] as string | undefined).catch((e) => e as Error);
  if (r instanceof Error) return void res.writeHead(402).end(JSON.stringify({ error: r.message }));
  if (!r.paid) return void res.writeHead(402, { "content-type": "application/json" }).end(JSON.stringify(r.body));
  res.writeHead(200, { "content-type": "application/json", "X-PAYMENT-RESPONSE": r.header }).end(JSON.stringify({ ok: true }));
});
await new Promise<void>((go) => server.listen(8405, go));

const KEY = "/tmp/curved-wallet-test.json", LEDGER = "/tmp/curved-wallet-test-spend.json";
for (const f of [KEY, LEDGER]) { try { unlinkSync(f); } catch {} }
writeFileSync(KEY, JSON.stringify(Array.from(agent.secretKey)));
const URL_ = "http://127.0.0.1:8405/premium";

// too expensive for one call
{
  const w = new Wallet({ keyFile: KEY, policy: { maxPerCall: 1000n } });
  const before = await bal(sellerAta);
  let threw: unknown;
  try { await w.fetch(URL_); } catch (e) { threw = e; }
  ok("Refuses a quote over the per-call limit",
     threw instanceof PolicyError && (await bal(sellerAta)) === before,
     `${(threw as Error)?.message}`);
  ok("Nothing was signed when it refused", w.history().length === 0);
}
// host not allowed
{
  const w = new Wallet({ keyFile: KEY, policy: { allow: ["api.example.com"] } });
  let threw: unknown;
  try { await w.fetch(URL_); } catch (e) { threw = e; }
  ok("Refuses a host that is not allowed", threw instanceof PolicyError, `${(threw as Error)?.message}`);
}
// a good one, then the daily cap bites
{
  const w = new Wallet({ keyFile: KEY, ledgerFile: LEDGER, policy: { maxPerCall: 500_000n, maxPerDay: 300_000n } });
  const before = await bal(sellerAta);
  const res = await w.fetch(URL_);
  ok("Pays when the policy allows it", res.status === 200 && (await bal(sellerAta)) - before === 200_000n,
     `spent today ${w.spentToday()}, tx ${w.history()[0]?.transaction?.slice(0, 12)}…`);

  let threw: unknown;
  try { await w.fetch(URL_); } catch (e) { threw = e; }
  ok("The second call crosses the daily cap and is refused",
     threw instanceof PolicyError && w.history().length === 1, `${(threw as Error)?.message}`);
}
// the ledger survives a restart, so the cap is not reset by rebooting the bot
{
  const w = new Wallet({ keyFile: KEY, ledgerFile: LEDGER, policy: { maxPerDay: 300_000n } });
  ok("Spending is remembered across restarts", w.spentToday() === 200_000n && w.history().length === 1,
     `reloaded ${w.history().length} entry, ${w.spentToday()} spent`);
}
// confirm() as a final gate
{
  const w = new Wallet({ keyFile: KEY, policy: { confirm: async () => false } });
  let threw: unknown;
  try { await w.fetch(URL_); } catch (e) { threw = e; }
  ok("confirm() can veto a payment the limits allowed", threw instanceof PolicyError);
}
// inspect() explains without paying
{
  const w = new Wallet({ keyFile: KEY, policy: { maxPerCall: 100n } });
  const q = { maxAmountRequired: "200000", scheme: "curved-relay" } as never;
  const v = w.inspect(q, "127.0.0.1");
  ok("inspect() explains a refusal without spending", !v.allowed && v.reasons.length === 1, v.reasons[0]);
}

server.close();
console.log(`\n${results.filter((r) => r[1]).length}/${results.length} passed`);
console.log(`escrow left ${Number(await bal(vaultPda(escrowPda(agent.publicKey), MINT))) / 1e6}`);
if (results.some((r) => !r[1])) process.exit(1);
