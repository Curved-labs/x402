// Payee side: quote a price, then settle an X-PAYMENT on-chain yourself.
// The server IS the relayer (self-relay): no facilitator anywhere in the path.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { relay } from "./core.ts";
import {
  PaymentRequired, SettlementResponse, decodePaymentHeader, encodeSettlementHeader, makeRequirements, NetworkName,
} from "./protocol.ts";

export type PayeeConfig = {
  conn: Connection;
  network: NetworkName;
  /// signs the relay transaction and pays its fee (typically the payee's own key)
  relayer: Keypair;
  /// where the money goes (owner wallet; its ATA must exist)
  payTo: PublicKey;
  mint: PublicKey;
};

export function quote(cfg: PayeeConfig, amount: bigint, resource: string, description?: string): PaymentRequired {
  return makeRequirements({
    network: cfg.network,
    amount,
    mint: cfg.mint,
    payTo: cfg.payTo,
    resource,
    description,
  });
}

/// Verify the header matches what we quoted, then settle on-chain.
/// Returns the X-PAYMENT-RESPONSE header value (and throws on any mismatch or
/// on-chain rejection: tampered, replayed, expired, underfunded).
export async function settle(
  cfg: PayeeConfig,
  paymentHeader: string,
  expected: { amount: bigint; nonce: bigint },
): Promise<{ header: string; settlement: SettlementResponse }> {
  const { auth, sig } = decodePaymentHeader(paymentHeader);
  if (!auth.payee.equals(cfg.payTo)) throw new Error("payee mismatch");
  if (!auth.mint.equals(cfg.mint)) throw new Error("mint mismatch");
  if (auth.amount !== expected.amount) throw new Error("amount mismatch");
  if (auth.nonce !== expected.nonce) throw new Error("nonce mismatch");

  const txSig = await relay(cfg.conn, cfg.relayer, auth, sig);
  const settlement: SettlementResponse = {
    success: true,
    transaction: txSig,
    network: cfg.network,
    payer: auth.payer.toBase58(),
  };
  return { header: encodeSettlementHeader(settlement), settlement };
}
