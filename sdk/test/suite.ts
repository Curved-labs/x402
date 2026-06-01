// The paths a real integration hits that the happy-path demos never touch:
// a bot key that is not the payer, a revoked bot, an underpaid or misdirected
// quote, a replayed header, an empty escrow, and several payments in flight at
// once. Runs against devnet, against the deployed program.
import { createServer, Server } from "http";
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import {
  TOKEN_ID, ATA_ID, ata, escrowPda, vaultPda, openEscrowIx, depositIx, setDelegateIx,
  escrowDelegate, relay, signAuthorization, Authorization,
} from "../src/core.ts";
import { check, fetchWall, WallConfig } from "../src/wall.ts";
import { makeRequirements, decodePaymentHeader } from "../src/protocol.ts";
import { pay, buildPaymentHeader } from "../zero/client.mjs";

const conn = new Connection(process.env.X402_RPC || "https://api.devnet.solana.com", "confirmed");
const MINT = new PublicKey(process.env.X402_MINT || "9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz");
const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  readFileSync(new URL("../../stage-wallet.json", import.meta.url).pathname, "utf8"))));

// ── plumbing ───────────────────────────────────────────────────────────────
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
  tx.feePayer = fee.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(fee);
  const s = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: s, ...(await conn.getLatestBlockhash()) }, "confirmed");
  return s;
}
const bal = async (a: PublicKey) => {
  const i = await conn.getAccountInfo(a);
  return i ? new DataView(i.data.buffer, i.data.byteOffset).getBigUint64(64, true) : 0n;
};
const usdc = (n: bigint) => (Number(n) / 1e6).toFixed(2);

const results: [string, boolean, string][] = [];
function ok(name: string, pass: boolean, note = "") {
  results.push([name, pass, note]);
  console.log(`${pass ? " PASS" : " FAIL"}  ${name}${note ? `\n        ${note}` : ""}`);
}
/// assert that something is refused, and report why it was refused
async function refused(name: string, fn: () => Promise<unknown>, expect?: string) {
  try { await fn(); ok(name, false, "it went through"); }
  catch (e) {
    const m = (e as Error).message;
    const code = m.match(/0x[0-9a-f]+/)?.[0];
    const matched = !expect || m.includes(expect) || code === expect;
    ok(name, matched, `refused with ${code ?? m.slice(0, 70)}`);
  }
}

// ── stage ──────────────────────────────────────────────────────────────────
const owner = Keypair.generate();   // holds the money
const bot = Keypair.generate();     // may only sign authorizations
const seller = Keypair.generate();
const other = Keypair.generate();   // a payee we never agreed to pay

console.log(`funder ${funder.publicKey.toBase58()}  ${(await conn.getBalance(funder.publicKey)) / 1e9} SOL\n`);
console.log("staging owner, bot key, seller...");
await send(funder, [
  SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: owner.publicKey, lamports: 40_000_000 }),
  SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: seller.publicKey, lamports: 40_000_000 }),
]);
await send(funder, [
  mkAta(funder.publicKey, owner.publicKey), mkAta(funder.publicKey, seller.publicKey),
  mkAta(funder.publicKey, other.publicKey),
  mintTo(ata(owner.publicKey, MINT), funder.publicKey, 5_000_000n),
]);
// the custody split the README promises: owner owns, bot signs
await send(owner, [openEscrowIx(owner.publicKey, bot.publicKey), depositIx(owner.publicKey, MINT, 5_000_000n)]);
const sellerAta = ata(seller.publicKey, MINT);
const vault = vaultPda(escrowPda(owner.publicKey), MINT);
console.log(`  escrow ${usdc(await bal(vault))}, delegate is the bot key\n`);

const cfg: WallConfig = { conn, network: "devnet", relayer: seller, payTo: seller.publicKey, mint: MINT, price: 250_000n };
const PAYER = { payer: owner.publicKey.toBase58() };
const nonce = () => BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
const auth = (over: Partial<Authorization> = {}): Authorization => ({
  payer: owner.publicKey, payee: seller.publicKey, mint: MINT,
  amount: 250_000n, nonce: nonce(), validFrom: 0n,
  expiry: BigInt(Math.floor(Date.now() / 1000) + 300), ...over,
});

// ── 1. the custody split actually works ────────────────────────────────────
{
  const d = await escrowDelegate(conn, owner.publicKey);
  ok("Escrow reports the bot as its delegate", !!d && d.equals(bot.publicKey), d?.toBase58());
  const a = auth();
  const before = await bal(sellerAta);
  await relay(conn, seller, a, signAuthorization(bot, a));   // no signer passed: looked up
  ok("Bot key can authorize, payer never signs", (await bal(sellerAta)) - before === 250_000n,
     `seller ${usdc(await bal(sellerAta))}`);
}

// ── 2. only the delegate may authorize ─────────────────────────────────────
{
  const a = auth();
  // the Ed25519 precompile rejects this before our program is reached, which is
  // why the code is the runtime's rather than one of ours
  await refused("An outsider's signature is refused",
    () => relay(conn, seller, a, signAuthorization(other, a), bot.publicKey));
}

// ── 3. the wall's own checks, before anything reaches the chain ────────────
{
  const q = makeRequirements({ network: "devnet", amount: 250_000n, mint: MINT, payTo: seller.publicKey, resource: "/x" });
  const quote = q.accepts[0];

  const cheap = { ...quote, maxAmountRequired: "1000" };
  await refused("Underpaying is refused",
    () => check(cfg, "/x", buildPaymentHeader(bot.secretKey, cheap, PAYER)), "underpaid");

  const elsewhere = { ...quote, payTo: other.publicKey.toBase58() };
  await refused("Paying a different payee is refused",
    () => check(cfg, "/x", buildPaymentHeader(bot.secretKey, elsewhere, PAYER)), "payee mismatch");

  // a header that is valid, used once, then presented again
  const header = buildPaymentHeader(bot.secretKey, quote, PAYER);
  const first = await check(cfg, "/x", header);
  ok("A good payment is served", first.paid === true,
     first.paid ? `settled ${first.settlement.transaction.slice(0, 16)}…` : "");
  await refused("Replaying the same header is refused", () => check(cfg, "/x", header), "0x1775");
}

// ── 4. expiry ──────────────────────────────────────────────────────────────
{
  const a = auth({ expiry: BigInt(Math.floor(Date.now() / 1000) - 60) });
  await refused("An expired authorization is refused",
    () => relay(conn, seller, a, signAuthorization(bot, a), bot.publicKey), "0x1774");
}

// ── 5. several in flight at once, settled out of order ─────────────────────
{
  const batch = [3, 1, 2].map(() => { const a = auth({ amount: 100_000n }); return { a, sig: signAuthorization(bot, a) }; });
  const before = await bal(sellerAta);
  for (const { a, sig } of batch.reverse()) await relay(conn, seller, a, sig, bot.publicKey);
  ok("Three authorizations settle in any order", (await bal(sellerAta)) - before === 300_000n,
     `nonces far apart, no ordering constraint`);
}

// ── 6. an empty escrow fails clearly rather than silently ──────────────────
{
  const left = await bal(vault);
  const a = auth({ amount: left + 1_000_000n });
  await refused("Spending more than the escrow holds is refused",
    () => relay(conn, seller, a, signAuthorization(bot, a), bot.publicKey));
}

// ── 7. revocation stops everything outstanding ─────────────────────────────
{
  const a = auth();
  const sig = signAuthorization(bot, a);            // signed BEFORE the revoke
  await send(owner, [setDelegateIx(owner.publicKey, PublicKey.default)]);
  await refused("Revoking the bot kills authorizations already signed",
    () => relay(conn, seller, a, sig, bot.publicKey), "0x1777");
  await send(owner, [setDelegateIx(owner.publicKey, bot.publicKey)]);
}

// ── 8. the wall over real HTTP, with the dependency-free payer ─────────────
{
  const server: Server = createServer(async (req, res) => {
    const r = await check(cfg, req.url!, req.headers["x-payment"] as string | undefined).catch((e) => e as Error);
    if (r instanceof Error) return void res.writeHead(402).end(JSON.stringify({ error: r.message }));
    if (!r.paid) return void res.writeHead(402, { "content-type": "application/json" }).end(JSON.stringify(r.body));
    res.writeHead(200, { "content-type": "application/json", "X-PAYMENT-RESPONSE": r.header });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((go) => server.listen(8403, go));
  const before = await bal(sellerAta);
  const res = await pay(bot.secretKey, "http://127.0.0.1:8403/premium", {}, PAYER);
  const body = await res.json();
  ok("Paid over HTTP by a payer with no dependencies",
     res.status === 200 && body.ok === true && (await bal(sellerAta)) - before === 250_000n,
     `${res.status}, seller +0.25`);
  server.close();
}

// ── 9. the fetch-style wall, for Hono, workers, Bun and Deno ───────────────
{
  const handler = fetchWall(cfg, async (_req, settlement) =>
    new Response(JSON.stringify({ paidBy: settlement.payer }), { headers: { "content-type": "application/json" } }));

  const unpaid = await handler(new Request("https://x.dev/premium"));
  const quoteBody = await unpaid.json();
  ok("fetchWall quotes an unpaid request", unpaid.status === 402 && quoteBody.accepts?.[0]?.scheme === "curved-relay",
     `${unpaid.status}, ${quoteBody.accepts?.[0]?.maxAmountRequired}`);

  const header = buildPaymentHeader(bot.secretKey, quoteBody.accepts[0], PAYER);
  const before = await bal(sellerAta);
  const paid = await handler(new Request("https://x.dev/premium", { headers: { "X-PAYMENT": header } }));
  const body = await paid.json();
  ok("fetchWall settles and serves", paid.status === 200 && body.paidBy === owner.publicKey.toBase58()
     && !!paid.headers.get("X-PAYMENT-RESPONSE") && (await bal(sellerAta)) - before === 250_000n,
     `${paid.status}, X-PAYMENT-RESPONSE set, seller +0.25`);

  const replay = await handler(new Request("https://x.dev/premium", { headers: { "X-PAYMENT": header } }));
  ok("fetchWall refuses a replay with 402", replay.status === 402, `${replay.status}`);
}

console.log(`\n${results.filter((r) => r[1]).length}/${results.length} passed`);
console.log(`escrow left ${usdc(await bal(vault))}, seller collected ${usdc(await bal(sellerAta))}`);
if (results.some((r) => !r[1])) process.exit(1);
