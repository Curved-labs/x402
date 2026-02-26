//! MarginFi v2 decoder.
//!
//! Program ID: MFv2hWf31Z9kbCa1snEPYctwafyJVi6rmTeBd8NsGRf
//!
//! MarginFi v2 is an isolated-margin money market. Each user has a
//! `marginfi_account` under a `marginfi_group`, and deposits/borrows happen
//! against lending banks inside the group.

use solana_sdk::{pubkey, pubkey::Pubkey};

use crate::types::RiskLevel;

use super::anchor_generic::{AnchorIx, GenericAnchorDecoder};

pub const MARGINFI_V2_PROGRAM_ID: Pubkey = pubkey!("MFv2hWf31Z9kbCa1snEPYctwafyJVi6rmTeBd8NsGRf");

static MARGINFI_IX: &[AnchorIx] = &[
    AnchorIx {
        ix_name: "marginfi_account_initialize",
        display_name: "marginfi_account_initialize",
        summary: "MarginFi: initialize a new marginfi user account under a group",
        risk: RiskLevel::Low,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "lending_account_deposit",
        display_name: "lending_account_deposit",
        summary: "MarginFi: deposit into a lending bank",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "lending_account_withdraw",
        display_name: "lending_account_withdraw",
        summary: "MarginFi: withdraw from a lending bank",
        risk: RiskLevel::Medium,
        reasons: &[],
    },
    AnchorIx {
        ix_name: "lending_account_borrow",
        display_name: "lending_account_borrow",
        summary: "MarginFi: borrow from a lending bank against deposited collateral",
        risk: RiskLevel::High,
        reasons: &["New debt being opened on this marginfi account"],
    },
    AnchorIx {
        ix_name: "lending_account_repay",
        display_name: "lending_account_repay",
        summary: "MarginFi: repay debt on a lending bank",
        risk: RiskLevel::Low,
        reasons: &[],
    },
