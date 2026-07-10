// The x402 envelope (Coinbase x402 spec v1 wire shapes), carrying the CURVED
// scheme: instead of "exact"'s facilitator-signed transaction, the payload is
// an offline authorization anyone can relay. Scheme id: "curved-relay".
import { Keypair, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { Authorization, signAuthorization } from "./core.ts";

export const X402_VERSION = 1;
export const SCHEME = "curved-relay";

// CAIP-2 network ids (first 32 base58 chars of the genesis hash).
export const NETWORKS = {
  "mainnet-beta": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  localnet: "solana:localnet",
} as const;
export type NetworkName = keyof typeof NETWORKS;

/// One entry of the 402 body's `accepts` array (spec field names verbatim).
export type PaymentRequirements = {
  scheme: typeof SCHEME;
  network: string;
  maxAmountRequired: string; // atomic units
  asset: string; // mint address
  payTo: string; // payee wallet (owner, not ATA)
  resource: string;
  description: string;
  mimeType: string;
  outputSchema: null;
  maxTimeoutSeconds: number;
  extra: {
    programId: string;
    nonce: string; // server-issued, fresh per quote
  };
};

export type PaymentRequired = {
  x402Version: number;
  error: string;
  accepts: PaymentRequirements[];
};

export type PaymentPayload = {
  x402Version: number;
  scheme: typeof SCHEME;
  network: string;
  payload: {
    authorization: {
      payer: string;
      payee: string;
      mint: string;
      amount: string;
      nonce: string;
      validFrom: string;
      expiry: string;
    };
    signature: string; // base64, 64 bytes
  };
};

export type SettlementResponse = {
  success: boolean;
  transaction: string; // base58 signature
  network: string;
  payer: string;
  errorReason?: string;
};

export function makeRequirements(opts: {
  network: NetworkName;
  amount: bigint;
  mint: PublicKey;
  payTo: PublicKey;
  resource: string;
  description?: string;
  mimeType?: string;
  timeoutSeconds?: number;
}): PaymentRequired {
  return {
    x402Version: X402_VERSION,
    error: "payment required",
    accepts: [{
      scheme: SCHEME,
      network: NETWORKS[opts.network],
      maxAmountRequired: opts.amount.toString(),
      asset: opts.mint.toBase58(),
      payTo: opts.payTo.toBase58(),
      resource: opts.resource,
      description: opts.description ?? "",
      mimeType: opts.mimeType ?? "application/json",
      outputSchema: null,
      maxTimeoutSeconds: opts.timeoutSeconds ?? 300,
      extra: {
        programId: "12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y",
        nonce: String(BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000))),
      },
    }],
  };
}

/// Agent side: accept a quote and produce the X-PAYMENT header value.
/// Signs offline; touches no RPC.
export function buildPaymentHeader(agent: Keypair, req: PaymentRequirements): string {
  const auth: Authorization = {
    payer: agent.publicKey,
    payee: new PublicKey(req.payTo),
    mint: new PublicKey(req.asset),
    amount: BigInt(req.maxAmountRequired),
    nonce: BigInt(req.extra.nonce),
    // an HTTP quote is due now, so the window opens immediately. Scheduled
    // charges (a subscription month) set this ahead instead.
    validFrom: 0n,
    expiry: BigInt(Math.floor(Date.now() / 1000) + req.maxTimeoutSeconds),
  };
  const sig = signAuthorization(agent, auth);
  const payload: PaymentPayload = {
    x402Version: X402_VERSION,
    scheme: SCHEME,
    network: req.network,
    payload: {
      authorization: {
        payer: auth.payer.toBase58(),
        payee: auth.payee.toBase58(),
        mint: auth.mint.toBase58(),
        amount: auth.amount.toString(),
        nonce: auth.nonce.toString(),
        validFrom: auth.validFrom.toString(),
        expiry: auth.expiry.toString(),
      },
      signature: Buffer.from(sig).toString("base64"),
    },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodePaymentHeader(header: string): { auth: Authorization; sig: Uint8Array; payload: PaymentPayload } {
  const payload: PaymentPayload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  if (payload.x402Version !== X402_VERSION || payload.scheme !== SCHEME) {
    throw new Error(`unsupported payment: v${payload.x402Version} scheme ${payload.scheme}`);
  }
  const a = payload.payload.authorization;
  return {
    auth: {
      payer: new PublicKey(a.payer),
      payee: new PublicKey(a.payee),
      mint: new PublicKey(a.mint),
      amount: BigInt(a.amount),
      nonce: BigInt(a.nonce),
      validFrom: BigInt(a.validFrom),
      expiry: BigInt(a.expiry),
    },
    sig: Uint8Array.from(Buffer.from(payload.payload.signature, "base64")),
    payload,
  };
}

export const encodeSettlementHeader = (r: SettlementResponse) =>
  Buffer.from(JSON.stringify(r)).toString("base64");
export const decodeSettlementHeader = (h: string): SettlementResponse =>
  JSON.parse(Buffer.from(h, "base64").toString("utf8"));
