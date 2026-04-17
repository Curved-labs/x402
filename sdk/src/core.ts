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
