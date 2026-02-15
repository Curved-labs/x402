//! Drift v2 decoder.
//!
//! Program ID: dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH
//!
//! Drift is a perps/spot DEX on Solana. This is the protocol that suffered the
//! April 2026 $285M exploit via its Squads multisig governance (not via a bug
//! in this program). Decoding these instructions is still important so that
//! when users sign deposit/withdraw/trade transactions they can see exactly
//! what is happening.

use solana_sdk::{pubkey, pubkey::Pubkey};

use crate::types::RiskLevel;

use super::anchor_generic::{AnchorIx, GenericAnchorDecoder};

pub const DRIFT_V2_PROGRAM_ID: Pubkey = pubkey!("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

static DRIFT_V2_IX: &[AnchorIx] = &[
    AnchorIx {
        ix_name: "initialize_user",
        display_name: "initialize_user",
        summary: "Drift: initialize a new user account under the signer",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "initialize_user_stats",
        display_name: "initialize_user_stats",
        summary: "Drift: initialize user stats account",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "deposit",
        display_name: "deposit",
        summary: "Drift: deposit collateral into a Drift user account",
        risk: RiskLevel::Medium,
        reasons: &["Funds moving from your token account into Drift's vault"],
    },
    AnchorIx {
        ix_name: "withdraw",
        display_name: "withdraw",
        summary: "Drift: withdraw collateral from a Drift user account",
        risk: RiskLevel::Medium,
        reasons: &["Funds moving out of Drift's vault back to your token account"],
    },
    AnchorIx {
        ix_name: "transfer_deposit",
        display_name: "transfer_deposit",
        summary: "Drift: transfer deposit between Drift user accounts",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "place_perp_order",
        display_name: "place_perp_order",
        summary: "Drift: place a perpetual futures order",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "place_spot_order",
        display_name: "place_spot_order",
        summary: "Drift: place a spot order",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "place_and_take_perp_order",
        display_name: "place_and_take_perp_order",
        summary: "Drift: place and immediately take a perp order",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "cancel_order",
        display_name: "cancel_order",
        summary: "Drift: cancel a resting order",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "cancel_orders",
        display_name: "cancel_orders",
        summary: "Drift: cancel multiple orders",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "settle_pnl",
        display_name: "settle_pnl",
        summary: "Drift: settle realized PnL on a market",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "liquidate_perp",
        display_name: "liquidate_perp",
        summary: "Drift: liquidate a user's perp position",
        risk: RiskLevel::High,
        reasons: &["Third-party liquidation — verify the target user and the liquidator keeper"],
    },
    AnchorIx {
        ix_name: "liquidate_spot",
        display_name: "liquidate_spot",
        summary: "Drift: liquidate a user's spot position",
        risk: RiskLevel::High,
        reasons: &["Third-party liquidation — verify the target user and the liquidator keeper"],
    },
    AnchorIx {
        ix_name: "liquidate_borrow_for_perp_pnl",
        display_name: "liquidate_borrow_for_perp_pnl",
        summary: "Drift: liquidate a spot borrow to cover perp losses",
        risk: RiskLevel::High,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "update_user_name",
        display_name: "update_user_name",
        summary: "Drift: set the user account display name",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "update_amms",
        display_name: "update_amms",
        summary: "Drift: update AMM oracle/mark prices",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "update_user_delegate",
        display_name: "update_user_delegate",
        summary: "Drift: set/unset a delegate that can trade on this user account",
        risk: RiskLevel::High,
        reasons: &[
            "Delegate change — the new delegate will be able to place orders on this account",
        ],
    },
];

pub fn decoder() -> GenericAnchorDecoder {
    GenericAnchorDecoder::new(
        DRIFT_V2_PROGRAM_ID,
        "Drift v2",
        DRIFT_V2_IX,
        RiskLevel::Medium,
    )
}
