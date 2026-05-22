// A real paid API, end to end, on devnet: a seller wraps one route with the
// wall, and an agent with no Solana dependencies pays for it over HTTP.
import { createServer } from "http";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "fs";
import { TOKEN_ID, ata, escrowPda, vaultPda, openEscrowIx, depositIx } from "../src/core.ts";
import { check } from "../src/wall.ts";
import { pay } from "../zero/client.mjs";

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const MINT = new PublicKey("9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz");
const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  readFileSync(new URL("../../stage-wallet.json", import.meta.url).pathname, "utf8"))));

const mintTo = (dst: PublicKey, auth: PublicKey, amt: bigint) => { const d=new Uint8Array(9); d[0]=7; new DataView(d.buffer).setBigUint64(1,amt,true);
  return new TransactionInstruction({programId:TOKEN_ID,keys:[{pubkey:MINT,isSigner:false,isWritable:true},{pubkey:dst,isSigner:false,isWritable:true},{pubkey:auth,isSigner:true,isWritable:false}],data:Buffer.from(d)}); };
const mkAta = (payer: PublicKey, owner: PublicKey) => new TransactionInstruction({programId:new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  keys:[{pubkey:payer,isSigner:true,isWritable:true},{pubkey:ata(owner,MINT),isSigner:false,isWritable:true},{pubkey:owner,isSigner:false,isWritable:false},
        {pubkey:MINT,isSigner:false,isWritable:false},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false},{pubkey:TOKEN_ID,isSigner:false,isWritable:false}],data:Buffer.from([1])});
async function send(fee: Keypair, ixs: TransactionInstruction[]) {
  const tx=new Transaction().add(...ixs); tx.feePayer=fee.publicKey;
  tx.recentBlockhash=(await conn.getLatestBlockhash()).blockhash; tx.sign(fee);
  const s=await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({signature:s,...(await conn.getLatestBlockhash())},"confirmed"); return s;
}
const bal = async (a: PublicKey) => { const i=await conn.getAccountInfo(a); return i? new DataView(i.data.buffer,i.data.byteOffset).getBigUint64(64,true):0n; };

const agent = Keypair.generate(), seller = Keypair.generate();
console.log("staging a seller and an agent on devnet...");
await send(funder,[SystemProgram.transfer({fromPubkey:funder.publicKey,toPubkey:agent.publicKey,lamports:30_000_000}),
                   SystemProgram.transfer({fromPubkey:funder.publicKey,toPubkey:seller.publicKey,lamports:30_000_000})]);
await send(funder,[mkAta(funder.publicKey,agent.publicKey),mkAta(funder.publicKey,seller.publicKey),
                   mintTo(ata(agent.publicKey,MINT),funder.publicKey,10_000_000n)]);
await send(agent,[openEscrowIx(agent.publicKey,agent.publicKey),depositIx(agent.publicKey,MINT,10_000_000n)]);
const sellerAta = ata(seller.publicKey, MINT);
console.log(`  seller starts with ${Number(await bal(sellerAta))/1e6} dUSDC\n`);

// ── the seller's entire integration ────────────────────────────────────────
const cfg = { conn, network: "devnet" as const, relayer: seller, payTo: seller.publicKey, mint: MINT,
              price: 250_000n, description: "One weather reading" };

const server = createServer(async (req, res) => {
  const r = await check(cfg, req.url!, req.headers["x-payment"] as string | undefined).catch((e) => e as Error);
  if (r instanceof Error) { res.writeHead(402).end(JSON.stringify({ error: r.message })); return; }
  if (!r.paid) { res.writeHead(402, {"content-type":"application/json"}).end(JSON.stringify(r.body)); return; }
  res.writeHead(200, {"content-type":"application/json","X-PAYMENT-RESPONSE":r.header});
  res.end(JSON.stringify({ tempC: 21.4, city: "Seoul" }));
});
await new Promise<void>((ok) => server.listen(8402, ok));
console.log("paid API listening on :8402, price 0.25 dUSDC per call\n");

// ── the agent's entire integration ─────────────────────────────────────────
const unpaid = await fetch("http://127.0.0.1:8402/weather");
console.log(`without payment : ${unpaid.status} ${(await unpaid.json()).accepts?.[0]?.maxAmountRequired ?? ""} quoted`);

const t = Date.now();
const res = await pay(agent.secretKey, "http://127.0.0.1:8402/weather");
const body = await res.json();
console.log(`with payment    : ${res.status} ${JSON.stringify(body)}  (${Date.now()-t}ms end to end)`);

const settled = JSON.parse(Buffer.from(res.headers.get("x-payment-response")!, "base64").toString());
console.log(`\nseller now holds ${Number(await bal(sellerAta))/1e6} dUSDC`);
console.log(`settled by the seller themselves: ${settled.transaction.slice(0,20)}…`);
console.log(`escrow left ${Number(await bal(vaultPda(escrowPda(agent.publicKey),MINT)))/1e6} dUSDC`);
server.close();
