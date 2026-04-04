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
| State diff engine | `stable` | Per-account lamport delta, owner change detection, data-length changes, and data-hash diffing across pre/post simulation snapshots |
| Risk classifier | `stable` | Merges per-instruction risk, large lamport outflows (>1 SOL), owner changes (auto-CRITICAL), durable nonce escalation, and Drift pattern matching into a single overall risk level with human-readable summary |

---

## Architecture

The engine processes a transaction through a linear pipeline. Each stage feeds the next, producing a final `LegibilityReport` struct that contains everything a signer needs to make an informed decision.

```
                           crif pipeline
                           =============

+------------------------+
| VersionedTransaction   |  base64-encoded input (signed or unsigned)
+------------------------+
            |
            v
+------------------------+
| fetch_snapshots()      |  RPC: get_multiple_accounts for all writable keys
| (pre-state)            |  produces Vec<AccountSnapshot>
+------------------------+
            |
            v
+------------------------+
| simulate_transaction() |  RPC: simulateTransaction with accounts config
| (post-state)           |  returns post-state + logs + error
+------------------------+
            |
            v
+------------------------+
| compute_account_diffs()|  compares pre/post snapshots
|                        |  lamport delta, owner change, data mutation
+------------------------+
            |
            v
+------------------------+
| decode_all()           |  DecoderRegistry routes each instruction
|                        |  to its program-specific decoder
+------------------------+
            |
            v
+------------------------+
| classify()             |  merges instruction risk, state diff signals,
|                        |  durable nonce, and Drift pattern detection
+------------------------+
            |
            v
+------------------------+
| LegibilityReport       |  final output: risk level, human summary,
|                        |  decoded instructions, account diffs,
|                        |  token transfers, simulation logs
+------------------------+
```

In offline mode, the pipeline skips `fetch_snapshots` and `simulate_transaction`, running the decoder and classifier against the transaction's static structure only. This means account diffs and token transfer synthesis are unavailable, but instruction decoding and risk classification (including Drift pattern detection) work fully.

---

## Build / Installation

```bash
git clone https://github.com/Crifdotfun/crif
cd crif
cargo build --release
```

The release binary is at `target/release/crif`. Requires Rust 1.75+ and a working `cargo` installation.

---

## Quick Start

### CLI

Simulate a base64-encoded transaction against devnet:

```bash
crif simulate --tx <BASE64_VERSIONED_TX> --rpc devnet
```

Output raw JSON instead of the human-readable format:

```bash
crif simulate --tx <BASE64_VERSIONED_TX> --rpc mainnet --json
```

Run in offline mode (no RPC, decode + classify only):

```bash
crif simulate --tx <BASE64_VERSIONED_TX> --offline
```

### Library

Use crif as a Rust library in your own project:

```rust
use crif::engine::EngineConfig;
use crif::report::{build_report, build_report_offline};

// Online mode: simulate against live RPC
let cfg = EngineConfig::devnet();
let report = build_report(&cfg, &versioned_tx).await?;
// report => LegibilityReport {
//     overall_risk: Critical,
//     uses_durable_nonce: true,
//     instructions: [...],
//     account_diffs: [...],
//     human_summary: ["CRITICAL -- this transaction matches the APRIL 2026 DRIFT EXPLOIT PATTERN", ...],
//     ...
// }

// Offline mode: decode + classify without any network call
let report = build_report_offline(&versioned_tx);
// report => LegibilityReport {
//     overall_risk: High,
//     simulation_logs: ["(offline mode -- simulation skipped)"],
//     ...
// }
```

---

## Project Structure

```
crif/
├── src/
│   ├── lib.rs                  crate root, re-exports all modules
│   ├── main.rs                 CLI entry point, clap arg parsing, human-readable printer
│   ├── types.rs                LegibilityReport, AccountDiff, AccountSnapshot, TokenTransfer,
│   │                           DecodedInstruction, RiskLevel
│   ├── report.rs               build_report(), build_report_offline(), detect_durable_nonce(),
│   │                           extract_token_transfers(), assemble_report()
│   ├── engine/
│   │   ├── mod.rs              re-exports simulate + diff
│   │   ├── simulate.rs         simulate_transaction(), fetch_snapshots(), EngineConfig,
│   │   │                       SimulationOutcome, collect_writable_accounts()
│   │   └── diff.rs             compute_account_diffs() -- pre/post snapshot comparison
│   ├── decoder/
│   │   ├── mod.rs              ProgramDecoder trait, decode_all() dispatcher
│   │   ├── registry.rs         DecoderRegistry -- program_id -> decoder lookup table
│   │   ├── system.rs           System Program decoder (CreateAccount, Transfer, Nonce, ...)
│   │   ├── spl_token.rs        SPL Token decoder (Transfer, MintTo, Burn, CloseAccount, ...)
│   │   ├── token_2022.rs       Token-2022 / Token Extensions decoder
│   │   ├── squads.rs           Squads v4 multisig decoder
│   │   ├── anchor_generic.rs   Generic Anchor program decoder (8-byte discriminator matching)
│   │   ├── jupiter.rs          Jupiter aggregator decoder
│   │   ├── drift_v2.rs         Drift v2 protocol decoder
│   │   ├── kamino.rs           Kamino Lend decoder
│   │   └── marginfi.rs         MarginFi decoder
│   └── classifier/
│       └── mod.rs              classify(), attach() -- risk aggregation, Drift pattern
│                               detection, human summary generation
├── tests/
│   ├── decoder_unit.rs         unit tests for System + SPL Token decoders
│   ├── squads_unit.rs          unit tests for Squads v4 decoder
│   ├── protocol_decoders.rs    unit tests for Jupiter, Drift, Kamino, MarginFi decoders
│   ├── drift_attack_e2e.rs     end-to-end Drift exploit pattern detection test
│   └── devnet_integration.rs   live devnet integration test (requires network + faucet)
├── examples/
│   └── drift_attack_demo.rs    standalone reproduction of the Drift 2026 attack pattern
├── assets/
│   └── banner.png              project banner image
├── docs/                       additional documentation
├── Cargo.toml                  package manifest (crif v0.1.0)
├── Cargo.lock                  dependency lockfile
├── Makefile                    build and test shortcuts
├── LICENSE                     MIT license
├── CONTRIBUTING.md             contribution guidelines
├── SECURITY.md                 security policy
├── CODE_OF_CONDUCT.md          code of conduct
├── CHANGELOG.md                version history
├── ROADMAP.md                  planned features
├── clippy.toml                 clippy configuration
├── rustfmt.toml                rustfmt configuration
└── rust-toolchain.toml         toolchain pinning
```

---

## Performance and Coverage

