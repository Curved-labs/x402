use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl RiskLevel {
    pub fn max(self, other: RiskLevel) -> RiskLevel {
        use RiskLevel::*;
        match (self, other) {
            (Critical, _) | (_, Critical) => Critical,
            (High, _) | (_, High) => High,
            (Medium, _) | (_, Medium) => Medium,
            _ => Low,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountDiff {
    pub address: String,
    pub owner_before: Option<String>,
    pub owner_after: Option<String>,
    pub lamports_before: u64,
    pub lamports_after: u64,
    pub lamports_delta: i128,
    pub data_changed: bool,
