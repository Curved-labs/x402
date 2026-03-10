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
              >
                view on github
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </a>
              <a className="btn" href="#output">
                see the output
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ======================================================== STATS */}
        <section aria-label="coverage stats" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="stats">
              <div className="stat">
                <span className="label">programs</span>
                <span className="val mono">08</span>
              </div>
              <div className="stat">
                <span className="label">instructions</span>
                <span className="val mono">80+</span>
              </div>
              <div className="stat">
                <span className="label">tests</span>
                <span className="val mono">28 / 28</span>
              </div>
              <div className="stat accent">
                <span className="label">drift pattern</span>
                <span className="val mono">detected</span>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================= ENGINE */}
        <section id="engine" aria-labelledby="engine-title">
          <div className="container">
            <div className="eyebrow">01 // the engine</div>
            <h2 id="engine-title" className="section-title">
              every instruction. <em>decoded.</em>
            </h2>
            <p className="section-lead">
              connects to any solana rpc, fetches pre-state for every writable
              account in the transaction, runs simulateTransaction with the
              accounts config, and diffs the result. every instruction is
              resolved through a program-aware registry: system program, spl
              token, token-2022, squads v4, jupiter v6, drift v2, kamino lend,
              marginfi v2. durable nonces are detected from the first
              instruction. the drift 2026 combo is flagged CRITICAL.
            </p>
          </div>
        </section>

        {/* ========================================================= DRIFT */}
        <section id="drift" aria-labelledby="drift-title">
          <div className="container">
            <div className="eyebrow">02 // drift 2026</div>
            <h2 id="drift-title" className="section-title">
              <em>$285m.</em> twelve minutes.
              <br />
              two signatures.
            </h2>
            <p className="section-lead">
              on april 1, 2026 a north-korea-linked group drained 285 million
              usd from drift protocol&apos;s squads multisig. they did not
              exploit a bug. they did not steal a key. they spent six months
              posing as a quant firm, then got two council members to pre-sign
              a routine-looking transaction whose payload was a{" "}
              <span className="mono" style={{ color: "var(--fg)" }}>
                config_transaction_execute
              </span>
              . the pre-signed tx was wrapped in a durable nonce, so it did not
              expire. the attacker sat on it for a week, then fired. twelve
              minutes later the treasury was on ethereum.
            </p>

            <div className="timeline" aria-label="drift attack timeline">
              <div className="timeline-row">
                <div className="when">6 months before</div>
                <div className="what">
                  attacker poses as a quant trading firm, builds trust with
                  drift contributors
                </div>
                <span className="tag danger">social engineering</span>
              </div>
              <div className="timeline-row">
                <div className="when">2026-03-23</div>
                <div className="what">
                  four durable-nonce accounts created; two council members sign
                  transactions under &quot;routine upgrade&quot; framing
                </div>
                <span className="tag danger">pre-signed</span>
              </div>
              <div className="timeline-row">
                <div className="when">2026-04-01 12:00</div>
                <div className="what">
                  attacker submits the pre-signed config_transaction_execute
                  txs — admin authority transferred in 4 slots
                </div>
                <span className="tag danger">admin hijack</span>
              </div>
              <div className="timeline-row">
                <div className="when">+ 1 minute</div>
                <div className="what">
                  fake cvt token whitelisted as collateral, 500m cvt deposited,
                  real usdc / sol / eth withdrawn
                </div>
                <span className="tag danger">drain started</span>
              </div>
              <div className="timeline-row">
                <div className="when">+ 12 minutes</div>
                <div className="what">
                  $285m out of the vault, most bridged to ethereum within the
                  hour
                </div>
                <span className="tag danger">game over</span>
              </div>
              <div className="timeline-row">
                <div className="when">now</div>
                <div className="what">
                  this engine detects the exact transaction shape before you
                  sign it
                </div>
                <span className="tag ok">detected</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ CLI */}
        <section id="output" aria-labelledby="out-title">
          <div className="container">
            <div className="eyebrow">03 // engine output</div>
            <h2 id="out-title" className="section-title">
              the report drift never got.
            </h2>
            <p className="section-lead" style={{ marginBottom: 40 }}>
              below is the verbatim terminal output of the engine consuming a
              synthesized versioned-transaction whose shape matches the april
              2026 drift exploit. reproduce it with{" "}
              <span className="mono" style={{ color: "var(--fg)" }}>
                cargo run --example drift_attack
              </span>
              .
            </p>

            <pre className="term" aria-label="engine output">
              <div className="term-head">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
                <span className="title">
                  sle simulate --tx $ATTACK_B64 --offline
                </span>
              </div>
