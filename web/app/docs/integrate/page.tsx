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
