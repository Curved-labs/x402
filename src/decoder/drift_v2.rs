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
