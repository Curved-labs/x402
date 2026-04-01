# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-12

### Added

- Transaction simulation engine with RPC pre/post state snapshots
- Account-level state diff computation (lamport delta, owner change, data change)
- Program decoder registry with 8 program decoders:
  - System Program (Transfer, CreateAccount, AdvanceNonceAccount, InitializeNonceAccount, Allocate)
  - SPL Token (Transfer, TransferChecked, MintTo, Burn, CloseAccount, SetAuthority)
  - Token-2022 (base instructions + 14 extension tags including permanent_delegate, transfer_hook)
  - Squads v4 (vault/config transaction create/execute, proposal lifecycle, multisig config)
  - Jupiter v6 (route, shared_accounts_route, exact_out_route, token ledger variants)
  - Drift v2 (deposit, withdraw, place_perp/spot_order, liquidate, update_user_delegate)
  - Kamino Lend (reserve/obligation deposit/withdraw/borrow/repay, liquidate, flash loans)
  - MarginFi v2 (lending account deposit/withdraw/borrow/repay/liquidate, authority transfer)
- Generic Anchor discriminator decoder for rapid protocol onboarding
- Durable nonce detection from first instruction analysis
- Drift 2026 exploit pattern detector (durable nonce + Squads admin execute = CRITICAL)
- Risk classification with four levels: Low, Medium, High, Critical
- Token transfer synthesis from SPL Token and Token-2022 account layouts
- Offline mode (structure-only analysis without RPC)
- CLI with human-readable and JSON output modes
- Drift attack reproduction example binary
- 28 offline tests + 1 devnet integration test
- Web documentation site (Next.js 16 + Spline 3D)
- Full SEO and bot trust infrastructure
