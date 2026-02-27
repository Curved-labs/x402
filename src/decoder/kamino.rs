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
        risk: RiskLevel::High,
        reasons: &["New debt being opened — verify the obligation and the amount"],
    },
    AnchorIx {
        ix_name: "repay_obligation_liquidity",
        display_name: "repay_obligation_liquidity",
        summary: "Kamino: repay outstanding debt on an obligation",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "liquidate_obligation_and_redeem_reserve_collateral",
        display_name: "liquidate_obligation",
        summary: "Kamino: liquidate an unhealthy obligation and claim a bonus on its collateral",
        risk: RiskLevel::High,
        reasons: &["Third-party liquidation — verify the target obligation"],
    },
    AnchorIx {
        ix_name: "flash_borrow_reserve_liquidity",
        display_name: "flash_borrow",
        summary: "Kamino: begin a flash-borrow from a reserve (must be repaid within the same tx)",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "flash_repay_reserve_liquidity",
        display_name: "flash_repay",
        summary: "Kamino: repay a flash-borrow",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "refresh_obligation",
        display_name: "refresh_obligation",
        summary: "Kamino: refresh an obligation's health with latest oracle prices",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "refresh_reserve",
        display_name: "refresh_reserve",
        summary: "Kamino: refresh reserve oracle prices",
        risk: RiskLevel::Low,
        reasons: &[],
    },
];

pub fn decoder() -> GenericAnchorDecoder {
    GenericAnchorDecoder::new(
        KAMINO_LEND_PROGRAM_ID,
        "Kamino Lend",
        KAMINO_IX,
        RiskLevel::Medium,
    )
}
