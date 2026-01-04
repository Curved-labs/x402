<p align="center">
  <a href="https://crif.fun">
    <img src="./assets/banner.png" alt="crif banner" style="max-width: 100%;" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/Crifdotfun/crif/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-fb923c?style=for-the-badge" alt="License MIT" />
  </a>
  <a href="https://github.com/Crifdotfun/crif/actions">
    <img src="https://img.shields.io/badge/build-passing-fb923c?style=for-the-badge" alt="Build Passing" />
  </a>
  <a href="https://github.com/Crifdotfun/crif/releases">
    <img src="https://img.shields.io/badge/version-v0.1.0-fb923c?style=for-the-badge" alt="Version v0.1.0" />
  </a>
  <a href="https://github.com/Crifdotfun/crif/commits/main">
    <img src="https://img.shields.io/github/last-commit/Crifdotfun/crif?style=for-the-badge&color=fb923c" alt="Last Commit" />
  </a>
  <a href="https://www.rust-lang.org/">
    <img src="https://img.shields.io/badge/rust-1.75+-fb923c?style=for-the-badge&logo=rust&logoColor=white" alt="Rust" />
  </a>
  <a href="https://solana.com/">
    <img src="https://img.shields.io/badge/solana-v2.0-fb923c?style=for-the-badge&logo=solana&logoColor=white" alt="Solana" />
  </a>
  <a href="https://github.com/Crifdotfun/crif">
    <img src="https://img.shields.io/badge/tests-28%20passing-fb923c?style=for-the-badge" alt="Tests 28 Passing" />
  </a>
  <a href="https://x.com/crif_fun">
    <img src="https://img.shields.io/twitter/follow/crif_fun?style=for-the-badge&color=fb923c" alt="Twitter Follow" />
  </a>
  <a href="https://crif.fun">
    <img src="https://img.shields.io/badge/website-crif.fun-fb923c?style=for-the-badge" alt="Website" />
  </a>
  <a href="https://github.com/Crifdotfun/crif/stargazers">
    <img src="https://img.shields.io/github/stars/Crifdotfun/crif?style=for-the-badge&color=fb923c" alt="Stars" />
  </a>
</p>

---

**crif** -- a transaction legibility and simulation engine for Solana, written in Rust. It decodes what a transaction actually does before you sign it, diffs account state against live RPC, and detects the exact attack shape that drained $285M from Drift Protocol in April 2026.

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| System Program decoder | `stable` | Decodes CreateAccount, Transfer, AdvanceNonceAccount, InitializeNonceAccount, Allocate, Assign, and all remaining system instructions |
| SPL Token decoder | `stable` | Decodes Transfer, TransferChecked, MintTo, Burn, CloseAccount, SetAuthority, Approve, Revoke |
| Token-2022 decoder | `stable` | Handles the Token Extensions program using the same base-layout parsing as SPL Token, covering the 165-byte account structure shared between both programs |
| Squads v4 decoder | `stable` | Decodes multisig governance operations -- config_transaction_execute, vault_transaction_execute, multisig_set_config, proposal_create, proposal_approve |
| Jupiter decoder | `stable` | Decodes Jupiter aggregator route and shared_accounts_route instructions via Anchor discriminator matching |
| Drift v2 decoder | `stable` | Decodes Drift protocol instructions -- deposit, withdraw, place_perp_order, cancel_order, settle_pnl, update_amm, and admin operations |
| Kamino decoder | `stable` | Decodes Kamino Lend instructions -- deposit, withdraw, borrow, repay, liquidate, refresh_reserve |
| MarginFi decoder | `stable` | Decodes MarginFi instructions -- lending_account_deposit, lending_account_withdraw, lending_account_borrow, lending_account_repay, lending_account_liquidate |
| Offline mode | `stable` | Full decode + classify pipeline without touching any RPC. Runs against the transaction's static structure only. Useful for auditing unsigned transactions or programs not deployed on the target cluster |
| Drift 2026 pattern detection | `stable` | Detects the exact exploit shape: durable nonce + multisig admin execute. Flags as CRITICAL with a detailed warning referencing the $285M drain |
| Durable nonce detection | `stable` | Recognizes AdvanceNonceAccount as the first instruction (tag 4, enforced by the Solana runtime) and surfaces a "no expiry" warning with risk escalation |
| Token transfer synthesis | `stable` | Parses 165-byte SPL Token account layouts from pre/post simulation snapshots to produce transfer events, including CPI-only flows that never appear as top-level instructions |
