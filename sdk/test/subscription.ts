// Can this rail do what card rails do and chains cannot: PULL payments?
//
// A subscriber signs 12 monthly authorizations once, offline, then goes away.
// The merchant charges each month on its own schedule. Nothing on chain is
// scheduled; the merchant simply holds 12 signatures and spends one per month.
//
// This test asks four questions the subscription use case lives or dies on:
//   1. unordered    can month 5 settle before month 1? (bitmap nonces)
//   2. early charge  can the merchant charge month 12 on day one?
//   3. cancellation  does revoking the agent key kill the unspent months?
//   4. replay        can the merchant charge the same month twice?
//
// Runs against devnet with the existing demo mint. Read-only on the program:
// no new instructions, this is the rail as deployed.
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import { Buffer } from "buffer";
import {
  TOKEN_ID, ata, escrowPda, vaultPda, openEscrowIx, depositIx, setDelegateIx,
  payIx, ed25519Ix, authorizationBytes, signAuthorization, Authorization,
} from "../src/core.ts";

const RPC = process.env.X402_RPC || "https://api.devnet.solana.com";
const MINT = new PublicKey(process.env.X402_MINT || "9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz");
const conn = new Connection(RPC, "confirmed");

const load = (p: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
const usdc = (n: bigint) => (Number(n) / 1e6).toFixed(2);
const MONTH = 30 * 24 * 60 * 60;

const mintToIx = (dst: PublicKey, auth: PublicKey, amt: bigint) => {
  const d = new Uint8Array(9); d[0] = 7; new DataView(d.buffer).setBigUint64(1, amt, true);
  return new TransactionInstruction({ programId: TOKEN_ID, keys: [
    { pubkey: MINT, isSigner: false, isWritable: true },
    { pubkey: dst, isSigner: false, isWritable: true },
    { pubkey: auth, isSigner: true, isWritable: false },
  ], data: Buffer.from(d) });
};
const mkAtaIx = (payer: PublicKey, owner: PublicKey) =>
  new TransactionInstruction({ programId: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), keys: [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ata(owner, MINT), isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: MINT, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_ID, isSigner: false, isWritable: false },
  ], data: Buffer.from([1]) });

async function send(fee: Keypair, extra: Keypair[], ixs: TransactionInstruction[]) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = fee.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(fee, ...extra);
  const s = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: s, ...(await conn.getLatestBlockhash()) }, "confirmed");
  return s;
}

const balance = async (acct: PublicKey) => {
  const i = await conn.getAccountInfo(acct);
  return i ? new DataView(i.data.buffer, i.data.byteOffset).getBigUint64(64, true) : 0n;
};

/// Charge one pre-signed month. The merchant is the fee payer AND the relayer:
/// nobody else is involved, which is the whole point of a pull payment.
async function charge(merchant: Keypair, delegate: PublicKey, a: Authorization, sig: Uint8Array) {
  const tx = new Transaction().add(
    ed25519Ix(delegate.toBytes(), sig, authorizationBytes(a)),
    payIx(merchant.publicKey, a),
  );
  tx.feePayer = merchant.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(merchant);
  const s = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: s, ...(await conn.getLatestBlockhash()) }, "confirmed");
  return s;
}

const results: [string, boolean, string][] = [];
const check = (name: string, pass: boolean, note: string) => {
  results.push([name, pass, note]);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${note}`);
};

async function main() {
  const funder = load(new URL("../../stage-wallet.json", import.meta.url).pathname);
  console.log(`rpc     ${RPC}\nmint    ${MINT.toBase58()}\nfunder  ${funder.publicKey.toBase58()}  ${(await conn.getBalance(funder.publicKey)) / 1e9} SOL\n`);

  // The subscriber owns the money. The agent key only signs authorizations and
  // can never withdraw, so handing 12 signatures to a merchant risks nothing else.
  const subscriber = Keypair.generate();
  const agent = Keypair.generate();
  const merchant = Keypair.generate();

  console.log("Staging subscriber, agent key and merchant...");
  await send(funder, [], [
    SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: subscriber.publicKey, lamports: 40_000_000 }),
    SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: merchant.publicKey, lamports: 40_000_000 }),
  ]);
  await send(funder, [], [
    mkAtaIx(funder.publicKey, subscriber.publicKey),
    mkAtaIx(funder.publicKey, merchant.publicKey),
    mintToIx(ata(subscriber.publicKey, MINT), funder.publicKey, 120_000_000n),
  ]);

  // one on-chain setup, then the subscriber never signs a transaction again
  await send(subscriber, [], [
    openEscrowIx(subscriber.publicKey, agent.publicKey),
    depositIx(subscriber.publicKey, MINT, 120_000_000n),
  ]);
  const vault = vaultPda(escrowPda(subscriber.publicKey), MINT);
  const merchantAta = ata(merchant.publicKey, MINT);
  console.log(`  escrow funded ${usdc(await balance(vault))} dUSDC, merchant at ${usdc(await balance(merchantAta))}\n`);

  // ── the offline moment: 12 months signed at once, no RPC, no transaction ──
  const now = Math.floor(Date.now() / 1000);
  const base = BigInt(now) * 1000n; // nonce space unique to this run
  const months = Array.from({ length: 12 }, (_, i) => {
    const a: Authorization = {
      payer: subscriber.publicKey, payee: merchant.publicKey, mint: MINT,
      amount: 10_000_000n, nonce: base + BigInt(i),
      // month 1 is due now; each later month unlocks 30 days after the one before
      validFrom: BigInt(now + i * MONTH), expiry: BigInt(now + (i + 2) * MONTH),
    };
    return { n: i + 1, a, sig: signAuthorization(agent, a) };
  });
  console.log(`Signed 12 monthly authorizations offline: ${authorizationBytes(months[0].a).length} bytes each, ${12 * 64} bytes of signature total.`);
  console.log(`Each month unlocks 30 days after the last; month 12 opens ${new Date((now + 11 * MONTH) * 1000).toISOString().slice(0, 10)}.\n`);

  // 1. out of order. Only month 1 has unlocked, so the ordering property is
  // shown with three charges that are all due now but numbered far apart, the
  // way three services billing the same subscriber would be. Settled
  // highest-numbered first: a sequential counter could not do this.
  const dueNow = [900n, 400n, 7n].map((k) => {
    const a: Authorization = { ...months[0].a, nonce: base + 100n + k, amount: 1_000_000n, validFrom: 0n };
    return { a, sig: signAuthorization(agent, a) };
  });
  let ok = true, ms = 0;
  for (const { a, sig } of [...dueNow, months[0]].map((x: any) => ({ a: x.a, sig: x.sig }))) {
    const t = Date.now();
    try { await charge(merchant, agent.publicKey, a, sig); ms += Date.now() - t; }
    catch (e) { ok = false; console.log(`      nonce ${a.nonce - base} failed: ${(e as Error).message.slice(0, 90)}`); }
  }
  check("Unordered capture", ok && (await balance(merchantAta)) === 13_000_000n,
    `Settled nonces ${dueNow.map((d) => d.a.nonce - base).join(", ")} in descending order, then month 1. Merchant holds ${usdc(await balance(merchantAta))} dUSDC, avg ${Math.round(ms / 4)}ms per charge.`);

  // 2. THE question for subscriptions: is a future month spendable today?
  let early = "rejected";
  try {
    await charge(merchant, agent.publicKey, months[10].a, months[10].sig);
    early = "SETTLED";
  } catch (e) { early = `rejected with ${(e as Error).message.match(/0x[0-9a-f]+/)?.[0] ?? "an error"}`; }
  check("Future month is not chargeable early", early !== "SETTLED",
    `Merchant tried to pull month 11 (due in ${10 * 30} days) on day one: ${early}.`);

  // 3. cancel: one transaction from the authority, every unspent month dies
  await send(subscriber, [], [setDelegateIx(subscriber.publicKey, PublicKey.default)]);
  let cancelled = false, code = "";
  const spendable = { ...months[6].a, validFrom: 0n };
  const spendableSig = signAuthorization(agent, spendable);
  try { await charge(merchant, agent.publicKey, spendable, spendableSig); }
  catch (e) { cancelled = true; code = (e as Error).message.match(/0x[0-9a-f]+/)?.[0] ?? "error"; }
  check("Cancellation kills unspent months", cancelled,
    `Subscriber revoked the agent key in one transaction. Month 7 then ${cancelled ? `failed with ${code}` : "still settled"}.`);

  // 4. same month twice
  await send(subscriber, [], [setDelegateIx(subscriber.publicKey, agent.publicKey)]);
  let replayed = false, rcode = "";
  try { await charge(merchant, agent.publicKey, months[0].a, months[0].sig); replayed = true; }
  catch (e) { rcode = (e as Error).message.match(/0x[0-9a-f]+/)?.[0] ?? "error"; }
  check("Double charge rejected", !replayed,
    `Merchant re-submitted month 1 after the key was restored: ${replayed ? "SETTLED TWICE" : `rejected with ${rcode}`}.`);

  const vaultLeft = await balance(vault), got = await balance(merchantAta);
  console.log(`\nEscrow ${usdc(vaultLeft)} dUSDC left, merchant collected ${usdc(got)} dUSDC.`);
  console.log(`\n${results.filter((r) => r[1]).length}/${results.length} passed.`);
  console.log(results.filter((r) => !r[1]).map((r) => `  OPEN: ${r[0]}`).join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
