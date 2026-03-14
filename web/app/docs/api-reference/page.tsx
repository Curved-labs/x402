import type { Metadata } from "next";
import { DocHeader, DocPager, Callout, PropTable } from "../_components";

export const metadata: Metadata = {
  title: "LegibilityReport",
  description:
    "Full field-by-field specification of the LegibilityReport JSON emission — the stable output of every simulate invocation.",
  alternates: { canonical: "/docs/api-reference" },
};

export default function Page() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs/api-reference"
        eyebrow="Reference"
        title="LegibilityReport"
        lead="Every simulate call returns a LegibilityReport. Its JSON shape is stable across patch versions, safe to pipe into jq, render in a UI, or persist in a database for later review."
      />

      <h2 className="docs-h2">Top-level shape</h2>
      <pre className="term">
        <div className="term-head">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="title">LegibilityReport.json</span>
        </div>
        {`{
  "tx_signature_preview": "4dLPchZ8d2eCX2eobPtT9eN4DHw...",
  "fee_payer":            "4kfEfEk7HrCLpdqo3vtrMYYF9e...",
  "uses_durable_nonce":   true,
  "durable_nonce_warning": "Transaction uses a durable nonce ...",
  "instructions":   [ DecodedInstruction, ... ],
  "account_diffs":  [ AccountDiff, ... ],
  "token_transfers": [ TokenTransfer, ... ],
  "overall_risk":   "Critical",
  "human_summary":  [ "[System Program] ...", ... ],
  "simulation_logs": [ "Program 11111... invoke [1]", ... ],
  "simulation_success": true,
  "simulation_error":   null
}`}
      </pre>

      <PropTable
        rows={[
          {
            name: "tx_signature_preview",
            type: "string",
            desc: "The first 88-char signature of the tx, or '(unsigned)' if the tx has no signatures. Used as a human-readable identifier in logs and UI.",
          },
          {
            name: "fee_payer",
            type: "string",
            desc: "Base58 pubkey of the first static account key in the message, which is always the fee payer by Solana convention.",
          },
          {
            name: "uses_durable_nonce",
            type: "boolean",
            desc: "True iff the first instruction is a System Program AdvanceNonceAccount. This is the only way the runtime permits durable-nonce transactions, so the detection is exact.",
          },
          {
            name: "durable_nonce_warning",
            type: "string | null",
            desc: "Human-readable warning emitted when uses_durable_nonce is true. Null otherwise.",
          },
          {
            name: "instructions",
            type: "DecodedInstruction[]",
            desc: "One entry per top-level instruction in the message, in on-wire order. Never empty for a well-formed transaction.",
          },
          {
            name: "account_diffs",
            type: "AccountDiff[]",
            desc: "Per-account state diffs from the simulation pre/post snapshots. Empty in offline mode or when no writable account changed.",
          },
          {
            name: "token_transfers",
            type: "TokenTransfer[]",
            desc: "Token transfer events synthesized from SPL Token / Token-2022 account layout in the pre/post diffs. Does not require a top-level Transfer instruction — CPI-only transfers are still captured.",
          },
          {
            name: "overall_risk",
            type: "RiskLevel",
            desc: "The merged verdict. One of: Low, Medium, High, Critical. See /docs/risk-model for the exact escalation rules.",
          },
          {
            name: "human_summary",
            type: "string[]",
            desc: "Ordered human-readable lines suitable for printing verbatim in a terminal or rendering as a list in a UI. Always non-empty.",
          },
          {
            name: "simulation_logs",
            type: "string[]",
            desc: "The logs field from simulateTransaction, or ['(offline mode — simulation skipped)'] in offline mode.",
          },
          {
            name: "simulation_success",
            type: "boolean",
            desc: "True if the simulation returned no error. Always true in offline mode.",
          },
          {
            name: "simulation_error",
            type: "string | null",
            desc: "The TransactionError formatted as a string, or null if the simulation succeeded.",
          },
        ]}
      />

      <h2 className="docs-h2">DecodedInstruction</h2>
      <PropTable
        rows={[
          {
            name: "program_id",
            type: "string",
            desc: "Base58 pubkey of the program the instruction targets.",
          },
          {
            name: "program_name",
            type: "string",
            desc: "Friendly name the decoder assigned: System Program, SPL Token, Token-2022, Squads v4, Jupiter v6, Drift v2, Kamino Lend, MarginFi v2, or Unknown.",
          },
          {
            name: "instruction_name",
            type: "string",
            desc: "Specific instruction the decoder matched: Transfer, AdvanceNonceAccount, config_transaction_execute, etc. For Unknown programs, this is also 'Unknown'.",
          },
          {
            name: "summary",
