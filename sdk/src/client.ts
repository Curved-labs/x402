// Agent side: a fetch wrapper that pays 402s automatically. The agent holds a
// keypair and an escrow balance; it signs offline and never talks to an RPC.
import { Keypair } from "@solana/web3.js";
import { PaymentRequired, SCHEME, buildPaymentHeader, decodeSettlementHeader, SettlementResponse } from "./protocol.ts";

export type PaidResponse = Response & { settlement?: SettlementResponse };

/// fetch, and if the server answers 402 with a curved-relay quote, sign the
/// authorization offline and retry once with X-PAYMENT.
export async function fetchWithPayment(
  agent: Keypair,
  input: string | URL,
  init: RequestInit = {},
  opts: { maxAmount?: bigint } = {},
): Promise<PaidResponse> {
  const first = await fetch(input, init);
  if (first.status !== 402) return first;

  const body: PaymentRequired = await first.json();
  const quote = body.accepts?.find((a) => a.scheme === SCHEME);
  if (!quote) throw new Error("402 offers no curved-relay scheme");
  if (opts.maxAmount !== undefined && BigInt(quote.maxAmountRequired) > opts.maxAmount) {
    throw new Error(`quote ${quote.maxAmountRequired} exceeds maxAmount ${opts.maxAmount}`);
  }

  const header = buildPaymentHeader(agent, quote);
  const res: PaidResponse = await fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), "X-PAYMENT": header },
  });
  const settlementHeader = res.headers.get("X-PAYMENT-RESPONSE");
  if (settlementHeader) res.settlement = decodeSettlementHeader(settlementHeader);
  return res;
}
