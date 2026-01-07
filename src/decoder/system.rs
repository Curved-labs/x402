use solana_sdk::{instruction::CompiledInstruction, pubkey::Pubkey, system_program};

use crate::types::{DecodedInstruction, RiskLevel};

use super::ProgramDecoder;

pub struct SystemDecoder;

impl SystemDecoder {
    pub fn new() -> Self {
        Self
    }
}

impl ProgramDecoder for SystemDecoder {
    fn program_id(&self) -> Pubkey {
        system_program::ID
    }

    fn program_name(&self) -> &'static str {
        "System Program"
    }

    fn decode(
        &self,
        ix: &CompiledInstruction,
        account_keys: &[Pubkey],
    ) -> Option<DecodedInstruction> {
        if ix.data.len() < 4 {
            return None;
        }
        let tag = u32::from_le_bytes([ix.data[0], ix.data[1], ix.data[2], ix.data[3]]);

        let resolve = |i: usize| -> String {
            ix.accounts
                .get(i)
                .and_then(|idx| account_keys.get(*idx as usize))
                .map(|k| k.to_string())
                .unwrap_or_else(|| "?".to_string())
        };

        let (name, summary, risk, reasons) = match tag {
            0 => {
                // CreateAccount: u64 lamports, u64 space, Pubkey owner
                let lamports = read_u64(&ix.data, 4).unwrap_or(0);
                let space = read_u64(&ix.data, 12).unwrap_or(0);
                let new_owner = read_pubkey(&ix.data, 20)
                    .map(|p| p.to_string())
                    .unwrap_or_else(|| "?".into());
                (
                    "CreateAccount",
                    format!(
                        "Create new account {} funded with {} lamports ({} bytes), owner set to {}",
                        resolve(1),
                        lamports,
                        space,
                        new_owner
                    ),
                    RiskLevel::Low,
                    vec![],
                )
            }
            2 => {
                // Transfer: u64 lamports
                let lamports = read_u64(&ix.data, 4).unwrap_or(0);
                let sol = lamports as f64 / 1_000_000_000.0;
                let level = if sol >= 100.0 {
                    RiskLevel::High
                } else if sol >= 10.0 {
                    RiskLevel::Medium
                } else {
                    RiskLevel::Low
                };
                let reasons = if level != RiskLevel::Low {
                    vec![format!("Large SOL transfer: {:.4} SOL", sol)]
                } else {
                    vec![]
                };
                (
                    "Transfer",
                    format!(
                        "Transfer {:.6} SOL from {} to {}",
                        sol,
                        resolve(0),
                        resolve(1)
                    ),
                    level,
                    reasons,
                )
            }
            3 => (
                "CreateAccountWithSeed",
                format!("Create account with seed (payer {})", resolve(0)),
                RiskLevel::Low,
                vec![],
            ),
            4 => (
                "AdvanceNonceAccount",
                format!(
                    "Advance durable nonce account {} (authority {})",
                    resolve(0),
                    resolve(2)
                ),
                RiskLevel::Medium,
                vec![
                    "Durable nonce advance — tx was prepared earlier and kept valid via nonce"
                        .into(),
                ],
            ),
            6 => (
                "InitializeNonceAccount",
                format!(
                    "Initialize durable nonce account {} with authority {}",
                    resolve(0),
                    "(authority in data)"
                ),
                RiskLevel::Medium,
                vec![
                    "Creates a durable-nonce enabled account — signed txs using it have no expiry"
                        .into(),
                ],
