// End to end: the dependency-free client's header settles on devnet.
// Well-formed is not the claim. Spendable is.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "fs";
import { TOKEN_ID, ata, escrowPda, vaultPda, openEscrowIx, depositIx } from "../src/core.ts";
import { decodePaymentHeader } from "../src/protocol.ts";
import { relay } from "../src/core.ts";
import { buildPaymentHeader } from "./client.mjs";

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const MINT = new PublicKey("9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz");
const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(new URL("../../stage-wallet.json", import.meta.url).pathname, "utf8"))));

const mintTo = (dst, auth, amt) => { const d=new Uint8Array(9); d[0]=7; new DataView(d.buffer).setBigUint64(1,amt,true);
  return new TransactionInstruction({programId:TOKEN_ID,keys:[{pubkey:MINT,isSigner:false,isWritable:true},{pubkey:dst,isSigner:false,isWritable:true},{pubkey:auth,isSigner:true,isWritable:false}],data:Buffer.from(d)}); };
const mkAta = (payer,owner) => new TransactionInstruction({programId:new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  keys:[{pubkey:payer,isSigner:true,isWritable:true},{pubkey:ata(owner,MINT),isSigner:false,isWritable:true},{pubkey:owner,isSigner:false,isWritable:false},
        {pubkey:MINT,isSigner:false,isWritable:false},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false},{pubkey:TOKEN_ID,isSigner:false,isWritable:false}],data:Buffer.from([1])});
async function send(fee, ixs) {
  const tx=new Transaction().add(...ixs); tx.feePayer=fee.publicKey;
  tx.recentBlockhash=(await conn.getLatestBlockhash()).blockhash; tx.sign(fee);
  const s=await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({signature:s,...(await conn.getLatestBlockhash())},"confirmed"); return s;
}
const bal = async (a) => { const i=await conn.getAccountInfo(a); return i? new DataView(i.data.buffer,i.data.byteOffset).getBigUint64(64,true):0n; };

const agent = Keypair.generate(), payee = Keypair.generate();
console.log("staging an agent that will never touch an RPC...");
await send(funder,[SystemProgram.transfer({fromPubkey:funder.publicKey,toPubkey:agent.publicKey,lamports:30_000_000}),
                   SystemProgram.transfer({fromPubkey:funder.publicKey,toPubkey:payee.publicKey,lamports:30_000_000})]);
await send(funder,[mkAta(funder.publicKey,agent.publicKey),mkAta(funder.publicKey,payee.publicKey),
                   mintTo(ata(agent.publicKey,MINT),funder.publicKey,20_000_000n)]);
await send(agent,[openEscrowIx(agent.publicKey,agent.publicKey),depositIx(agent.publicKey,MINT,20_000_000n)]);

const payeeAta = ata(payee.publicKey,MINT);
console.log(`  escrow ${Number(await bal(vaultPda(escrowPda(agent.publicKey),MINT)))/1e6} dUSDC, payee ${Number(await bal(payeeAta))/1e6}\n`);

// ── the only step the agent performs. No RPC, no web3.js, no chain. ──
const quote = { scheme:"curved-relay", network:"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  maxAmountRequired:"1250000", asset:MINT.toBase58(), payTo:payee.publicKey.toBase58(),
  maxTimeoutSeconds:120, extra:{ nonce: String(BigInt(Date.now())) } };
const t0=Date.now();
const header = buildPaymentHeader(agent.secretKey, quote);
console.log(`agent signed offline in ${Date.now()-t0}ms, ${header.length} chars, zero dependencies\n`);

// ── the payee settles it themselves. No facilitator. ──
const { auth, sig } = decodePaymentHeader(header);
const t1=Date.now();
const txSig = await relay(conn, payee, auth, sig);
console.log(`payee self-relayed in ${Date.now()-t1}ms`);
console.log(`  tx    https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
console.log(`  payee now holds ${Number(await bal(payeeAta))/1e6} dUSDC`);
console.log(`  escrow left     ${Number(await bal(vaultPda(escrowPda(agent.publicKey),MINT)))/1e6} dUSDC`);
console.log(`  agent SOL spent on this payment: ${(30_000_000 - await conn.getBalance(agent.publicKey))/1e9} (setup only, none for the payment)`);
