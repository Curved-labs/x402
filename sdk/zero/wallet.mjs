// An agent wallet: the key, a spending policy it cannot exceed, and a record of
// everything it spent. Still no dependencies beyond node's own crypto and fs.
//
// Handing a bot a key is frightening because the bot decides how much to spend.
// Here the policy decides, and it is checked against the quote BEFORE anything
// is signed, so a refused payment never becomes a signature that exists in the
// world. The escrow bounds the worst case; the policy bounds the ordinary one.
//
//   const w = new Wallet({ keyFile: ".curved-key.json", policy: {
//     maxPerCall: 10_000n, maxPerDay: 1_000_000n, allow: ["api.example.com"],
//   }});
//   const res = await w.fetch("https://api.example.com/premium");
//   w.spentToday();  w.history();
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildPaymentHeader } from "./client.mjs";

const SCHEME = "curved-relay";
const DAY = 86_400_000;

export class PolicyError extends Error {
  constructor(message, detail) { super(message); this.name = "PolicyError"; this.detail = detail; }
}

export class Wallet {
  /// `policy` fields are all optional; anything left out is simply not enforced.
  ///   maxPerCall  most that may be paid for one request
  ///   maxPerDay   most that may be paid in a rolling 24 hours
  ///   maxTotal    lifetime ceiling for this wallet file
  ///   allow       hostnames that may be paid at all
  ///   confirm     async (quote) => boolean, a last human or policy gate
  constructor({ key, keyFile, payer, policy = {}, ledgerFile } = {}) {
    if (!key && !keyFile) throw new Error("a wallet needs `key` or `keyFile`");
    this.secretKey = key ?? Uint8Array.from(JSON.parse(readFileSync(keyFile, "utf8")));
    this.payer = payer;
    this.policy = policy;
    this.ledgerFile = ledgerFile ?? (keyFile ? keyFile.replace(/\.json$/, "") + "-spend.json" : null);
    this.entries = this.ledgerFile && existsSync(this.ledgerFile)
      ? JSON.parse(readFileSync(this.ledgerFile, "utf8"))
      : [];
  }

  // ── what has been spent ──────────────────────────────────────────────────
  history() { return this.entries.slice(); }
  spentTotal() { return this.entries.reduce((n, e) => n + BigInt(e.amount), 0n); }
  spentToday() {
    const from = Date.now() - DAY;
    return this.entries.filter((e) => e.at >= from).reduce((n, e) => n + BigInt(e.amount), 0n);
  }

  /// What the policy would say about this quote, without paying it. Useful for
  /// showing an operator why a call is about to be refused.
  inspect(quote, host) {
    const p = this.policy;
    const amount = BigInt(quote.maxAmountRequired);
    const reasons = [];
    if (p.allow && host && !p.allow.includes(host)) reasons.push(`${host} is not in the allow list`);
    if (p.maxPerCall !== undefined && amount > BigInt(p.maxPerCall))
      reasons.push(`${amount} over the per-call limit of ${p.maxPerCall}`);
    if (p.maxPerDay !== undefined && this.spentToday() + amount > BigInt(p.maxPerDay))
      reasons.push(`would take today's spend to ${this.spentToday() + amount}, over ${p.maxPerDay}`);
    if (p.maxTotal !== undefined && this.spentTotal() + amount > BigInt(p.maxTotal))
      reasons.push(`would take lifetime spend to ${this.spentTotal() + amount}, over ${p.maxTotal}`);
    return { amount, allowed: reasons.length === 0, reasons };
  }

  record(entry) {
    this.entries.push(entry);
    if (this.ledgerFile) writeFileSync(this.ledgerFile, JSON.stringify(this.entries, null, 2));
  }

  // ── paying ───────────────────────────────────────────────────────────────
  /// fetch, and pay a 402 only if the policy permits it. Throws PolicyError
  /// rather than paying, so nothing is signed that should not have been.
  async fetch(url, init = {}) {
    const first = await fetch(url, init);
    if (first.status !== 402) return first;

    const body = await first.json();
    const quote = (body.accepts || []).find((a) => a.scheme === SCHEME);
    if (!quote) throw new Error(`402 offers no ${SCHEME} scheme`);

    const host = new URL(String(url)).hostname;
    const verdict = this.inspect(quote, host);
    if (!verdict.allowed) throw new PolicyError(`payment refused by policy: ${verdict.reasons[0]}`, verdict);
    if (this.policy.confirm && !(await this.policy.confirm(quote, { host, amount: verdict.amount })))
      throw new PolicyError("payment refused by confirm()", verdict);

    const header = buildPaymentHeader(this.secretKey, quote, { payer: this.payer });
    const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), "X-PAYMENT": header } });

    // Only a served response means the money moved. A 402 on the retry is the
    // payee rejecting the payment, and nothing was spent.
    if (res.ok) {
      let transaction = null;
      const h = res.headers.get("x-payment-response");
      if (h) { try { transaction = JSON.parse(Buffer.from(h, "base64").toString()).transaction; } catch {} }
      this.record({ at: Date.now(), host, url: String(url), amount: quote.maxAmountRequired, transaction });
    }
    return res;
  }
}

/// Convenience for the common shape: one wallet, used as a drop-in fetch.
export function wallet(opts) {
  const w = new Wallet(opts);
  const f = (url, init) => w.fetch(url, init);
  f.wallet = w;
  return f;
}
