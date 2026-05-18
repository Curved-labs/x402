// Stands in for "a person put money in their wallet".
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "fs";
import { TOKEN_ID, ATA_ID, ata } from "../src/core.ts";
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const MINT = new PublicKey("9834uvrmBzKetnCggU4J3e1H6JMu7Td2vbh8wMT7ZvWz");
const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(new URL("../../stage-wallet.json", import.meta.url).pathname, "utf8"))));
const user = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.argv[2], "utf8"))));
const mkAta = (p: PublicKey, o: PublicKey) => new TransactionInstruction({ programId: ATA_ID, keys: [
  { pubkey: p, isSigner: true, isWritable: true }, { pubkey: ata(o, MINT), isSigner: false, isWritable: true },
  { pubkey: o, isSigner: false, isWritable: false }, { pubkey: MINT, isSigner: false, isWritable: false },
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: TOKEN_ID, isSigner: false, isWritable: false }], data: Buffer.from([1]) });
const mintTo = (dst: PublicKey, auth: PublicKey, amt: bigint) => { const d = new Uint8Array(9); d[0] = 7; new DataView(d.buffer).setBigUint64(1, amt, true);
  return new TransactionInstruction({ programId: TOKEN_ID, keys: [{ pubkey: MINT, isSigner: false, isWritable: true }, { pubkey: dst, isSigner: false, isWritable: true }, { pubkey: auth, isSigner: true, isWritable: false }], data: Buffer.from(d) }); };
const tx = new Transaction().add(
  SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: user.publicKey, lamports: 20_000_000 }),
  mkAta(funder.publicKey, user.publicKey),
  mintTo(ata(user.publicKey, MINT), funder.publicKey, 5_000_000n));
tx.feePayer = funder.publicKey;
tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
tx.sign(funder);
const s = await conn.sendRawTransaction(tx.serialize());
await conn.confirmTransaction({ signature: s, ...(await conn.getLatestBlockhash()) }, "confirmed");
console.log("  0.02 SOL + 5.00 dUSDC 입금됨");
