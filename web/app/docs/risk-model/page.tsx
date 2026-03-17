import type { Metadata } from "next";
import { DocHeader, DocPager, Callout, RiskBadge } from "../_components";

export const metadata: Metadata = {
  title: "Risk model",
  description:
    "How crif classifies transactions: the four risk levels, the escalation rules, and the Drift 2026 combo detector.",
  alternates: { canonical: "/docs/risk-model" },
};

export default function Page() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs/risk-model"
        eyebrow="Reference"
        title="Risk model"
        lead="Four levels. Four escalation rules. One Drift combo detector. No heuristics, no learned weights. Every verdict is derivable from the transaction structure alone."
      />

      <h2 className="docs-h2">The four levels</h2>

      <div className="prop-table">
        <table>
          <thead>
            <tr>
              <th>level</th>
              <th>meaning</th>
              <th>examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <RiskBadge level="low" />
              </td>
              <td>Benign user action. Safe to sign without further review.</td>
              <td>
                Small SOL transfer, SPL token transfer below 1&nbsp;000 raw
                units, SPL SetAuthority to the same account.
              </td>
            </tr>
            <tr>
              <td>
                <RiskBadge level="medium" />
              </td>
              <td>
                Human review recommended, but no material loss if the tx is
                not what the user expected.
              </td>
              <td>
                Kamino deposit, Jupiter swap, Drift place_order, SPL Mint
                below the large-mint threshold, unknown program call (this
                is the fallback for programs not in the registry).
              </td>
            </tr>
            <tr>
              <td>
                <RiskBadge level="high" />
              </td>
              <td>
                Material exposure. Losing the tx to the wrong recipient means
                funds or control move in a way that is costly to reverse.
              </td>
              <td>
                New borrow opening a debt position, liquidation, durable
                nonce advance, Drift delegate change, SPL Token SetAuthority
                on a mint, Token-2022 non-transferable mint init.
              </td>
            </tr>
            <tr>
              <td>
                <RiskBadge level="critical" />
              </td>
              <td>
                Do not sign without explicit, step-by-step confirmation of
                what each inner instruction actually does. Material loss or
                loss of control is likely.
              </td>
              <td>
                Squads vault_transaction_execute,
                config_transaction_execute, MarginFi
                set_account_authority, Token-2022 permanent delegate init,
                and the Drift 2026 pattern combo.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="docs-h2">Escalation rules</h2>
      <p>
        The overall risk is computed by starting at <RiskBadge level="low" />{" "}
        and applying four rules in order. Each rule can only raise the
        verdict, never lower it.
      </p>

      <h3 className="docs-h3">1. Per-instruction max</h3>
      <p>
        Every decoded instruction has an intrinsic risk assigned by its
        decoder. The classifier takes the maximum of every instruction&apos;s
        risk as the starting point.
      </p>

      <h3 className="docs-h3">2. Durable nonce</h3>
      <p>
        If the first instruction is{" "}
        <code className="inline-code">System.AdvanceNonceAccount</code>, the
        runtime recognizes the transaction as using a durable nonce and so
        does the engine. The verdict is raised to at least{" "}
        <RiskBadge level="high" /> and a warning is appended to the human
        summary.
      </p>

      <Callout tone="note" title="Why bump to HIGH?">
        A durable nonce transaction does not expire. A signer cannot take it
        back once it is signed. Any tx in this state is effectively a
        long-lived standing order and deserves an explicit review regardless
        of what it says it does.
      </Callout>

      <h3 className="docs-h3">3. Drift 2026 pattern</h3>
      <p>
        If the transaction uses a durable nonce AND contains any instruction
        whose name is one of:
      </p>
      <ul>
        <li>
          <code className="inline-code">config_transaction_execute</code>{" "}
          (Squads v4)
        </li>
        <li>
          <code className="inline-code">multisig_set_config</code>{" "}
          (Squads v4)
        </li>
        <li>
          <code className="inline-code">vault_transaction_execute</code>{" "}
          (Squads v4)
        </li>
      </ul>
      <p>
        ...the verdict is forced to <RiskBadge level="critical" /> and a
        dedicated multi-line callout is prepended to the human summary:
      </p>

      <pre className="term">
        {`[X] CRITICAL — this transaction matches the APRIL 2026
    DRIFT EXPLOIT PATTERN:
    durable nonce + multisig admin execute. the attacker
    that drained $285M from Drift used exactly this shape —
    pre-signed governance actions that stay valid indefinitely.
    DO NOT SIGN without verifying the inner instructions AND
    the nonce account lifecycle.`}
      </pre>

      <Callout tone="critical" title="Why a dedicated rule?">
        The Drift exploit was not stopped by any existing heuristic. It
        looked like a routine council vote. The attacker&apos;s leverage was
        entirely from combining two normally-fine features — Squads admin
        actions and durable nonces. Either one alone is acceptable; the
        combination is the exact failure mode, and the engine refuses to let
        it pass quietly.
      </Callout>

      <h3 className="docs-h3">4. State diff escalation</h3>
      <p>
        The classifier also inspects the simulation state diffs:
      </p>
      <ul>
        <li>
          Any account losing more than 1 SOL (<code className="inline-code">lamports_delta ≤ -1_000_000_000</code>
          ) bumps the verdict to <RiskBadge level="high" />.
        </li>
        <li>
          Any account whose owner program changes (<code className="inline-code">owner_before ≠ owner_after</code>
          ) bumps the verdict to <RiskBadge level="critical" />.
        </li>
      </ul>
      <p>
        In offline mode the state diffs are empty, so rule 4 never fires.
        The other three rules are fully structural and work without RPC.
      </p>

      <h2 className="docs-h2">What the model does NOT do</h2>
      <ul>
        <li>
          <strong>No learned weights.</strong> There is no model file. Every
          verdict is derived from static rules and the transaction structure.
          A new engine build produces identical verdicts on identical
          inputs.
        </li>
        <li>
          <strong>No signature-based allowlisting.</strong> The engine does
          not keep a list of &quot;trusted&quot; signer addresses. Every
          signer is treated the same.
        </li>
        <li>
          <strong>No historical reputation lookups.</strong> The engine does
          not call out to external reputation APIs, block explorers, or
          community feed URLs. Everything it knows is in the crate.
        </li>
        <li>
          <strong>No false positives on benign traffic.</strong> A plain SOL
          transfer with no durable nonce and no multisig admin instructions
          stays at <RiskBadge level="low" />. The test suite verifies this
          explicitly.
        </li>
      </ul>

      <DocPager href="/docs/risk-model" />
    </article>
  );
}
