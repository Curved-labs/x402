import type { Metadata } from "next";
import { DocHeader, DocPager, Callout } from "../_components";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Install crif, run the test suite, and simulate your first transaction against devnet in under two minutes.",
  alternates: { canonical: "/docs/getting-started" },
};

export default function Page() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs/getting-started"
        eyebrow="Getting started"
        title="Quickstart"
        lead="Install the engine, verify it compiles, run the full test suite, then simulate a real transaction against devnet. Start to finish this takes under two minutes on a machine with Rust already installed."
      />

      <h2 className="docs-h2">Prerequisites</h2>
      <ul>
        <li>Rust 1.80 or newer (tested on 1.94).</li>
        <li>
          A working C toolchain (required by a handful of transitive
          dependencies on Windows and Linux).
        </li>
        <li>
          Network access to <code className="inline-code">crates.io</code>{" "}
          and, for the integration test, to{" "}
          <code className="inline-code">api.devnet.solana.com</code>.
        </li>
      </ul>

      <h2 className="docs-h2">1. Clone and build</h2>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">install</span>
        </div>
        {`$ git clone https://github.com/Nulltx-xyz/crif
$ cd crif
$ cargo build --release`}
      </pre>

      <p>
        The first build resolves the Solana 2.0 dependency tree and takes
        roughly 90 seconds on a warm cache. Subsequent incremental builds are
        in the 5–10 second range.
      </p>

      <Callout tone="note" title="Dependency notes">
        The project pins <code className="inline-code">solana-client 2.0</code>,
        <code className="inline-code"> solana-sdk 2.0</code>, and{" "}
        <code className="inline-code">solana-transaction-status 2.0</code>.
        These pin the exact lockstep that avoids the{" "}
        <code className="inline-code">zeroize</code> / <code className="inline-code">curve25519-dalek</code>{" "}
        version conflict present in <code className="inline-code">2.1.x</code>{" "}
        and newer patch releases.
      </Callout>

      <h2 className="docs-h2">2. Run the test suite</h2>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">cargo test</span>
        </div>
        {`$ cargo test

running tests:
  decoder_unit ........... 5 passed
  squads_unit ............ 6 passed
  protocol_decoders ..... 15 passed
  drift_attack_e2e ....... 2 passed
  devnet_integration ..... 1 ignored

total ................... 28 passed, 0 failed`}
      </pre>

      <p>
        The devnet integration test is marked{" "}
        <code className="inline-code">#[ignore]</code> by default so that{" "}
        <code className="inline-code">cargo test</code> stays offline. To
        include it, run:
      </p>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">devnet integration</span>
        </div>
        {`$ cargo test --test devnet_integration -- --ignored --nocapture`}
      </pre>

      <p>
        This test loads{" "}
        <code className="inline-code">~/.config/solana/id.json</code>, fetches
        its devnet balance, builds a real SOL transfer transaction, feeds it
        through <code className="inline-code">build_report</code>, and asserts
        the engine produces a coherent diff. If the keypair has less than{" "}
        0.01 SOL on devnet, the test skips.
      </p>

      <h2 className="docs-h2">3. Simulate a transaction</h2>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">sle simulate</span>
        </div>
        {`$ cargo run --release -- simulate \\
    --tx "$BASE64_TX" \\
    --rpc devnet`}
      </pre>

      <p>
        Replace <code className="inline-code">$BASE64_TX</code> with a
        base64-encoded <code className="inline-code">VersionedTransaction</code>.
        The engine will fetch the writable-account pre-state from devnet,
        call simulateTransaction, diff the result, decode every instruction,
        and print a human-readable report.
      </p>

      <h2 className="docs-h2">4. Reproduce the Drift 2026 attack</h2>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">drift attack reproduction</span>
        </div>
        {`$ cargo run --example drift_attack

> overall_risk        = Critical
> uses_durable_nonce  = true`}
      </pre>

      <p>
        This example synthesizes a transaction whose shape matches the April
        2026 Drift exploit (AdvanceNonceAccount followed by{" "}
        <code className="inline-code">Squads.config_transaction_execute</code>),
        serializes it to base64, and runs it through the offline report
        pipeline. The verdict is{" "}
        <strong style={{ color: "var(--danger)" }}>CRITICAL</strong>.
      </p>

      <Callout tone="ok" title="You are done">
        The engine is installed, tested, and verified. Head to{" "}
        <a href="/docs/cli">CLI reference</a> for every flag, or to{" "}
        <a href="/docs/drift-2026">Drift 2026 post-mortem</a> for the full
        attack analysis.
      </Callout>

      <DocPager href="/docs/getting-started" />
    </article>
  );
}
