// The seller's half: three lines that turn a route into a paid route.
//
//   app.use("/premium", wall({ price: 1250n, payTo, mint, conn, relayer }));
//
// There is no service behind this. The wall quotes the price, checks the
// signature it gets back, submits the settlement with the seller's own key, and
// the money lands in the seller's wallet. No facilitator, no account, no API key.
//
// It is also stateless. A conventional x402 server issues a nonce per quote and
// has to remember it; here the payer picks the nonce and the program refuses a
// second use of it, so replay is settled on chain rather than in the seller's
// memory. Nothing to store, nothing to expire, nothing to scale.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { relay } from "./core.ts";
import {
  PaymentRequired, SettlementResponse, decodePaymentHeader, encodeSettlementHeader,
  makeRequirements, NetworkName,
} from "./protocol.ts";

export type WallConfig = {
  conn: Connection;
  network: NetworkName;
  /// signs and pays the fee for the settlement. Usually the seller's own key:
  /// being your own relayer is what removes the middleman.
  relayer: Keypair;
  /// where the money lands. Its associated token account must already exist.
  payTo: PublicKey;
  mint: PublicKey;
  /// atomic units per request, or a function of the request path
  price: bigint | ((path: string) => bigint);
  description?: string;
};

const priceFor = (cfg: WallConfig, path: string) =>
  typeof cfg.price === "function" ? cfg.price(path) : cfg.price;

export type WallResult =
  | { paid: false; status: 402; body: PaymentRequired }
  | { paid: true; settlement: SettlementResponse; header: string };

/// The whole wall, independent of any web framework: hand it the resource path
/// and the X-PAYMENT header (if any) and it tells you whether to serve.
/// Throws only when a payment was offered and turned out to be bad.
export async function check(cfg: WallConfig, path: string, paymentHeader?: string | null): Promise<WallResult> {
  const amount = priceFor(cfg, path);
  if (!paymentHeader) {
    return { paid: false, status: 402, body: makeRequirements({
      network: cfg.network, amount, mint: cfg.mint, payTo: cfg.payTo,
      resource: path, description: cfg.description,
    }) };
  }

  const { auth, sig } = decodePaymentHeader(paymentHeader);
  // everything the payer could have altered is checked against our own terms
  if (!auth.payee.equals(cfg.payTo)) throw new Error("payee mismatch");
  if (!auth.mint.equals(cfg.mint)) throw new Error("mint mismatch");
  if (auth.amount < amount) throw new Error(`underpaid: ${auth.amount} < ${amount}`);

  // settling IS the verification: a replayed or tampered authorization is
  // rejected by the program, not by us.
  const transaction = await relay(cfg.conn, cfg.relayer, auth, sig);
  const settlement: SettlementResponse = {
    success: true, transaction, network: cfg.network, payer: auth.payer.toBase58(),
  };
  return { paid: true, settlement, header: encodeSettlementHeader(settlement) };
}

/// Express / Connect. Unpaid requests get a 402 and the quote; paid ones fall
/// through to the real handler with `req.payment` filled in.
export function wall(cfg: WallConfig) {
  return async (req: any, res: any, next: any) => {
    try {
      const r = await check(cfg, req.originalUrl || req.url || "/", req.headers["x-payment"]);
      if (!r.paid) return res.status(402).json(r.body);
      res.setHeader("X-PAYMENT-RESPONSE", r.header);
      req.payment = r.settlement;
      next();
    } catch (e) {
      res.status(402).json({ x402Version: 1, error: (e as Error).message, accepts: [] });
    }
  };
}

/// Fetch-style handlers: Hono, workers, Bun, Deno, plain Request/Response.
export function fetchWall(cfg: WallConfig, handler: (req: Request, settlement: SettlementResponse) => Promise<Response> | Response) {
  return async (req: Request): Promise<Response> => {
    const path = new URL(req.url).pathname;
    try {
      const r = await check(cfg, path, req.headers.get("x-payment"));
      if (!r.paid) {
        return new Response(JSON.stringify(r.body), {
          status: 402, headers: { "content-type": "application/json" },
        });
      }
      const out = await handler(req, r.settlement);
      out.headers.set("X-PAYMENT-RESPONSE", r.header);
      return out;
    } catch (e) {
      return new Response(JSON.stringify({ x402Version: 1, error: (e as Error).message, accepts: [] }), {
        status: 402, headers: { "content-type": "application/json" },
      });
    }
  };
}
