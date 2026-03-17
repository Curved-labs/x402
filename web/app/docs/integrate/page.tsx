import type { Metadata } from "next";
import { DocHeader, DocPager, Callout } from "../_components";

export const metadata: Metadata = {
  title: "Rust library usage",
  description:
    "Integrate crif into your own Rust application as a library, not a subprocess. Call build_report / build_report_offline directly and render the resulting LegibilityReport in your signing flow.",
  alternates: { canonical: "/docs/integrate" },
};

export default function Page() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs/integrate"
        eyebrow="Integrate"
        title="Rust library usage"
        lead="The engine is a plain Rust crate. If you are building a wallet, a signing tool, a CI gate, or an exchange's review pipeline, you can call build_report directly and render the resulting LegibilityReport inside your own UI — no subprocess, no CLI plumbing."
      />

      <h2 className="docs-h2">Add the dependency</h2>
      <p>
        The crate is not yet published on crates.io (v0.1.0 is
        pre-deployment). For now, use a git dependency:
      </p>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">Cargo.toml</span>
        </div>
        {`[dependencies]
crif = { git = "https://github.com/Nulltx-xyz/crif", branch = "main" }
solana-sdk = "2.0"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }`}
      </pre>

      <Callout tone="note">
        Pin <code className="inline-code">solana-sdk</code> to the same major
        version the engine uses (<code className="inline-code">2.0</code>).
        Mismatching against <code className="inline-code">2.1.x</code> or
        newer pulls in a known zeroize / curve25519-dalek conflict.
      </Callout>

      <h2 className="docs-h2">Offline report (no RPC)</h2>
      <p>
        The offline path is a synchronous function. Given any{" "}
        <code className="inline-code">VersionedTransaction</code> reference,
        it returns a fully-populated{" "}
        <code className="inline-code">LegibilityReport</code> by decoding
        and classifying the transaction&apos;s static structure alone.
      </p>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">offline usage</span>
        </div>
        {`use crif::{
    report::build_report_offline,
    types::{LegibilityReport, RiskLevel},
};
use solana_sdk::transaction::VersionedTransaction;

fn review_before_sign(tx: &VersionedTransaction) -> bool {
    let report: LegibilityReport = build_report_offline(tx);

    match report.overall_risk {
        RiskLevel::Low | RiskLevel::Medium => {
            // OK to sign immediately.
            true
        }
        RiskLevel::High => {
            // Require explicit user confirmation.
            display_warning(&report);
            user_confirms(&report)
        }
        RiskLevel::Critical => {
            // Hard stop. Do not sign.
            display_critical(&report);
            false
        }
    }
}`}
      </pre>

      <h2 className="docs-h2">Full report (with RPC simulation)</h2>
      <p>
        The full path is <code className="inline-code">async</code> and
        expects a Tokio runtime. It takes an{" "}
        <code className="inline-code">EngineConfig</code> specifying the RPC
        endpoint and commitment, then walks the whole pipeline.
      </p>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">full usage (async)</span>
        </div>
        {`use crif::{
    engine::EngineConfig,
    report::build_report,
    types::{LegibilityReport, RiskLevel},
};
use solana_sdk::transaction::VersionedTransaction;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cfg = EngineConfig::devnet();
    // Or: EngineConfig::mainnet_beta()
    // Or: EngineConfig { rpc_url: "https://...helius-rpc.com/?...".into(),
    //                    commitment: CommitmentConfig::confirmed(),
    //                    replace_blockhash: true }

    let tx: VersionedTransaction = /* your tx */;
    let report: LegibilityReport = build_report(&cfg, &tx).await?;

    // Render, audit, gate — whatever your flow needs.
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}`}
      </pre>

      <h2 className="docs-h2">Inspect specific fields</h2>
      <p>
        The <code className="inline-code">LegibilityReport</code> type
        derives <code className="inline-code">serde::Serialize</code> and{" "}
        <code className="inline-code">serde::Deserialize</code>, so you can
        destructure it freely or round-trip it through JSON.
      </p>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">inspection</span>
        </div>
        {`if report.uses_durable_nonce {
    // This transaction will not expire — treat the signature
    // as a long-lived standing order.
}

for ix in &report.instructions {
    println!("{}.{} ({:?})",
        ix.program_name, ix.instruction_name, ix.risk);
    for reason in &ix.risk_reasons {
        println!("  reason: {}", reason);
    }
}

for diff in &report.account_diffs {
    if diff.owner_before != diff.owner_after {
        // Owner change: the classifier will have escalated
        // overall_risk to Critical already.
    }
}`}
      </pre>

      <h2 className="docs-h2">CI gate pattern</h2>
      <p>
        The most common integration outside a wallet is a CI-time gate that
        refuses to merge pull requests proposing governance transactions
        that would trip the Drift pattern. A minimal version:
      </p>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">gate.rs</span>
        </div>
        {`use crif::{
    report::build_report_offline, types::RiskLevel,
};
use std::process::ExitCode;

fn main() -> ExitCode {
    let Some(tx_b64) = std::env::args().nth(1) else {
        eprintln!("usage: gate <BASE64_TX>");
        return ExitCode::from(2);
    };
    let raw = base64::engine::general_purpose::STANDARD
        .decode(tx_b64.as_bytes())
        .expect("base64 decode");
    let tx = bincode::deserialize(&raw).expect("bincode decode");
    let report = build_report_offline(&tx);

    match report.overall_risk {
        RiskLevel::Critical => {
            eprintln!("BLOCKED: {:?}", report.overall_risk);
            for line in &report.human_summary {
                eprintln!("  {}", line);
            }
            ExitCode::from(1)
        }
        _ => ExitCode::from(0),
    }
}`}
      </pre>

      <Callout tone="ok" title="What's next">
        See the <a href="/docs/api-reference">LegibilityReport reference</a>{" "}
        for the full type specification, or the{" "}
        <a href="/docs/risk-model">risk model</a> for the exact escalation
        rules the classifier applies before returning a verdict.
      </Callout>

      <DocPager href="/docs/integrate" />
    </article>
  );
}
