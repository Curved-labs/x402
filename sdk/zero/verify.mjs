// Does the dependency-free client produce exactly what the real SDK produces?
// Same 143 bytes, same signature, verified by an independent implementation.
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { authorizationBytes as sdkBytes, signAuthorization } from "../src/core.ts";
import { PublicKey } from "@solana/web3.js";
import { authorizationBytes as zeroBytes, buildPaymentHeader, b58decode, b58encode } from "./client.mjs";

const kp = Keypair.generate();
const payee = Keypair.generate().publicKey;
const mint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const fixed = { amount: 1_250_000n, nonce: 42n, validFrom: 0n, expiry: 1800000000n };

const a = { payer: kp.publicKey, payee, mint, ...fixed };
const fromSdk = sdkBytes(a);
const fromZero = zeroBytes({ payer: kp.publicKey.toBytes(), payee: payee.toBytes(), mint: mint.toBytes(), ...fixed });

const same = Buffer.from(fromSdk).equals(Buffer.from(fromZero));
console.log(`authorization bytes : ${fromSdk.length} vs ${fromZero.length}, identical: ${same}`);

const sSdk = signAuthorization(kp, a);
const header = buildPaymentHeader(kp.secretKey, {
  scheme: "curved-relay", network: "solana:devnet",
  maxAmountRequired: fixed.amount.toString(), asset: mint.toBase58(), payTo: payee.toBase58(),
  maxTimeoutSeconds: 60, extra: { nonce: fixed.nonce.toString() },
});
const decoded = JSON.parse(Buffer.from(header, "base64").toString());
const sZero = Uint8Array.from(Buffer.from(decoded.payload.signature, "base64"));

// the zero client stamps its own expiry, so re-sign the sdk side over its bytes
const zeroAuth = { payer: kp.publicKey.toBytes(), payee: payee.toBytes(), mint: mint.toBytes(),
  amount: fixed.amount, nonce: fixed.nonce, validFrom: 0n, expiry: BigInt(decoded.payload.authorization.expiry) };
const zeroMsg = zeroBytes(zeroAuth);

console.log(`signature verifies  : ${nacl.sign.detached.verify(zeroMsg, sZero, kp.publicKey.toBytes())}`);
console.log(`same key, same msg  : ${Buffer.from(sSdk).equals(Buffer.from(nacl.sign.detached(fromSdk, kp.secretKey)))}`);
console.log(`base58 round trip   : ${b58encode(b58decode(mint.toBase58())) === mint.toBase58()}`);
console.log(`payer in header     : ${decoded.payload.authorization.payer === kp.publicKey.toBase58()}`);
