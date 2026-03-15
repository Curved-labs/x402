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
