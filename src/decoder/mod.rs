pub mod anchor_generic;
pub mod drift_v2;
pub mod jupiter;
pub mod kamino;
pub mod marginfi;
pub mod registry;
pub mod spl_token;
pub mod squads;
pub mod system;
pub mod token_2022;

use solana_sdk::{
    instruction::CompiledInstruction, message::VersionedMessage, pubkey::Pubkey,
    transaction::VersionedTransaction,
};

use crate::types::{DecodedInstruction, RiskLevel};

pub trait ProgramDecoder: Send + Sync {
    fn program_id(&self) -> Pubkey;
    fn program_name(&self) -> &'static str;
    fn decode(
        &self,
        ix: &CompiledInstruction,
        account_keys: &[Pubkey],
    ) -> Option<DecodedInstruction>;
}

pub fn decode_all(
    tx: &VersionedTransaction,
    registry: &registry::DecoderRegistry,
) -> Vec<DecodedInstruction> {
    let keys: Vec<Pubkey> = match &tx.message {
        VersionedMessage::Legacy(m) => m.account_keys.clone(),
        VersionedMessage::V0(m) => m.account_keys.clone(),
    };
    let instructions: &[CompiledInstruction] = match &tx.message {
        VersionedMessage::Legacy(m) => &m.instructions,
        VersionedMessage::V0(m) => &m.instructions,
    };

    instructions
        .iter()
        .map(|ix| {
            let program_id_index = ix.program_id_index as usize;
            let program_id = keys
                .get(program_id_index)
                .copied()
                .unwrap_or(Pubkey::default());
            if let Some(decoder) = registry.get(&program_id) {
                if let Some(decoded) = decoder.decode(ix, &keys) {
                    return decoded;
                }
            }
            DecodedInstruction {
                program_id: program_id.to_string(),
                program_name: "Unknown".to_string(),
                instruction_name: "Unknown".to_string(),
                summary: format!(
                    "Unrecognized program call (program {}, {} accounts, {} data bytes)",
                    program_id,
                    ix.accounts.len(),
                    ix.data.len()
                ),
                accounts: ix
                    .accounts
                    .iter()
                    .filter_map(|i| keys.get(*i as usize).map(|k| k.to_string()))
                    .collect(),
                risk: RiskLevel::Medium,
                risk_reasons: vec![format!(
                    "Unknown program {} — cannot decode intent",
                    program_id
                )],
            }
        })
        .collect()
}
