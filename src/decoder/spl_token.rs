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
