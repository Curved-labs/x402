import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocPager, Callout } from "./_components";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "crif — transaction legibility and simulation engine for Solana. Full reference, architecture, CLI, risk model, and the April 2026 Drift exploit post-mortem.",
  alternates: { canonical: "/docs" },
};

export default function DocsOverview() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs"
        eyebrow="Introduction"
        title="crif"
        lead="A transaction legibility and simulation engine for Solana. Decodes what an instruction actually does, diffs state against live RPC, and detects the exact shape that drained $285 million out of Drift on April 1, 2026."
      />

      <Callout tone="warn" title="Why this exists">
        On April 1, 2026, two Drift Security Council members signed a
        routine-looking transaction whose payload was a{" "}
        <code className="inline-code">config_transaction_execute</code> wrapped
        in a durable nonce. They could not see what they were authorizing. The
        attacker sat on the pre-signed tx for a week and then fired it. Twelve
        minutes later $285M was on Ethereum. This engine is the layer that
        would have shown them.
      </Callout>

      <h2 className="docs-h2">What it does</h2>
      <p>
        Given a serialized versioned transaction, the engine:
      </p>
      <ol>
        <li>
          Fetches pre-state for every writable account via JSON-RPC.
        </li>
        <li>
          Calls <code className="inline-code">simulateTransaction</code> with
          the accounts config and captures the post-state image.
        </li>
        <li>
          Computes per-account state diffs: lamport delta, owner change,
          data-length change, raw byte delta.
        </li>
        <li>
          Decodes every top-level instruction through a program-aware
          registry covering 8 programs and 80+ instructions.
        </li>
        <li>
          Detects durable-nonce transactions from the first instruction and
          escalates their risk.
        </li>
        <li>
          Flags the Drift 2026 pattern — durable nonce + multisig admin
          execute — as <strong>CRITICAL</strong>.
        </li>
        <li>
          Returns a <code className="inline-code">LegibilityReport</code>{" "}
          that is safe to render in any UI or pipe into any automated review.
        </li>
      </ol>

      <h2 className="docs-h2">Design principles</h2>
      <p>
        <strong>Offline by default.</strong> The engine can run without any
        network access. You pass a base64 transaction and the{" "}
        <code className="inline-code">--offline</code> flag; the decoder and
        classifier run on the static transaction structure alone. No keys
        leave the machine. No telemetry.
      </p>
      <p>
        <strong>Program-aware, not signature-aware.</strong> There is no
        heuristic scoring, no ML model, no signal learned from historical
        attacks. Every verdict is derived from the actual program IDs,
        instruction discriminators, and account layouts present in the tx.
      </p>
