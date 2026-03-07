import type { Metadata } from "next";
import SplineHero from "./_components/SplineHero";

export const metadata: Metadata = {
  title: "crif // see what you sign",
  description:
    "Transaction legibility engine for Solana. Decodes instructions, diffs state, detects the Drift 2026 exploit pattern. Offline. Rust. Open source.",
  alternates: { canonical: "/" },
};

const SPLINE_SCENE =
  "https://prod.spline.design/7Yo4Vqi7lTZfnv0H/scene.splinecode";

const DECODERS = [
  {
    name: "System Program",
    count: "05",
    items: [
      "Transfer",
      "CreateAccount",
      "AdvanceNonceAccount",
      "InitializeNonceAccount",
      "Allocate",
    ],
  },
  {
    name: "SPL Token",
    count: "06",
    items: [
      "Transfer",
      "TransferChecked",
      "MintTo",
      "Burn",
      "CloseAccount",
      "SetAuthority",
    ],
  },
  {
    name: "Token-2022",
    count: "14",
    items: [
      "base instructions (tag 0–25)",
      "permanent_delegate [CRITICAL]",
      "non_transferable_mint",
      "transfer_hook_extension",
      "interest_bearing_mint",
    ],
  },
  {
    name: "Squads v4",
    count: "10",
    items: [
      "vault_transaction_create / execute",
      "config_transaction_execute [CRITICAL]",
      "proposal_create / approve / reject",
      "multisig_create / v2 / set_config",
    ],
  },
  {
    name: "Jupiter v6",
    count: "10",
    items: [
      "route",
      "shared_accounts_route",
      "exact_out_route",
      "route_with_token_ledger",
      "create_open_orders",
    ],
  },
  {
    name: "Drift v2",
    count: "17",
    items: [
      "deposit / withdraw",
      "place_perp_order / place_spot_order",
      "liquidate_perp / liquidate_spot",
      "update_user_delegate [HIGH]",
      "settle_pnl / cancel_order",
    ],
  },
  {
    name: "Kamino Lend",
    count: "12",
    items: [
      "deposit_reserve_liquidity",
      "borrow_obligation_liquidity [HIGH]",
      "withdraw_obligation_collateral",
      "liquidate_obligation",
      "flash_borrow / flash_repay",
    ],
  },
  {
    name: "MarginFi v2",
    count: "11",
    items: [
      "lending_account_deposit / withdraw",
      "lending_account_borrow [HIGH]",
      "lending_account_liquidate",
      "set_account_authority [CRITICAL]",
      "flashloan start / end",
    ],
  },
];

export default function Page() {
  return (
    <>
      {/* ============================================================ NAV */}
      <header className="nav">
        <div className="container nav-inner">
          <a href="/" className="brand" aria-label="crif home">
            <span className="brand-dot" />
            <span>crif</span>
          </a>
          <nav className="nav-links" aria-label="primary">
            <a href="#engine">engine</a>
            <a href="#drift">drift</a>
            <a href="#output">output</a>
            <a href="#decoders">decoders</a>
            <a href="#usage">usage</a>
            <a href="/docs">docs</a>
          </nav>
          <a
            className="nav-cta"
            href="https://github.com/Nulltx-xyz/crif"
            rel="noopener"
          >
            github
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <main>
        {/* ======================================================= HERO */}
        <section className="hero" aria-label="hero">
          <SplineHero scene={SPLINE_SCENE} />
          <div className="hero-vignette" aria-hidden="true" />

          <div className="container hero-content fade-in">
            <div className="hero-eyebrow">
              <span className="ping" />
              <span>v0.1.0 // pre-deployment // built in rust</span>
            </div>
            <h1>
              see what you <em>sign.</em>
              <br />
              before the nonce fires.
            </h1>
            <p className="hero-sub">
              crif is a transaction legibility and simulation
              engine for Solana. decodes what an instruction actually does,
              diffs state against live rpc, and flags the exact shape that
              drained $285m out of drift on april 1, 2026.
            </p>
            <div className="hero-cta">
              <a
                className="btn btn-primary"
                href="https://github.com/Nulltx-xyz/crif"
                rel="noopener"
