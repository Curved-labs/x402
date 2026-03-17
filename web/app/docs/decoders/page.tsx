import type { Metadata } from "next";
import { DocHeader, DocPager, RiskBadge, Callout } from "../_components";

export const metadata: Metadata = {
  title: "Decoder coverage",
  description:
    "All 8 programs and 80+ instructions covered by crif, with per-instruction risk defaults and program IDs.",
  alternates: { canonical: "/docs/decoders" },
};

type Ix = {
  name: string;
  risk: "low" | "medium" | "high" | "critical";
  desc: string;
};

type Decoder = {
  name: string;
  programId: string;
  kind: "native" | "anchor" | "custom anchor";
  description: string;
  instructions: Ix[];
  notes?: string;
};

const DECODERS: Decoder[] = [
  {
    name: "System Program",
    programId: "11111111111111111111111111111111",
    kind: "native",
    description:
      "Solana runtime core. Account creation, SOL transfers, nonce lifecycle. Instructions are dispatched by a 4-byte LE tag at offset 0.",
    instructions: [
      { name: "CreateAccount", risk: "low", desc: "Create a new account with lamports, space, and owner." },
      { name: "Transfer", risk: "low", desc: "Move SOL between accounts. Escalated to HIGH for transfers ≥100 SOL." },
      { name: "CreateAccountWithSeed", risk: "low", desc: "Create a PDA-style account deterministically." },
      { name: "AdvanceNonceAccount", risk: "medium", desc: "Advance a durable nonce. The canonical first-instruction signal for a durable-nonce tx." },
      { name: "InitializeNonceAccount", risk: "medium", desc: "Set up a durable-nonce account and its authority." },
      { name: "Allocate", risk: "low", desc: "Allocate data space to an account." },
    ],
  },
  {
    name: "SPL Token",
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    kind: "native",
    description:
      "Classic SPL Token program. Instructions are dispatched by a 1-byte tag at offset 0.",
    instructions: [
      { name: "Transfer", risk: "low", desc: "Move tokens. Escalated to MEDIUM at ≥1e9 raw units, HIGH at ≥1e12." },
      { name: "TransferChecked", risk: "low", desc: "Transfer with explicit mint + decimals verification." },
      { name: "MintTo", risk: "high", desc: "Mint new tokens. Always HIGH — an inflationary action." },
      { name: "Burn", risk: "medium", desc: "Destroy tokens from a holder account." },
      { name: "CloseAccount", risk: "medium", desc: "Close a token account and reclaim rent." },
      { name: "SetAuthority", risk: "high", desc: "Change the authority on a mint or account. Ownership transfer." },
    ],
  },
  {
    name: "Token-2022",
    programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    kind: "native",
    description:
      "Token program extensions. Reuses SPL Token tags 0..=25 for base instructions; tags 26+ are extension-specific and get dedicated handlers.",
    instructions: [
      { name: "Transfer / MintTo / Burn / ...", risk: "low", desc: "Base instructions (tags 0-25) delegate to the SPL Token decoder." },
      { name: "initialize_non_transferable_mint", risk: "high", desc: "Create a mint whose tokens cannot be transferred after mint." },
      { name: "transfer_hook_extension", risk: "high", desc: "Register a custom program that runs on every transfer." },
      { name: "interest_bearing_mint_extension", risk: "medium", desc: "Enable interest-bearing logic on the mint." },
      { name: "initialize_permanent_delegate", risk: "critical", desc: "Install a permanent delegate with unilateral move-token power over every holder of this mint." },
      { name: "confidential_transfer_extension", risk: "medium", desc: "Confidential-transfer extension ix." },
      { name: "+ 9 more extensions", risk: "medium", desc: "Reallocate, default_account_state, memo_transfer, cpi_guard, metadata_pointer, etc." },
    ],
  },
  {
    name: "Squads v4",
    programId: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
    kind: "custom anchor",
    description:
      "Multisig governance program — the same one Drift used. Custom decoder because the Drift 2026 reasoning is not expressible as a plain static table.",
    instructions: [
      { name: "vault_transaction_create", risk: "high", desc: "Queue a transaction that will spend from the multisig vault when approved." },
      { name: "vault_transaction_execute", risk: "critical", desc: "Execute a previously approved vault tx — moves funds out of the vault now." },
      { name: "config_transaction_create", risk: "high", desc: "Queue a multisig config change (threshold / members / timelock)." },
      { name: "config_transaction_execute", risk: "critical", desc: "Execute a config change. This is the class of instruction used in the April 2026 Drift exploit." },
      { name: "proposal_create", risk: "medium", desc: "Create a new proposal on the multisig." },
      { name: "proposal_approve", risk: "high", desc: "Approve a proposal. Your signature contributes to the threshold." },
      { name: "proposal_reject", risk: "low", desc: "Reject a proposal." },
      { name: "multisig_create / v2", risk: "medium", desc: "Create a new multisig." },
      { name: "multisig_set_config", risk: "critical", desc: "Directly mutate multisig config — signers / threshold / timelock." },
    ],
    notes: "See /docs/drift-2026 for the full account of how this decoder maps onto the exploit.",
  },
  {
    name: "Jupiter v6",
    programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    kind: "anchor",
    description:
      "The dominant Solana DEX aggregator. Matched via Anchor discriminators.",
    instructions: [
      { name: "route", risk: "medium", desc: "Execute a swap along a chosen route." },
      { name: "route_with_token_ledger", risk: "medium", desc: "Swap using a token ledger account." },
      { name: "exact_out_route", risk: "medium", desc: "Exact-output swap." },
      { name: "shared_accounts_route", risk: "medium", desc: "Default swap used by most frontends." },
      { name: "shared_accounts_route_with_token_ledger", risk: "medium", desc: "Shared-accounts swap with ledger." },
      { name: "shared_accounts_exact_out_route", risk: "medium", desc: "Shared-accounts exact-out swap." },
      { name: "set_token_ledger / create_open_orders / claim / claim_token", risk: "low", desc: "Ancillary bookkeeping instructions." },
    ],
  },
  {
    name: "Drift v2",
    programId: "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
    kind: "anchor",
    description:
      "Drift Protocol — the program whose governance was hijacked in the April 2026 exploit. The user-facing instructions themselves are standard deposit / trade / liquidate flows.",
    instructions: [
      { name: "initialize_user / initialize_user_stats", risk: "low", desc: "Create the user account and stats under the signer." },
      { name: "deposit / withdraw / transfer_deposit", risk: "medium", desc: "Move collateral in and out of Drift vaults." },
      { name: "place_perp_order / place_spot_order / place_and_take_perp_order", risk: "medium", desc: "Open orders against perp or spot markets." },
      { name: "cancel_order / cancel_orders / settle_pnl", risk: "low", desc: "Cancel orders, settle realized PnL." },
      { name: "liquidate_perp / liquidate_spot / liquidate_borrow_for_perp_pnl", risk: "high", desc: "Third-party liquidations — verify target user and keeper." },
      { name: "update_user_delegate", risk: "high", desc: "Set a delegate that can trade on the user account." },
      { name: "update_user_name / update_amms", risk: "low", desc: "Cosmetic and oracle refresh instructions." },
    ],
  },
  {
    name: "Kamino Lend",
    programId: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
    kind: "anchor",
    description:
      "Money market with obligation-based borrowing. Reserve and obligation operations are the user-facing surface.",
    instructions: [
      { name: "init_obligation / refresh_obligation / refresh_reserve", risk: "low", desc: "Bookkeeping and oracle refresh." },
      { name: "deposit_reserve_liquidity / redeem_reserve_collateral", risk: "medium", desc: "Supply liquidity / redeem cTokens." },
      { name: "deposit_obligation_collateral", risk: "medium", desc: "Post cTokens as obligation collateral." },
      { name: "withdraw_obligation_collateral", risk: "high", desc: "Reduce obligation collateral — increases liquidation risk." },
      { name: "borrow_obligation_liquidity", risk: "high", desc: "Open a new debt position against the obligation." },
      { name: "repay_obligation_liquidity", risk: "low", desc: "Repay outstanding debt." },
      { name: "liquidate_obligation_and_redeem_reserve_collateral", risk: "high", desc: "Third-party liquidation." },
      { name: "flash_borrow_reserve_liquidity / flash_repay_reserve_liquidity", risk: "medium", desc: "Flash-borrow pair — must balance in the same tx." },
    ],
  },
  {
    name: "MarginFi v2",
    programId: "MFv2hWf31Z9kbCa1snEPYctwafyJVi6rmTeBd8NsGRf",
    kind: "anchor",
    description:
      "Isolated-margin money market. Each user holds a marginfi_account under a marginfi_group.",
    instructions: [
      { name: "marginfi_account_initialize", risk: "low", desc: "Create a new marginfi account under a group." },
      { name: "lending_account_deposit / withdraw", risk: "medium", desc: "Supply / withdraw from a lending bank." },
      { name: "lending_account_borrow", risk: "high", desc: "Open a new debt position." },
      { name: "lending_account_repay", risk: "low", desc: "Repay debt." },
      { name: "lending_account_liquidate", risk: "high", desc: "Liquidate an unhealthy marginfi account." },
      { name: "lending_account_start_flashloan / end_flashloan", risk: "medium", desc: "Flashloan begin / end pair." },
      { name: "marginfi_account_set_account_authority", risk: "critical", desc: "Transfer control of the marginfi account to a new authority. Full takeover." },
    ],
  },
];

export default function Page() {
  return (
    <article className="docs-content">
      <DocHeader
        href="/docs/decoders"
        eyebrow="Reference"
        title="Decoder coverage"
        lead="Eight programs. 80+ instructions. Every decoder registers itself under its canonical program ID and emits the same DecodedInstruction shape. Unknown programs fall back to a MEDIUM verdict with a human-review reason."
      />

      <Callout tone="note">
        Native programs (System, SPL Token, Token-2022) have custom decoders
        that match on raw instruction tags. Anchor programs (Jupiter, Drift,
        Kamino, MarginFi) go through{" "}
        <code className="inline-code">GenericAnchorDecoder</code> with static
        lookup tables. Squads v4 has a custom Anchor decoder because its
        Drift-specific reasoning does not fit the plain table shape.
      </Callout>

      {DECODERS.map((d) => (
        <section key={d.name}>
          <h2 className="docs-h2">{d.name}</h2>
          <p>
            <strong>Program ID:</strong>{" "}
            <code className="inline-code">{d.programId}</code>
            <br />
            <strong>Decoder kind:</strong> {d.kind}
          </p>
          <p>{d.description}</p>
          {d.notes && (
            <p>
              <em style={{ color: "var(--accent)" }}>{d.notes}</em>
            </p>
          )}
          <div className="prop-table">
            <table>
              <thead>
                <tr>
                  <th>instruction</th>
                  <th>default risk</th>
                  <th>description</th>
                </tr>
              </thead>
              <tbody>
                {d.instructions.map((ix) => (
                  <tr key={ix.name}>
                    <td className="mono">{ix.name}</td>
                    <td>
                      <RiskBadge level={ix.risk} />
                    </td>
                    <td>{ix.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <DocPager href="/docs/decoders" />
    </article>
  );
}
