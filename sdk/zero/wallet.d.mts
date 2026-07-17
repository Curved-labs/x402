// Types for the policy wallet. Hand written, like the payer it wraps, so the
// implementation can keep importing nothing but node builtins.
import type { Quote } from "./client.mjs";

export type Policy = {
  /// most that may be paid for a single request
  maxPerCall?: bigint | number | string;
  /// most that may be paid in a rolling 24 hours
  maxPerDay?: bigint | number | string;
  /// lifetime ceiling for this wallet's ledger
  maxTotal?: bigint | number | string;
  /// hostnames that may be paid at all
  allow?: string[];
  /// a last gate, after the limits have passed
  confirm?: (quote: Quote, info: { host: string; amount: bigint }) => Promise<boolean> | boolean;
};

export type SpendEntry = {
  at: number;
  host: string;
  url: string;
  amount: string;
  transaction: string | null;
};

export type Verdict = { amount: bigint; allowed: boolean; reasons: string[] };

export class PolicyError extends Error {
  detail: Verdict;
}

export class Wallet {
  constructor(opts: {
    key?: Uint8Array | number[];
    keyFile?: string;
    /// the escrow being spent, when it is not this key's own
    payer?: string;
    policy?: Policy;
    ledgerFile?: string;
  });
  /// fetch, paying a 402 only if the policy permits. Throws PolicyError instead
  /// of signing anything it should not.
  fetch(url: string | URL, init?: RequestInit): Promise<Response>;
  /// what the policy would say, without paying
  inspect(quote: Quote, host?: string): Verdict;
  history(): SpendEntry[];
  spentToday(): bigint;
  spentTotal(): bigint;
}

/// A wallet used as a drop-in fetch, with `.wallet` for the ledger.
export function wallet(opts: ConstructorParameters<typeof Wallet>[0]): ((url: string | URL, init?: RequestInit) => Promise<Response>) & { wallet: Wallet };
