//! Offline tests for the Squads v4 decoder and the Drift-pattern classifier rule.
//!
//! These tests construct synthetic CompiledInstructions rather than deploying or
//! calling real programs, so they run fully offline.

use std::str::FromStr;

use solana_sdk::{instruction::CompiledInstruction, pubkey::Pubkey, system_program};

use crif::{
    classifier::classify,
    decoder::{
        squads::{anchor_discriminator, SquadsDecoder, SquadsInstruction, SQUADS_V4_PROGRAM_ID},
        ProgramDecoder,
    },
    types::{DecodedInstruction, RiskLevel},
};

fn squads_program_id() -> Pubkey {
    Pubkey::from_str(SQUADS_V4_PROGRAM_ID).unwrap()
}

fn build_squads_ix(
    ix_kind: SquadsInstruction,
    account_count: usize,
    keys: &[Pubkey],
) -> CompiledInstruction {
    let disc = anchor_discriminator(ix_kind.ix_name());
    let mut data = disc.to_vec();
    // pad with zeroes so the decoder's "data too short" fallback doesn't trigger
    data.extend_from_slice(&[0u8; 8]);
    CompiledInstruction {
        // last key is the program id
        program_id_index: (keys.len() - 1) as u8,
        accounts: (0..account_count as u8).collect(),
        data,
    }
}

#[test]
fn squads_vault_execute_flagged_critical() {
    let decoder = SquadsDecoder::new();
    let multisig = Pubkey::new_unique();
    let vault = Pubkey::new_unique();
    let tx_account = Pubkey::new_unique();
    let member = Pubkey::new_unique();
    let keys = vec![multisig, vault, tx_account, member, squads_program_id()];

    let ix = build_squads_ix(SquadsInstruction::VaultTransactionExecute, 4, &keys);
    let decoded = decoder.decode(&ix, &keys).expect("decode vault_execute");

    assert_eq!(decoded.instruction_name, "vault_transaction_execute");
    assert_eq!(decoded.risk, RiskLevel::Critical);
    assert!(!decoded.risk_reasons.is_empty());
    assert!(decoded.summary.to_lowercase().contains("vault"));
}
