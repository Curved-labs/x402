use solana_sdk::{instruction::CompiledInstruction, pubkey::Pubkey};

use crate::types::{DecodedInstruction, RiskLevel};

use super::ProgramDecoder;

pub struct SplTokenDecoder {
    program_id: Pubkey,
}

impl SplTokenDecoder {
    pub fn new() -> Self {
        Self {
            program_id: spl_token::ID,
        }
    }
}

impl ProgramDecoder for SplTokenDecoder {
    fn program_id(&self) -> Pubkey {
        self.program_id
    }

    fn program_name(&self) -> &'static str {
        "SPL Token"
    }

    fn decode(
        &self,
        ix: &CompiledInstruction,
        account_keys: &[Pubkey],
    ) -> Option<DecodedInstruction> {
        decode_spl_token_instruction(ix, account_keys)
    }
}

/// Shared SPL Token / Token-2022 base-instruction decoder.
///
/// Returns a [`DecodedInstruction`] pre-populated with `program_id` / `program_name`
/// set to classic SPL Token. Callers using Token-2022 should overwrite those two
/// fields after calling this.
pub fn decode_spl_token_instruction(
    ix: &CompiledInstruction,
    account_keys: &[Pubkey],
) -> Option<DecodedInstruction> {
    if ix.data.is_empty() {
        return None;
    }
    let tag = ix.data[0];

    let resolve = |i: usize| -> String {
        ix.accounts
            .get(i)
            .and_then(|idx| account_keys.get(*idx as usize))
            .map(|k| k.to_string())
            .unwrap_or_else(|| "?".to_string())
    };

    let (name, summary, risk, reasons) = match tag {
        3 => {
            // Transfer: u64 amount
            let amount = read_u64(&ix.data, 1).unwrap_or(0);
            (
                "Transfer",
                format!(
                    "Token transfer: {} raw units from {} to {} (authority {})",
                    amount,
                    resolve(0),
                    resolve(1),
                    resolve(2)
                ),
                classify_amount(amount),
                vec![],
            )
        }
        7 => {
            // MintTo: u64 amount
            let amount = read_u64(&ix.data, 1).unwrap_or(0);
            (
                "MintTo",
                format!(
                    "Mint {} raw units of mint {} to token account {} (mint authority {})",
                    amount,
                    resolve(0),
                    resolve(1),
                    resolve(2)
                ),
                RiskLevel::High,
                vec!["Token minting — inflationary action".into()],
            )
        }
        8 => {
            // Burn: u64 amount
            let amount = read_u64(&ix.data, 1).unwrap_or(0);
            (
                "Burn",
                format!(
                    "Burn {} raw units from token account {} (mint {}, authority {})",
                    amount,
                    resolve(0),
                    resolve(1),
                    resolve(2)
                ),
                RiskLevel::Medium,
                vec![],
            )
        }
        9 => (
            "CloseAccount",
            format!(
                "Close token account {} — rent returned to {} (authority {})",
                resolve(0),
                resolve(1),
                resolve(2)
            ),
            RiskLevel::Medium,
            vec![],
        ),
        6 => (
            "SetAuthority",
            format!(
                "Change authority on account {} — authority was {}",
                resolve(0),
                resolve(1)
            ),
            RiskLevel::High,
            vec!["Authority change on a token mint/account — ownership transfer".into()],
        ),
        12 => {
            // TransferChecked: u64 amount, u8 decimals
            let amount = read_u64(&ix.data, 1).unwrap_or(0);
            let decimals = *ix.data.get(9).unwrap_or(&0);
            (
                "TransferChecked",
                format!(
                    "Checked transfer: {} raw units (decimals {}) mint {} from {} to {}",
                    amount,
                    decimals,
                    resolve(1),
                    resolve(0),
                    resolve(2)
                ),
                classify_amount(amount),
                vec![],
            )
        }
        _ => (
            "SplTokenInstruction",
            format!("SPL Token instruction (tag {})", tag),
            RiskLevel::Low,
            vec![],
        ),
    };

    Some(DecodedInstruction {
        program_id: spl_token::ID.to_string(),
        program_name: "SPL Token".to_string(),
        instruction_name: name.to_string(),
        summary,
        accounts: ix
            .accounts
            .iter()
            .filter_map(|i| account_keys.get(*i as usize).map(|k| k.to_string()))
            .collect(),
        risk,
        risk_reasons: reasons,
    })
}

fn classify_amount(amount: u64) -> RiskLevel {
    if amount >= 1_000_000_000_000 {
        RiskLevel::High
    } else if amount >= 1_000_000_000 {
        RiskLevel::Medium
    } else {
        RiskLevel::Low
    }
}

fn read_u64(data: &[u8], offset: usize) -> Option<u64> {
    if data.len() < offset + 8 {
        return None;
    }
    Some(u64::from_le_bytes(
        data[offset..offset + 8].try_into().ok()?,
    ))
}
