//! Jupiter Aggregator v6 decoder.
//!
//! Program ID: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
//!
//! Jupiter is the dominant DEX aggregator on Solana. The `*route*` family of
//! instructions performs a user-initiated swap routed through N intermediate
//! AMM hops. Most frontends use `shared_accounts_route` since it reduces the
//! account footprint.

use solana_sdk::{pubkey, pubkey::Pubkey};

use crate::types::RiskLevel;

use super::anchor_generic::{AnchorIx, GenericAnchorDecoder};

pub const JUPITER_V6_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

static JUPITER_V6_IX: &[AnchorIx] = &[
    AnchorIx {
        ix_name: "route",
        display_name: "route",
        summary: "Jupiter: execute a swap along a chosen route (input mint -> output mint through N hops)",
        risk: RiskLevel::Medium,
        reasons: &["User-initiated swap — verify the input/output mints and slippage parameters"],
    },
    AnchorIx {
        ix_name: "route_with_token_ledger",
        display_name: "route_with_token_ledger",
        summary: "Jupiter: swap using a token ledger account (amount derived from ledger rather than argument)",
        risk: RiskLevel::Medium,
        reasons: &["Token-ledger swap — amount comes from on-chain ledger, not from the caller"],
    },
    AnchorIx {
        ix_name: "exact_out_route",
        display_name: "exact_out_route",
        summary: "Jupiter: exact-out swap (receive exactly N units of output mint, input is bounded)",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "shared_accounts_route",
        display_name: "shared_accounts_route",
        summary: "Jupiter: swap via shared accounts (default route used by most frontends)",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "shared_accounts_route_with_token_ledger",
        display_name: "shared_accounts_route_with_token_ledger",
