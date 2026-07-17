// Types for the dependency-free payer. Hand written so client.mjs can stay
// exactly what it claims to be: one file importing only node:crypto.

/// A 402 quote, as it arrives in the `accepts` array of the payment-required body.
export type Quote = {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { nonce: string; [k: string]: unknown };
  [k: string]: unknown;
};

export type PayOptions = {
  /// Refuse quotes above this, in atomic units.
  maxAmount?: bigint | number | string;
  /// The escrow being spent. Defaults to the signing key, which is right only
  /// when the agent owns its own money; under the custody split pass the owner.
  payer?: string;
};

/// The 143 bytes that are the payment. Pubkeys are raw 32-byte arrays.
export function authorizationBytes(a: {
  payer: Uint8Array;
  payee: Uint8Array;
  mint: Uint8Array;
  amount: bigint;
  nonce: bigint;
  validFrom: bigint;
  expiry: bigint;
}): Uint8Array;

/// Sign a quote into an X-PAYMENT header value. Offline: no chain, no RPC.
export function buildPaymentHeader(
  secretKey: Uint8Array | number[],
  quote: Quote,
  opts?: PayOptions,
): string;

/// fetch, and pay if the answer is 402.
export function pay(
  secretKey: Uint8Array | number[],
  url: string | URL,
  init?: RequestInit,
  opts?: PayOptions,
): Promise<Response>;

export function b58encode(bytes: Uint8Array): string;
export function b58decode(str: string): Uint8Array;
