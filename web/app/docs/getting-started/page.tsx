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
