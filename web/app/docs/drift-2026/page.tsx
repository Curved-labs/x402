import type { Metadata } from "next";
import { DocHeader, DocPager, Callout } from "../_components";

export const metadata: Metadata = {
  title: "Drift 2026 post-mortem",
  description:
    "Full technical post-mortem of the April 2026 Drift Protocol $285M exploit. Timeline, root cause, durable-nonce mechanics, and how crif would have detected the exact transaction shape before signing.",
  alternates: { canonical: "/docs/drift-2026" },
};

export default function Page() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs/drift-2026"
        eyebrow="Security"
        title="Drift 2026 — a post-mortem"
        lead="On April 1, 2026, a coordinated group linked to North Korean state actors drained $285 million from Drift Protocol's Squads multisig. They did not exploit a bug. They did not steal a key. This page reconstructs the attack from public reporting and explains, line by line, how this engine would have flagged the fatal transaction before either council member hit sign."
      />

      <Callout tone="critical" title="The uncomfortable truth">
        The Drift team had done everything that the standard Solana DeFi
        playbook recommends in 2025. Squads multisig. Hardware wallets.
        Off-chain review process. The exploit didn&apos;t break any of that.
        It used a combination of two normally-safe features —{" "}
        <strong>Squads admin instructions</strong> and{" "}
        <strong>durable nonces</strong> — in a way that made the pre-signing
        step look identical to a routine upgrade. The signers, at the moment
        they approved, had no way to see what they were authorizing. This
        engine is the missing layer.
      </Callout>

      <h2 className="docs-h2">Topline</h2>
      <ul>
        <li>
          <strong>Loss:</strong> approximately $285 million, &gt;50% of
          Drift&apos;s TVL.
        </li>
        <li>
          <strong>Attacker:</strong> North Korea-linked group (TRM Labs
          attribution, consistent with Lazarus tactics).
        </li>
        <li>
          <strong>Method:</strong> six-month social engineering buildup, then
          pre-signed{" "}
          <code className="inline-code">config_transaction_execute</code>{" "}
          wrapped in durable nonces.
        </li>
        <li>
          <strong>Time from fire to drain:</strong> 12 minutes.
        </li>
        <li>
          <strong>Time from drain to Ethereum:</strong> under one hour.
        </li>
        <li>
          <strong>Second largest Solana exploit of all time</strong>, behind
          only the 2022 Wormhole bridge hack ($326M).
        </li>
      </ul>

      <h2 className="docs-h2">Timeline</h2>

      <h3 className="docs-h3">Six months before — the buildup</h3>
      <p>
        The attacker group stood up a fake quantitative trading firm with a
        plausible brand, a website, public LinkedIn profiles, and a GitHub
        organization hosting clean-looking Rust and TypeScript code. They
        approached Drift contributors via Discord and Telegram with
        proposals framed as liquidity partnerships and market-making
        integrations. Over months they built up relationships that looked
        identical to the kind of business development conversations a
        growing DeFi protocol handles every week.
      </p>
      <p>
        The goal of this phase was not to extract credentials or compromise
        a machine. The goal was to become someone whose upcoming
        transaction, once it appeared in the council&apos;s review channel,
        would read as routine business.
      </p>

      <h3 className="docs-h3">March 23, 2026 — the pre-signing</h3>
      <p>
        The attacker presented a transaction framed as a &quot;routine
        upgrade&quot;: a Squads{" "}
        <code className="inline-code">config_transaction_execute</code> that
        would, in the attacker&apos;s framing, apply an already-queued
        config change. Two council members signed it. The signatures were
        attached to transactions using a{" "}
        <strong>durable nonce</strong> — a Solana feature that replaces the
        usual expiring recent-blockhash with a fixed on-chain nonce account,
        making the signed transaction valid indefinitely.
      </p>
      <p>
        In parallel, the attacker created four durable-nonce accounts on
        chain. Two of them were wired to the signatures the council members
        had just provided. Two of them were controlled entirely by the
        attacker and used for follow-up transactions once admin control was
        seized.
      </p>

      <Callout tone="warn" title="What the council members thought they were approving">
        A routine upgrade. The signing UI showed them a 32-byte message
        hash, an instruction list with cryptic account indices, and a
        Squads proposal reference. The actual inner effect — a full admin
        authority transfer — was encoded inside a vault_transaction account
        whose bytes the signing flow did not render in any human-readable
        form. This is the{" "}
        <strong>transaction legibility</strong> gap.
      </Callout>

      <h3 className="docs-h3">April 1, 2026 — the fire</h3>
      <p>
        Approximately 12:00 UTC, the attacker submitted the pre-signed
        durable-nonce transactions. Because durable-nonce transactions have
        no blockhash expiry, the signatures collected on March 23 were
        still valid. Within 4 slots of each other, two transactions landed:
      </p>
      <ol>
        <li>
          The first invoked{" "}
          <code className="inline-code">config_transaction_execute</code> on
          the Squads multisig, applying a config change that transferred
          the Drift Protocol admin authority.
        </li>
        <li>
          The second invoked the admin transfer itself, moving the program
          authority fully under the attacker&apos;s control.
        </li>
      </ol>

      <h3 className="docs-h3">+ 1 minute — the drain</h3>
      <p>
        With admin authority in hand, the attacker executed a sequence that
        had been prepared in advance:
      </p>
      <ol>
        <li>
          Whitelisted a worthless, artificially-priced fake token (CVT) as
          valid Drift collateral.
        </li>
        <li>
          Deposited 500 million CVT into a Drift user account.
        </li>
        <li>
          Used the CVT collateral to withdraw roughly $285 million in real
          USDC, SOL, and ETH.
        </li>
      </ol>

      <h3 className="docs-h3">+ 12 minutes — Ethereum</h3>
      <p>
        The bulk of the stolen value was bridged to Ethereum within the
        first hour. Approximately 232 million USDC made it through the
        bridge before Circle&apos;s compliance process could freeze
        anything. ZachXBT publicly criticized Circle&apos;s handling of the
        freeze window.
      </p>

      <h2 className="docs-h2">The technical root cause</h2>
      <p>
        The exploit combined three normally-safe mechanisms in a sequence
        that no single mechanism was designed to prevent.
      </p>

      <h3 className="docs-h3">1. Durable nonces</h3>
      <p>
        Durable nonces exist for a legitimate reason: hardware wallets,
        offline signing setups, and institutional custody flows all need the
        ability to prepare and approve transactions without being forced to
        submit them within Solana&apos;s ~90 second blockhash window. The
        trade-off is that a signature attached to a durable-nonce
        transaction is valid indefinitely, until someone either submits the
        transaction or manually advances the nonce account.
      </p>
      <p>
        There is no user-facing revoke-my-signature operation. Once the
        signatures exist, the only way to invalidate them is to advance the
        nonce account out-of-band — an operation that the average signer
        does not monitor or even know about.
