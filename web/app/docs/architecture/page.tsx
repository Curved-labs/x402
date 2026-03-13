import type { Metadata } from "next";
import { DocHeader, DocPager, Callout } from "../_components";

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "How crif is built: orchestrator, engine core, decoder registry, classifier, and the build_report / build_report_offline split.",
  alternates: { canonical: "/docs/architecture" },
};

export default function Page() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs/architecture"
        eyebrow="Architecture"
        title="How the engine is built"
        lead="Four modules, one orchestrator, zero global state. Everything is a pure function of the input transaction and the RPC response."
      />

      <h2 className="docs-h2">The pipeline</h2>
      <p>
        Every invocation goes through the same five-step pipeline. Steps 1-3
        are skipped in offline mode.
      </p>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">build_report pipeline</span>
        </div>
        {`  VersionedTransaction
         |
         v
  +------------------+       (offline mode skips 1-3)
  |  1. fetch        |   get_multiple_accounts for every
  |     pre-state    |   writable account in the message
  +------------------+
         |
         v
  +------------------+
  |  2. simulate     |   simulateTransaction with
  |                  |   replaceRecentBlockhash = true
  +------------------+   + accounts config (post-state)
         |
         v
  +------------------+
  |  3. diff         |   per-account: lamport delta,
  |                  |   owner change, data change
  +------------------+
         |
         v
  +------------------+   program_id -> decoder lookup,
  |  4. decode       |   registry has 8 program decoders,
  |                  |   unknown programs -> MEDIUM fallback
  +------------------+
         |
         v
  +------------------+   merges per-ix risk, lamport
  |  5. classify     |   outflow, owner changes, durable
  |                  |   nonce, drift-pattern combo
  +------------------+
         |
         v
  LegibilityReport`}
      </pre>

      <h2 className="docs-h2">Module layout</h2>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">crate tree</span>
        </div>
        {`crif/
  src/
    types.rs              LegibilityReport, AccountDiff, RiskLevel,
                          DecodedInstruction, TokenTransfer
    engine/
      mod.rs              re-exports
      simulate.rs         RPC fetch + simulateTransaction call,
                          writable-account extraction,
                          pre/post snapshot pairing
      diff.rs             per-account state diff computation
    decoder/
      mod.rs              ProgramDecoder trait + decode_all()
      registry.rs         program_id -> Arc<dyn ProgramDecoder>
      anchor_generic.rs   reusable Anchor discriminator matcher
      system.rs           System Program (native)
      spl_token.rs        SPL Token (native, shared with token-2022)
      token_2022.rs       Token-2022 base + extension tags
      squads.rs           Squads v4 (custom, Drift reasoning)
      jupiter.rs          Jupiter v6 (generic anchor)
      drift_v2.rs         Drift v2 (generic anchor)
      kamino.rs           Kamino Lend (generic anchor)
      marginfi.rs         MarginFi v2 (generic anchor)
    classifier/
      mod.rs              risk synthesis + drift-pattern detection +
                          human_summary line generation
    report.rs             orchestrator: build_report,
                          build_report_offline, assemble_report
    main.rs               CLI entry point
    lib.rs                crate root
  tests/
    decoder_unit.rs       5 tests (System, SPL Token)
    squads_unit.rs        6 tests (Squads + drift pattern)
    protocol_decoders.rs 15 tests (Jupiter, Drift, Kamino,
                          MarginFi, Token-2022)
    drift_attack_e2e.rs   2 tests (full pipeline + base64 roundtrip)
    devnet_integration.rs 1 test (ignored, real devnet)
  examples/
    drift_attack.rs       synthesizes the Drift 2026 attack tx
                          and prints base64 + offline report`}
      </pre>

      <h2 className="docs-h2">The orchestrator</h2>
      <p>
        The entire public API is two functions in{" "}
        <code className="inline-code">src/report.rs</code>:
      </p>

