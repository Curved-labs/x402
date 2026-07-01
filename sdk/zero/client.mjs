// A complete x402 payment client with no dependencies at all: no npm packages,
// no @solana/web3.js, no RPC endpoint, no blockhash, no network access to Solana.
// Node's own crypto and fetch are the whole toolchain.
//
// This file exists to make the difference concrete. Paying under the standard
// Solana x402 scheme means signing a TRANSACTION, and a Solana transaction
// carries a recent blockhash, so the payer must reach an RPC node and get the
// payment submitted within about a minute. Here the payer signs 143 detached
// bytes. Nothing in them expires against a blockhash and nothing needs the
// chain, so this runs anywhere an HTTP request runs: an offline sandbox, an
// edge worker, CI, a browser extension with no RPC key.
//
//   import { pay } from "./client.mjs";
//   const res = await pay(secretKey, "https://api.example.com/premium");
//
// The only thing the caller needs is 64 bytes of key material.

import { createPrivateKey, sign as edSign } from "node:crypto";

const AUTH_DOMAIN = new TextEncoder().encode("X402SOL_AUTH_V1");
const SCHEME = "curved-relay";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// ── base58, because Solana addresses arrive as strings ──────────────────────
function b58decode(str) {
  let n = 0n;
  for (const ch of str) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error(`bad base58 character ${ch}`);
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const ch of str) { if (ch !== "1") break; bytes.unshift(0); }
  return Uint8Array.from(bytes);
}

function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}

// ── ed25519 without a crypto library ───────────────────────────────────────
// A raw 32-byte seed becomes a signing key by wrapping it in the fixed PKCS8
// prefix for Ed25519. Node signs it natively from there.
const PKCS8_ED25519 = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function signerFrom(secretKey) {
  const key = Uint8Array.from(secretKey);
  if (key.length !== 64) throw new Error("expected a 64-byte Solana secret key");
  const der = new Uint8Array(PKCS8_ED25519.length + 32);
  der.set(PKCS8_ED25519);
  der.set(key.subarray(0, 32), PKCS8_ED25519.length);
  const priv = createPrivateKey({ key: Buffer.from(der), format: "der", type: "pkcs8" });
  // a Solana secret key already carries its public half in the second 32 bytes
  return { priv, publicKey: key.subarray(32, 64) };
}

// ── the payment itself ─────────────────────────────────────────────────────
const u64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), true); return b; };
const i64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(v), true); return b; };

/// The exact 143 bytes that ARE the payment. Every field a hostile relayer
/// might want to change is inside the signature.
export function authorizationBytes(a) {
  const parts = [AUTH_DOMAIN, a.payer, a.payee, a.mint,
    u64(a.amount), u64(a.nonce), i64(a.validFrom), i64(a.expiry)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/// Turn a 402 quote into an X-PAYMENT header. Offline: no clock beyond the
/// local one, no chain, no round trip.
///
/// `opts.payer` is the escrow being spent, which is only the signing key itself
/// when the agent owns its own money. Under the custody split the owner holds
/// the funds and this key merely signs, so the owner's address must be given.
export function buildPaymentHeader(secretKey, quote, opts = {}) {
  const { priv, publicKey } = signerFrom(secretKey);
  const auth = {
    payer: publicKey,
    payee: b58decode(quote.payTo),
    mint: b58decode(quote.asset),
    amount: BigInt(quote.maxAmountRequired),
    nonce: BigInt(quote.extra.nonce),
    validFrom: 0n,
    expiry: BigInt(Math.floor(Date.now() / 1000) + quote.maxTimeoutSeconds),
  };
  const msg = authorizationBytes(auth);
  const sig = edSign(null, Buffer.from(msg), priv);
  return Buffer.from(JSON.stringify({
    x402Version: 1,
    scheme: SCHEME,
    network: quote.network,
    payload: {
      authorization: {
        payer: b58encode(auth.payer),
        payee: quote.payTo,
        mint: quote.asset,
        amount: auth.amount.toString(),
        nonce: auth.nonce.toString(),
        validFrom: auth.validFrom.toString(),
        expiry: auth.expiry.toString(),
      },
      signature: sig.toString("base64"),
    },
  })).toString("base64");
}

/// fetch, and pay if the answer is 402. One extra round trip, nothing else.
export async function pay(secretKey, url, init = {}, opts = {}) {
  const first = await fetch(url, init);
  if (first.status !== 402) return first;

  const body = await first.json();
  const quote = (body.accepts || []).find((a) => a.scheme === SCHEME);
  if (!quote) throw new Error(`402 offers no ${SCHEME} scheme`);
  if (opts.maxAmount !== undefined && BigInt(quote.maxAmountRequired) > BigInt(opts.maxAmount)) {
    throw new Error(`quote ${quote.maxAmountRequired} exceeds maxAmount ${opts.maxAmount}`);
  }

  return fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), "X-PAYMENT": buildPaymentHeader(secretKey, quote, opts) },
  });
}

export { b58encode, b58decode };
