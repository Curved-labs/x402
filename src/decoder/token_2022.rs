//! Token-2022 decoder.
//!
//! Program ID: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
//!
//! Token-2022 is a superset of SPL Token. It reuses the same instruction tags
//! for the base operations (Transfer, MintTo, Burn, CloseAccount, SetAuthority,
//! TransferChecked, ...), then adds its own tags for extensions (transfer hooks,
//! transfer fees, interest-bearing mints, confidential transfers, etc.).
//!
//! For the base instructions we delegate to the same decoding logic as SPL
//! Token. For extension-specific instructions we emit an "extension" entry
//! flagged MEDIUM so a reviewer will look at it.

use solana_sdk::{instruction::CompiledInstruction, pubkey, pubkey::Pubkey};

use crate::types::{DecodedInstruction, RiskLevel};

use super::{spl_token::decode_spl_token_instruction, ProgramDecoder};

pub const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

pub struct Token2022Decoder;

impl Token2022Decoder {
    pub fn new() -> Self {
        Self
    }
}

impl ProgramDecoder for Token2022Decoder {
    fn program_id(&self) -> Pubkey {
        TOKEN_2022_PROGRAM_ID
    }

    fn program_name(&self) -> &'static str {
        "Token-2022"
    }

    fn decode(
        &self,
        ix: &CompiledInstruction,
        account_keys: &[Pubkey],
    ) -> Option<DecodedInstruction> {
        if ix.data.is_empty() {
            return None;
        }
        let tag = ix.data[0];

        // Token-2022 reuses SPL Token tags 0..=25 for base instructions. Anything
        // at tag 26+ is a Token-2022 extension instruction (transfer_fee,
        // confidential_transfer, default_account_state, immutable_owner,
        // memo_transfer, cpi_guard, transfer_hook, etc.).
        if tag < 26 {
            if let Some(mut decoded) = decode_spl_token_instruction(ix, account_keys) {
                decoded.program_id = TOKEN_2022_PROGRAM_ID.to_string();
                decoded.program_name = "Token-2022".to_string();
                return Some(decoded);
            }
        }

        let accts: Vec<String> = ix
            .accounts
            .iter()
            .filter_map(|i| account_keys.get(*i as usize).map(|k| k.to_string()))
            .collect();

        let (name, summary, risk) = match tag {
            26 => ("transfer_fee_extension", "Token-2022: transfer-fee extension instruction", RiskLevel::Medium),
            27 => ("confidential_transfer_extension", "Token-2022: confidential transfer extension instruction", RiskLevel::Medium),
            28 => ("default_account_state_extension", "Token-2022: default account state extension", RiskLevel::Medium),
            29 => ("reallocate", "Token-2022: reallocate account to fit more extensions", RiskLevel::Low),
            30 => ("memo_transfer_extension", "Token-2022: require-memo extension instruction", RiskLevel::Low),
            31 => ("create_native_mint", "Token-2022: create native mint", RiskLevel::Low),
            32 => ("initialize_non_transferable_mint", "Token-2022: initialize a NON-TRANSFERABLE mint (tokens cannot be moved after mint)", RiskLevel::High),
            33 => ("interest_bearing_mint_extension", "Token-2022: interest-bearing mint extension", RiskLevel::Medium),
            34 => ("cpi_guard_extension", "Token-2022: CPI guard extension", RiskLevel::Low),
            35 => ("initialize_permanent_delegate", "Token-2022: initialize a PERMANENT DELEGATE — this delegate can move tokens out of any account of this mint without owner consent", RiskLevel::Critical),
            36 => ("transfer_hook_extension", "Token-2022: transfer-hook extension (custom program runs on every transfer)", RiskLevel::High),
            37 => ("confidential_transfer_fee_extension", "Token-2022: confidential transfer-fee extension", RiskLevel::Medium),
            38 => ("withdraw_excess_lamports", "Token-2022: withdraw excess lamports from a token account", RiskLevel::Medium),
            39 => ("metadata_pointer_extension", "Token-2022: metadata pointer extension", RiskLevel::Low),
            _ => ("token_2022_unknown", "Token-2022: unknown extension instruction", RiskLevel::Medium),
        };

        Some(DecodedInstruction {
            program_id: TOKEN_2022_PROGRAM_ID.to_string(),
            program_name: "Token-2022".to_string(),
            instruction_name: name.to_string(),
            summary: summary.to_string(),
            accounts: accts,
            risk: risk.clone(),
            risk_reasons: match risk {
                RiskLevel::Critical => vec![
                    "Permanent delegate gives an external authority unilateral move-tokens power for this mint".into(),
                    "Any holder of this mint is subject to the permanent delegate forever".into(),
                ],
                RiskLevel::High => {
                    if name == "transfer_hook_extension" {
                        vec!["Every transfer will invoke a custom program — verify what that program does".into()]
                    } else {
                        vec!["Token-2022 extension with long-term implications — verify before signing".into()]
                    }
                }
                _ => vec![],
            },
        })
    }
}
