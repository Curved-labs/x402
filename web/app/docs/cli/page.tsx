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

      <h3 className="docs-h3">Simulate against mainnet-beta</h3>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">mainnet · human output</span>
        </div>
        {`$ sle simulate --tx "$BASE64_TX" --rpc mainnet`}
      </pre>

      <Callout tone="warn" title="Public mainnet-beta rate limiting">
        The public{" "}
        <code className="inline-code">api.mainnet-beta.solana.com</code>{" "}
        endpoint is aggressively rate-limited. For sustained use, point the
        engine at a premium RPC by passing its URL directly to{" "}
        <code className="inline-code">--rpc</code>:
        <br />
        <br />
        <code className="inline-code">--rpc https://YOUR.helius-rpc.com/?api-key=...</code>
      </Callout>

      <h3 className="docs-h3">Offline — no network, structure-only</h3>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">offline · human output</span>
        </div>
        {`$ sle simulate --tx "$BASE64_TX" --offline`}
      </pre>

      <h3 className="docs-h3">Offline + JSON — pipeline mode</h3>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">offline · json · jq</span>
        </div>
        {`$ sle simulate --tx "$BASE64_TX" --offline --json | jq '.overall_risk'
"Critical"

$ sle simulate --tx "$BASE64_TX" --offline --json \\
    | jq '.instructions[] | {program: .program_name, risk: .risk}'`}
      </pre>

      <h2 className="docs-h2">Exit codes</h2>
      <div className="prop-table">
        <table>
          <thead>
            <tr>
              <th>code</th>
              <th>meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">0</td>
              <td>
                Report built successfully. The report may still contain a
                CRITICAL verdict — the exit code reflects only whether the
                pipeline itself succeeded.
              </td>
            </tr>
            <tr>
              <td className="mono">1</td>
              <td>
                Runtime error: base64 decode failure, bincode deserialize
                failure, or RPC error in non-offline mode.
              </td>
            </tr>
            <tr>
              <td className="mono">2</td>
              <td>
                Argument parsing error (missing <code className="inline-code">--tx</code>,
                invalid flag combination, etc.). Emitted by clap.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Callout tone="note">
        If you want the CLI to exit non-zero on CRITICAL verdicts for use in
        CI gates, wrap it in{" "}
        <code className="inline-code">--json</code> + jq:{" "}
        <code className="inline-code">
          {`test "$(sle simulate --offline --json --tx $TX | jq -r .overall_risk)" != "Critical"`}
        </code>
      </Callout>

      <DocPager href="/docs/cli" />
    </article>
  );
}
