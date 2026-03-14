import type { Metadata } from "next";
import { DocHeader, DocPager, Callout } from "../_components";

export const metadata: Metadata = {
  title: "CLI reference",
  description:
    "Complete CLI reference for crif: every subcommand, every flag, every output mode.",
  alternates: { canonical: "/docs/cli" },
};

export default function Page() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs/cli"
        eyebrow="Reference"
        title="CLI reference"
        lead="The sle binary ships as a single subcommand — simulate. Four flags cover every supported mode: devnet, mainnet, custom RPC, offline, human output, JSON output."
      />

      <h2 className="docs-h2">Invocation</h2>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">sle --help</span>
        </div>
        {`sle 0.1.0
Solana Transaction Legibility & Simulation Engine

USAGE:
    sle <COMMAND>

COMMANDS:
    simulate    Simulate a base64-encoded versioned transaction
                and print a legibility report.
    help        Print this message or the help of the given subcommand.

OPTIONS:
    -V, --version    Print version info
    -h, --help       Print help`}
      </pre>

      <h2 className="docs-h2">sle simulate</h2>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">sle simulate --help</span>
        </div>
        {`Simulate a base64-encoded versioned transaction and print a
legibility report.

USAGE:
    sle simulate [OPTIONS] --tx <BASE64>

OPTIONS:
    --tx <BASE64>
        Base64-encoded serialized VersionedTransaction.
        Required.

    --rpc <ENDPOINT>
        RPC endpoint to use. Accepts one of the named aliases
        "devnet" or "mainnet" / "mainnet-beta", or any
        fully-qualified https:// URL.
        [default: devnet]

    --offline
        Skip RPC simulation entirely. Runs the decoder and
        classifier against the transaction's static structure
        only. No network access required.
        Useful for auditing a tx before it touches any RPC,
        and for programs that may not be deployed on the
        current cluster.

    --json
        Emit raw JSON (LegibilityReport) instead of the
        human-readable terminal format. Stable shape, safe
        to pipe into jq or downstream tooling.

    -h, --help
        Print help`}
      </pre>

      <h2 className="docs-h2">Examples</h2>

      <h3 className="docs-h3">Simulate against public devnet</h3>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">devnet · human output</span>
        </div>
        {`$ sle simulate --tx "$BASE64_TX" --rpc devnet`}
      </pre>
