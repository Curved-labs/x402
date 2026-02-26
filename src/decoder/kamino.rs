//! Kamino Lend decoder.
//!
//! Program ID: KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
//!
//! Kamino Lend is a money market on Solana with obligation-based borrowing.
//! These are the user-facing supply/borrow/repay/liquidate instructions; oracle
//! and reserve admin ix are flagged as HIGH/CRITICAL.

use solana_sdk::{pubkey, pubkey::Pubkey};

use crate::types::RiskLevel;

use super::anchor_generic::{AnchorIx, GenericAnchorDecoder};

pub const KAMINO_LEND_PROGRAM_ID: Pubkey = pubkey!("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");

static KAMINO_IX: &[AnchorIx] = &[
    AnchorIx {
        ix_name: "init_obligation",
        display_name: "init_obligation",
        summary: "Kamino: initialize a new obligation (borrow/lend position container)",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "deposit_reserve_liquidity",
        display_name: "deposit_reserve_liquidity",
        summary: "Kamino: supply liquidity into a reserve (receive cTokens)",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "redeem_reserve_collateral",
        display_name: "redeem_reserve_collateral",
        summary: "Kamino: redeem cTokens for underlying reserve liquidity",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "deposit_obligation_collateral",
        display_name: "deposit_obligation_collateral",
        summary: "Kamino: deposit cTokens as collateral on an obligation",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "withdraw_obligation_collateral",
        display_name: "withdraw_obligation_collateral",
        summary: "Kamino: withdraw collateral from an obligation (reduces health factor)",
        risk: RiskLevel::High,
        reasons: &["Withdrawing collateral increases liquidation risk on this obligation"],
    },
    AnchorIx {
        ix_name: "borrow_obligation_liquidity",
        display_name: "borrow_obligation_liquidity",
        summary: "Kamino: borrow liquidity against an obligation's collateral",
