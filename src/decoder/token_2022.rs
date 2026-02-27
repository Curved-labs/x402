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
