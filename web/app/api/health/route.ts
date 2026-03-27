import { NextResponse } from "next/server";

/**
 * Public health endpoint that doubles as a bot trust signal.
 *
 * Per the cross-verify spec: we are **pre-deployment**, so we intentionally
 * omit any `program` field (no mainnet CA yet). Instead we expose a
 * `stage: "pre-deployment"` field and leave the deployment map as "pending".
 */
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const body = {
    status: "ok",
    name: "crif",
    description:
      "Transaction legibility engine for Solana. Decodes instructions, diffs state, detects the Drift 2026 exploit pattern.",
    network: "solana",
    stage: "pre-deployment",
    version: "0.1.0",
    deployment: {
      devnet: "pending",
      mainnet: "pending",
    },
    coverage: {
      programs: 8,
      instructions: 80,
      tests_passing: 28,
      tests_failing: 0,
    },
    features: [
      "versioned-transaction-simulation",
      "state-diff",
      "anchor-discriminator-decoding",
      "durable-nonce-detection",
      "drift-2026-pattern-detection",
      "offline-mode",
    ],
    last_updated: new Date().toISOString().slice(0, 10),
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
