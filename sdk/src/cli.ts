#!/usr/bin/env node
// One command instead of seven.
//
//   npx @curved/x402 init            set up an agent that can pay
//   npx @curved/x402 init --seller   set up an API that can charge
//   npx @curved/x402 status          what do I have, and can I actually pay
//
// Everything a person had to do by hand (make a keypair, create the token
// account, open the escrow, fund it, find the right addresses, write the env)
// happens here. The point of comparison is an account signup, so this has to be
// shorter than one.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  TOKEN_ID, ATA_ID, ata, escrowPda, vaultPda, openEscrowIx, depositIx, PROGRAM_ID,
} from "./core.ts";

const USDC = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  devnet: "9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz", // CURVED demo dUSDC
};
const RPC = { "mainnet-beta": "https://api.mainnet-beta.solana.com", devnet: "https://api.devnet.solana.com" };

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith("--") ? "true" : args[i + 1]) : fallback;
};
const has = (name: string) => args.includes(`--${name}`);

const net = (flag("network", "devnet") as keyof typeof RPC);
const conn = new Connection(flag("rpc", RPC[net])!, "confirmed");
const mint = new PublicKey(flag("mint", USDC[net])!);
const keyPath = resolve(flag("key", ".curved-key.json")!);

const say = (s = "") => console.log(s);
const money = (n: bigint) => (Number(n) / 1e6).toFixed(2);

function loadOrCreateKey(): { kp: Keypair; created: boolean } {
  if (existsSync(keyPath)) return { kp: Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8")))), created: false };
  const kp = Keypair.generate();
  writeFileSync(keyPath, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  return { kp, created: true };
}

const mkAtaIx = (payer: PublicKey, owner: PublicKey) =>
  new TransactionInstruction({
    programId: ATA_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata(owner, mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // idempotent: fine if it already exists
  });

async function tokenBalance(acct: PublicKey) {
  const i = await conn.getAccountInfo(acct);
  return i ? new DataView(i.data.buffer, i.data.byteOffset).getBigUint64(64, true) : 0n;
}

async function send(signer: Keypair, ixs: TransactionInstruction[]) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(signer);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature: sig, ...(await conn.getLatestBlockhash()) }, "confirmed");
  return sig;
}

async function init() {
  const seller = has("seller");
  const { kp, created } = loadOrCreateKey();
  say(`network  ${net}`);
  say(`key      ${kp.publicKey.toBase58()}${created ? "  (new, saved to " + keyPath + ")" : "  (existing)"}`);

  const sol = await conn.getBalance(kp.publicKey);
  const myAta = ata(kp.publicKey, mint);

  if (seller) {
    // A seller only needs somewhere for the money to land, plus enough SOL to
    // submit its own settlements.
    if (!(await conn.getAccountInfo(myAta))) {
      if (sol === 0) return needSol(kp, "to create your token account");
      await send(kp, [mkAtaIx(kp.publicKey, kp.publicKey)]);
      say(`token account created`);
    }
    say(`\nReady to charge. Put this in your server:\n`);
    say(`  import { wall } from "@curved/x402";`);
    say(`  app.use("/premium", wall({ conn, network: "${net}", relayer, payTo, mint, price: 1000n }));`);
    say(`\n  CURVED_KEY=${keyPath}`);
    say(`  CURVED_MINT=${mint.toBase58()}`);
    say(`  CURVED_NETWORK=${net}`);
    if (sol < 10_000_000) say(`\nHeads up: ${(sol / 1e9).toFixed(4)} SOL. Each settlement costs about 0.000005. Top up before you get traffic.`);
    return;
  }

  // An agent needs a funded escrow before it can pay for anything.
  const escrow = escrowPda(kp.publicKey);
  const held = await tokenBalance(myAta);
  const vault = await tokenBalance(vaultPda(escrow, mint));
  const open = (await conn.getAccountInfo(escrow)) !== null;

  if (sol === 0) return needSol(kp, "to open the escrow (one transaction, about 0.003 SOL)");

  const ixs: TransactionInstruction[] = [];
  if (!open) ixs.push(openEscrowIx(kp.publicKey, kp.publicKey));
  const deposit = BigInt(flag("deposit", "0")!) || held;
  if (deposit > 0n) {
    if (deposit > held) { say(`\nYou asked to deposit ${money(deposit)} but hold ${money(held)}.`); process.exit(1); }
    ixs.push(depositIx(kp.publicKey, mint, deposit));
  }
  if (ixs.length) {
    const sig = await send(kp, ixs);
    say(`escrow   ${open ? "funded" : "opened and funded"}  ${sig.slice(0, 16)}…`);
  }

  const spendable = await tokenBalance(vaultPda(escrow, mint));
  say(`\nSpendable ${money(spendable)}  (was ${money(vault)})`);
  if (spendable === 0n) {
    say(`\nNothing to spend yet. Send tokens to ${myAta.toBase58()} and run init again.`);
    return;
  }
  say(`\nReady to pay. Your agent needs nothing else, not even an RPC:\n`);
  say(`  import { pay } from "@curved/x402/zero";`);
  say(`  const res = await pay(secretKey, "https://api.example.com/premium");`);
  say(`\n  CURVED_KEY=${keyPath}`);
}

function needSol(kp: Keypair, why: string) {
  say(`\nThis wallet has no SOL, and it needs a little ${why}.`);
  say(net === "devnet"
    ? `  solana airdrop 1 ${kp.publicKey.toBase58()} -u devnet\n  or https://faucet.solana.com`
    : `  send about 0.01 SOL to ${kp.publicKey.toBase58()}`);
  say(`\nThen run this again.`);
}

async function status() {
  if (!existsSync(keyPath)) { say(`No key at ${keyPath}. Run: npx @curved/x402 init`); return; }
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8"))));
  const escrow = escrowPda(kp.publicKey);
  const [sol, held, vault, open] = await Promise.all([
    conn.getBalance(kp.publicKey),
    tokenBalance(ata(kp.publicKey, mint)),
    tokenBalance(vaultPda(escrow, mint)),
    conn.getAccountInfo(escrow),
  ]);
  say(`network   ${net}`);
  say(`key       ${kp.publicKey.toBase58()}`);
  say(`program   ${PROGRAM_ID.toBase58()}`);
  say(`SOL       ${(sol / 1e9).toFixed(4)}`);
  say(`in wallet ${money(held)}`);
  say(`spendable ${money(vault)}${open ? "" : "   (no escrow yet)"}`);
  say(``);
  say(vault > 0n ? `Can pay: yes, for about ${Math.floor(Number(vault) / 1000)} calls at 0.001 each.`
                 : `Can pay: no. Run: npx @curved/x402 init --deposit <amount>`);
}

const usage = `curved x402

  npx @curved/x402 init              set up an agent that can pay
  npx @curved/x402 init --seller     set up an API that can charge
  npx @curved/x402 status            balances, and whether you can pay

options
  --network devnet|mainnet-beta      default devnet
  --deposit <atomic units>           how much to move into the escrow
  --key <path>                       default ./.curved-key.json
  --mint <address>                   default USDC for the network
  --rpc <url>
`;

const main = { init, status }[cmd as "init" | "status"];
if (!main) { say(usage); process.exit(cmd ? 1 : 0); }
main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
