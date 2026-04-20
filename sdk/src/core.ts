// On-chain core: instruction builders for the x402 settlement program.
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import { Buffer } from "buffer";
import { createHash } from "crypto";

export const PROGRAM_ID = new PublicKey("12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y");
export const ED25519_ID = new PublicKey("Ed25519SigVerify111111111111111111111111111");
export const TOKEN_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ATA_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const AUTH_DOMAIN = new TextEncoder().encode("X402SOL_AUTH_V1");

const disc = (name: string) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);

const u64le = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
};
const i64le = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, n, true);
  return b;
};
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export const escrowPda = (payer: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("escrow"), payer.toBuffer()], PROGRAM_ID)[0];
export const vaultPda = (escrow: PublicKey, mint: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("vault"), escrow.toBuffer(), mint.toBuffer()], PROGRAM_ID)[0];
export const ata = (owner: PublicKey, mint: PublicKey) =>
  PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_ID.toBuffer(), mint.toBuffer()], ATA_ID)[0];

export type Authorization = {
  payer: PublicKey;
  payee: PublicKey;
  mint: PublicKey;
  amount: bigint;
  nonce: bigint;
  expiry: bigint;
};

/// The exact bytes the agent signs.
export function authorizationBytes(a: Authorization): Uint8Array {
  return cat(AUTH_DOMAIN, a.payer.toBytes(), a.payee.toBytes(), a.mint.toBytes(),
    u64le(a.amount), u64le(a.nonce), i64le(a.expiry));
}

export function signAuthorization(agent: Keypair, a: Authorization): Uint8Array {
  return nacl.sign.detached(authorizationBytes(a), agent.secretKey);
}

/// Ed25519 native-program instruction (offsets match the on-chain check).
export function ed25519Ix(pubkey: Uint8Array, sig: Uint8Array, msg: Uint8Array): TransactionInstruction {
  const [pkOff, sigOff, msgOff] = [16, 48, 112];
  const head = new Uint8Array(16);
  head[0] = 1;
  const dv = new DataView(head.buffer);
  [sigOff, 0xffff, pkOff, 0xffff, msgOff, msg.length, 0xffff].forEach((v, i) => dv.setUint16(2 + i * 2, v, true));
  return new TransactionInstruction({ programId: ED25519_ID, keys: [], data: Buffer.from(cat(head, pubkey, sig, msg)) });
}

export function openEscrowIx(payer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: escrowPda(payer), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(disc("open_escrow")),
  });
}

function fundKeys(payer: PublicKey, mint: PublicKey) {
  const escrow = escrowPda(payer);
  return [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: escrow, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: ata(payer, mint), isSigner: false, isWritable: true },
    { pubkey: vaultPda(escrow, mint), isSigner: false, isWritable: true },
    { pubkey: TOKEN_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
}

export const depositIx = (payer: PublicKey, mint: PublicKey, amount: bigint) =>
  new TransactionInstruction({ programId: PROGRAM_ID, keys: fundKeys(payer, mint), data: Buffer.from(cat(disc("deposit"), u64le(amount))) });

export const withdrawIx = (payer: PublicKey, mint: PublicKey, amount: bigint) =>
  new TransactionInstruction({ programId: PROGRAM_ID, keys: fundKeys(payer, mint), data: Buffer.from(cat(disc("withdraw"), u64le(amount))) });

export const NONCE_WINDOW_BITS = 1024n;
export const noncePda = (payer: PublicKey, nonce: bigint) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("nonce"), payer.toBuffer(), u64le(nonce / NONCE_WINDOW_BITS)],
    PROGRAM_ID,
  )[0];

export function payIx(relayer: PublicKey, a: Authorization): TransactionInstruction {
  const escrow = escrowPda(a.payer);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: relayer, isSigner: true, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: false },
      { pubkey: a.mint, isSigner: false, isWritable: false },
      { pubkey: vaultPda(escrow, a.mint), isSigner: false, isWritable: true },
      { pubkey: ata(a.payee, a.mint), isSigner: false, isWritable: true },
      { pubkey: noncePda(a.payer, a.nonce), isSigner: false, isWritable: true },
      { pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"), isSigner: false, isWritable: false },
      { pubkey: TOKEN_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(cat(disc("pay"), u64le(a.amount), u64le(a.nonce), i64le(a.expiry))),
  });
}

/// Relay one signed authorization.
export async function relay(conn: Connection, relayer: Keypair, a: Authorization, sig: Uint8Array): Promise<string> {
  const tx = new Transaction().add(ed25519Ix(a.payer.toBytes(), sig, authorizationBytes(a)), payIx(relayer.publicKey, a));
  tx.feePayer = relayer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(relayer);
  const s = await conn.sendRawTransaction(tx.serialize());
  const bh = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature: s, ...bh }, "confirmed");
  return s;
}
