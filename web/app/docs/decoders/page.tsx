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
