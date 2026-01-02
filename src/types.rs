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
    pub data_len_before: usize,
    pub data_len_after: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenTransfer {
    pub mint: String,
    pub from: String,
    pub to: String,
    pub ui_amount: f64,
    pub raw_amount: u64,
    pub decimals: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedInstruction {
    pub program_id: String,
    pub program_name: String,
    pub instruction_name: String,
    pub summary: String,
    pub accounts: Vec<String>,
    pub risk: RiskLevel,
    pub risk_reasons: Vec<String>,
}

