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
      <p>
        <strong>Fail loud, fail honest.</strong> Unknown programs receive a{" "}
        <code className="inline-code">MEDIUM</code> fallback with a{" "}
        &quot;requires human review&quot; reason. Unknown Anchor
        discriminators receive the same. The engine never silently approves
        something it does not understand.
      </p>

      <h2 className="docs-h2">Start here</h2>
      <div className="docs-grid">
        <Link href="/docs/getting-started" className="docs-card">
          <div className="card-label">01 · start</div>
          <div className="card-title">Quickstart</div>
          <div className="card-desc">
            Install, verify the test suite, and simulate a transaction in
            under two minutes.
          </div>
        </Link>
        <Link href="/docs/architecture" className="docs-card">
          <div className="card-label">02 · arch</div>
          <div className="card-title">Architecture</div>
          <div className="card-desc">
            How the orchestrator wires RPC fetch → simulate → diff → decode →
            classify.
          </div>
        </Link>
        <Link href="/docs/cli" className="docs-card">
          <div className="card-label">03 · cli</div>
          <div className="card-title">CLI reference</div>
          <div className="card-desc">
            Every subcommand, every flag, every output mode.
          </div>
        </Link>
        <Link href="/docs/api-reference" className="docs-card">
          <div className="card-label">04 · api</div>
          <div className="card-title">LegibilityReport shape</div>
          <div className="card-desc">
            Field-by-field specification of the JSON emission.
          </div>
        </Link>
        <Link href="/docs/risk-model" className="docs-card">
          <div className="card-label">05 · risk</div>
          <div className="card-title">Risk model</div>
          <div className="card-desc">
            The four levels, the escalation rules, and the Drift combo
            detector.
          </div>
        </Link>
        <Link href="/docs/decoders" className="docs-card">
          <div className="card-label">06 · cov</div>
          <div className="card-title">Decoder coverage</div>
          <div className="card-desc">
            All 8 programs and 80+ instructions, with per-instruction risk
            defaults.
          </div>
        </Link>
        <Link href="/docs/drift-2026" className="docs-card">
          <div className="card-label">07 · sec</div>
          <div className="card-title">Drift 2026 post-mortem</div>
          <div className="card-desc">
            The timeline, the technical root cause, and how this engine would
            have caught it.
          </div>
        </Link>
        <Link href="/docs/integrate" className="docs-card">
          <div className="card-label">08 · lib</div>
          <div className="card-title">Rust library usage</div>
          <div className="card-desc">
            Integrate the engine into your own signing flow as a crate, not a
            subprocess.
          </div>
        </Link>
      </div>

      <DocPager href="/docs" />
    </article>
  );
}
