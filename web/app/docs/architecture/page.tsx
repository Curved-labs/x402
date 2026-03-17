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

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">report.rs (excerpt)</span>
        </div>
        {`/// Full report: runs simulation against live RPC, diffs state,
/// decodes, classifies.
pub async fn build_report(
    cfg: &EngineConfig,
    tx: &VersionedTransaction,
) -> Result<LegibilityReport>;

/// Offline report: skips simulation entirely. Runs the decoder
/// and classifier against the transaction's static structure only.
/// Useful for auditing a tx before it touches any RPC, and for
/// programs that may not be deployed on the current cluster.
pub fn build_report_offline(
    tx: &VersionedTransaction,
) -> LegibilityReport;`}
      </pre>

      <p>
        Both functions converge on a private{" "}
        <code className="inline-code">assemble_report</code> helper that runs
        decode + classify identically. The only difference is where the state
        diffs and token transfers come from: the full path extracts them from
        the simulation outcome, the offline path passes empty vectors.
      </p>

      <h2 className="docs-h2">The decoder registry</h2>
      <p>
        A <code className="inline-code">DecoderRegistry</code> is a{" "}
        <code className="inline-code">HashMap&lt;Pubkey, Arc&lt;dyn ProgramDecoder&gt;&gt;</code>.
        Each protocol decoder implements a three-method trait:
      </p>

      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">ProgramDecoder trait</span>
        </div>
        {`pub trait ProgramDecoder: Send + Sync {
    fn program_id(&self) -> Pubkey;
    fn program_name(&self) -> &'static str;
    fn decode(
        &self,
        ix: &CompiledInstruction,
        account_keys: &[Pubkey],
    ) -> Option<DecodedInstruction>;
}`}
      </pre>

      <p>
        Native programs (System, SPL Token, Token-2022) have bespoke decoders
        that match on the raw instruction tag byte. Anchor programs (Squads,
        Jupiter, Drift v2, Kamino, MarginFi) go through{" "}
        <code className="inline-code">GenericAnchorDecoder</code>, which takes
        a static table of <code className="inline-code">(instruction_name, display_name, summary, risk, reasons)</code>{" "}
        tuples and computes Anchor&apos;s{" "}
        <code className="inline-code">sha256(&quot;global:&lt;name&gt;&quot;)[0..8]</code>{" "}
        discriminators at first call, caching them in a{" "}
        <code className="inline-code">OnceLock</code>.
      </p>

      <Callout tone="note" title="Why a generic Anchor decoder?">
        Five of the eight programs are Anchor-based and share the same
        discriminator layout. Rather than duplicate the match-on-first-8-bytes
        logic five times, a single helper takes a program id + a static table
        and returns a <code className="inline-code">ProgramDecoder</code>. The
        protocol modules are data, not logic. Adding a new Anchor program
        requires only a new{" "}
        <code className="inline-code">&lt;program&gt;.rs</code> file with a
        table and a one-line registration in{" "}
        <code className="inline-code">registry.rs</code>.
      </Callout>

      <h2 className="docs-h2">The classifier</h2>
      <p>
        The classifier takes decoded instructions, state diffs, token
        transfers, and a durable-nonce flag, and returns{" "}
        <code className="inline-code">(RiskLevel, Vec&lt;String&gt;)</code>{" "}
        — the overall verdict and the human summary lines. It applies four
        kinds of rules in order:
      </p>

      <ol>
        <li>
          Per-instruction escalation — the overall risk is the maximum of
          every decoded instruction&apos;s risk.
        </li>
        <li>
          Durable nonce escalation — if the first instruction is{" "}
          <code className="inline-code">AdvanceNonceAccount</code>, the risk
          is bumped to at least HIGH.
        </li>
        <li>
          Drift pattern detection — if the tx uses a durable nonce AND
          contains any of{" "}
          <code className="inline-code">config_transaction_execute</code>,{" "}
          <code className="inline-code">multisig_set_config</code>, or{" "}
          <code className="inline-code">vault_transaction_execute</code>, the
          risk is forced to CRITICAL with a dedicated Drift 2026 callout.
        </li>
        <li>
          State diff escalation — large lamport outflows (≥1 SOL) and owner
          program changes escalate the overall risk.
        </li>
      </ol>

      <p>
        All rules are pure functions of their inputs. The classifier has no
        state, no configuration, and no external dependencies. Its full source
        is about 100 lines.
      </p>

      <DocPager href="/docs/architecture" />
    </article>
  );
}
