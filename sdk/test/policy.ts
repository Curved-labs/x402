// On-chain spending cap: the authority sets it once, the program enforces it
// at settlement no matter who holds the delegate key. Run against devnet.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import fs from "fs";
import {
  TOKEN_ID, ata, openEscrowIx, depositIx, ed25519Ix, payIx, setPolicyIx, readPolicy,
  authorizationBytes, signAuthorization, Authorization,
} from "../src/index.ts";

const RPC = "https://api.devnet.solana.com";
const MINT = new PublicKey("9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz");
const conn = new Connection(RPC, "confirmed");
const WALLET = process.env.X402_FUND_WALLET;
if (!WALLET) { console.error("set X402_FUND_WALLET to a funded devnet keypair file"); process.exit(1); }
const stage = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET, "utf8"))));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mkAtaIx = (payer: PublicKey, owner: PublicKey, mint: PublicKey) =>
  new TransactionInstruction({
    programId: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata(owner, mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]),
  });
const mintToIx = (dst: PublicKey, amt: bigint) => {
  const d = new Uint8Array(9); d[0] = 7; new DataView(d.buffer).setBigUint64(1, amt, true);
  return new TransactionInstruction({ programId: TOKEN_ID, keys: [
    { pubkey: MINT, isSigner: false, isWritable: true },
    { pubkey: dst, isSigner: false, isWritable: true },
    { pubkey: stage.publicKey, isSigner: true, isWritable: false },
  ], data: Buffer.from(d) });
};

async function send(fee: Keypair, extra: Keypair[], ixs: TransactionInstruction[], skipPreflight = false) {
  for (let attempt = 0; ; attempt++) {
    const tx = new Transaction().add(...ixs);
    tx.feePayer = fee.publicKey;
    const bh = await conn.getLatestBlockhash();
    tx.recentBlockhash = bh.blockhash;
    tx.sign(fee, ...extra);
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight });
    try {
      const res = await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      if (res.value.err) throw new Error(JSON.stringify(res.value.err));
      await sleep(1200);
      return sig;
    } catch (e) {
      // dropped by devnet congestion: rebuild with a fresh blockhash and resend
      if (attempt < 2 && String(e).includes("expired")) { await sleep(1500); continue; }
      throw e;
    }
  }
}

async function settle(relayer: Keypair, agent: Keypair, a: Authorization) {
  const msg = authorizationBytes(a);
  const sig = signAuthorization(agent, a);
  return send(relayer, [], [ed25519Ix(agent.publicKey.toBytes(), sig, msg), payIx(relayer.publicKey, a)], true);
}

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  ok  ${name}${detail ? " · " + detail : ""}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " · " + detail : ""}`); }
};

async function main() {
  const agent = Keypair.generate();
  const payee = Keypair.generate();
  console.log("agent", agent.publicKey.toBase58());

  await send(stage, [], [
    SystemProgram.transfer({ fromPubkey: stage.publicKey, toPubkey: agent.publicKey, lamports: 60_000_000 }),
    SystemProgram.transfer({ fromPubkey: stage.publicKey, toPubkey: payee.publicKey, lamports: 30_000_000 }),
    mkAtaIx(stage.publicKey, agent.publicKey, MINT),
    mkAtaIx(stage.publicKey, payee.publicKey, MINT),
    mintToIx(ata(agent.publicKey, MINT), 10_000_000n),
  ]);
  await send(agent, [], [
    openEscrowIx(agent.publicKey, agent.publicKey),
    depositIx(agent.publicKey, MINT, 8_000_000n),
  ]);
  console.log("staged: escrow holds 8.00 dUSDC");

  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const base = BigInt(Date.now()) * 1000n;
  const mk = (i: number, amount: bigint): Authorization => ({
    payer: agent.publicKey, payee: payee.publicKey, mint: MINT,
    amount, nonce: base + BigInt(i) * 1024n, validFrom: 0n, expiry,
  });

  // 1. no policy yet: a large payment settles (regression path)
  await settle(payee, agent, mk(0, 600_000n));
  ok("no policy: 0.60 settles", true);

  // 2. set caps: 0.50 per call, 1.20 per day
  await send(agent, [], [setPolicyIx(agent.publicKey, 500_000n, 1_200_000n)]);
  const pol = await readPolicy(conn, agent.publicKey);
  ok("set_policy stored", pol !== null && pol.maxPerCall === 500_000n && pol.maxPerDay === 1_200_000n);

  // 3. over the per-call cap: must be rejected with OverCallCap (0x1779)
  let threw = "";
  try { await settle(payee, agent, mk(1, 600_000n)); } catch (e) { threw = (e as Error)?.message ?? JSON.stringify(e); }
  ok("0.60 rejected by per-call cap", threw.includes("6009") || threw.includes("1779") || threw.includes("Custom"), threw.slice(0, 60));

  // 4. within caps: two 0.50 payments pass (day total 1.00)
  await settle(payee, agent, mk(2, 500_000n));
  await settle(payee, agent, mk(3, 500_000n));
  const pol2 = await readPolicy(conn, agent.publicKey);
  ok("two 0.50 settle, tally = 1.00", pol2 !== null && pol2.spentToday === 1_000_000n, `spentToday=${pol2?.spentToday}`);

  // 5. next 0.50 would make 1.50 > 1.20: rejected by the day cap
  threw = "";
  try { await settle(payee, agent, mk(4, 500_000n)); } catch (e) { threw = (e as Error)?.message ?? JSON.stringify(e); }
  ok("third 0.50 rejected by day cap", threw.includes("6010") || threw.includes("177a") || threw.includes("Custom"), threw.slice(0, 60));

  // 6. authority loosens the day cap; the kept tally still counts
  await send(agent, [], [setPolicyIx(agent.publicKey, 0n, 2_000_000n)]);
  await settle(payee, agent, mk(5, 900_000n));
  const pol3 = await readPolicy(conn, agent.publicKey);
  ok("after loosening: 0.90 settles, tally = 1.90", pol3 !== null && pol3.spentToday === 1_900_000n, `spentToday=${pol3?.spentToday}`);

  // 7. an outsider cannot set the policy
  const outsider = Keypair.generate();
  await send(stage, [], [SystemProgram.transfer({ fromPubkey: stage.publicKey, toPubkey: outsider.publicKey, lamports: 10_000_000 })]);
  threw = "";
  try {
    const ix = setPolicyIx(agent.publicKey, 1n, 1n);
    ix.keys[0] = { pubkey: outsider.publicKey, isSigner: true, isWritable: true };
    await send(outsider, [], [ix], true);
  } catch (e) { threw = (e as Error)?.message ?? JSON.stringify(e); }
  ok("outsider cannot set policy", threw.length > 0);

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
