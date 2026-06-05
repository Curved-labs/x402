// Can one payer's payments actually settle at the same time?
//
// The nonce bitmap makes authorizations unordered, which is not the same as
// parallel: every payment in a 1024-nonce window writes the same account, and
// Solana takes a write lock on it for the duration of a transaction. So
// concurrency here is bounded by how fast that one account can be written,
// unless the payments fall in different windows.
//
// This measures both: a burst inside one window, and the same burst spread
// across windows.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "fs";
import {
  TOKEN_ID, ATA_ID, ata, escrowPda, vaultPda, openEscrowIx, depositIx,
  relay, signAuthorization, noncePda, NONCE_WINDOW_BITS, Authorization,
} from "../src/core.ts";

const RPC = process.env.X402_RPC || "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");
const LOCAL = RPC.includes("127.0.0.1") || RPC.includes("localhost");
const funder = LOCAL ? Keypair.generate() : Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
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
  tx.feePayer = fee.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(fee);
  const s = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: s, ...(await conn.getLatestBlockhash()) }, "confirmed");
}
const bal = async (a: PublicKey) => {
  const i = await conn.getAccountInfo(a);
  return i ? new DataView(i.data.buffer, i.data.byteOffset).getBigUint64(64, true) : 0n;
};

// On a local validator nothing exists yet: fund the funder and mint an asset,
// so the same test measures the program rather than a public RPC's rate limit.
let MINT: PublicKey;
if (LOCAL) {
  const sig = await conn.requestAirdrop(funder.publicKey, 100e9);
  await conn.confirmTransaction({ signature: sig, ...(await conn.getLatestBlockhash()) }, "confirmed");
  const m = Keypair.generate();
  const rent = await conn.getMinimumBalanceForRentExemption(82);
  const initMint = new TransactionInstruction({ programId: TOKEN_ID,
    keys: [{ pubkey: m.publicKey, isSigner: false, isWritable: true }],
    data: (() => { const d = new Uint8Array(2 + 32 + 1); d[0] = 20; d[1] = 6; d.set(funder.publicKey.toBytes(), 2); return Buffer.from(d); })() });
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: funder.publicKey, newAccountPubkey: m.publicKey, lamports: rent, space: 82, programId: TOKEN_ID }),
    initMint);
  tx.feePayer = funder.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(funder, m);
  const s2 = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: s2, ...(await conn.getLatestBlockhash()) }, "confirmed");
  MINT = m.publicKey;
} else {
  MINT = new PublicKey(process.env.X402_MINT || "9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz");
}

const agent = Keypair.generate(), seller = Keypair.generate();
console.log(`rpc ${RPC}\nmint ${MINT.toBase58()}\nstaging...`);
await send(funder, [
  SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: agent.publicKey, lamports: 40_000_000 }),
  SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: seller.publicKey, lamports: 60_000_000 }),
]);
await send(funder, [mkAta(funder.publicKey, agent.publicKey), mkAta(funder.publicKey, seller.publicKey),
                    mintTo(ata(agent.publicKey, MINT), funder.publicKey, 5_000_000n)]);
await send(agent, [openEscrowIx(agent.publicKey, agent.publicKey), depositIx(agent.publicKey, MINT, 5_000_000n)]);
const sellerAta = ata(seller.publicKey, MINT);

const N = Number(process.env.N || 8);
const base = BigInt(Date.now()) * 1000n;
const mk = (nonce: bigint): { a: Authorization; sig: Uint8Array } => {
  const a: Authorization = {
    payer: agent.publicKey, payee: seller.publicKey, mint: MINT, amount: 10_000n,
    nonce, validFrom: 0n, expiry: BigInt(Math.floor(Date.now() / 1000) + 300),
  };
  return { a, sig: signAuthorization(agent, a) };
};

async function burst(label: string, nonces: bigint[]) {
  const items = nonces.map(mk);
  const windows = new Set(nonces.map((n) => (n / NONCE_WINDOW_BITS).toString()));
  const before = await bal(sellerAta);
  const t = Date.now();
  const out = await Promise.allSettled(items.map(({ a, sig }) => relay(conn, seller, a, sig, agent.publicKey)));
  const ms = Date.now() - t;
  const okCount = out.filter((r) => r.status === "fulfilled").length;
  // A confirmed transaction is not instantly visible to a balance read, so wait
  // for the number to stop moving before believing it.
  let moved = 0n, stable = 0;
  for (let i = 0; i < 40 && stable < 3; i++) {
    const now = (await bal(sellerAta)) - before;
    stable = now === moved ? stable + 1 : 0;
    moved = now;
  }
  console.log(`\n${label}`);
  console.log(`  ${nonces.length} sent at once across ${windows.size} window account(s)`);
  console.log(`  ${okCount} settled, ${nonces.length - okCount} failed, ${ms}ms wall clock (${Math.round(ms / nonces.length)}ms each)`);
  console.log(`  seller received ${Number(moved) / 1e6} (expected ${okCount * 10_000 / 1e6})`);
  for (const r of out) if (r.status === "rejected") {
    const m = String(r.reason?.message ?? r.reason);
    console.log(`    failure: ${m.match(/0x[0-9a-f]+/)?.[0] ?? m.slice(0, 80)}`);
  }
  return okCount;
}

// all inside one window: every payment writes the same bitmap account
await burst("Same window", Array.from({ length: N }, (_, i) => base + BigInt(i)));

// spread across windows: a different account per payment, so no shared lock
await burst("Different windows", Array.from({ length: N }, (_, i) => base + BigInt(i) * NONCE_WINDOW_BITS + 500n));

console.log(`\nwindow account for nonce ${base}: ${noncePda(agent.publicKey, base).toBase58()}`);
console.log(`escrow left ${Number(await bal(vaultPda(escrowPda(agent.publicKey), MINT))) / 1e6}`);
