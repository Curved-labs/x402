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

#[test]
fn squads_config_execute_flagged_critical() {
    let decoder = SquadsDecoder::new();
    let keys = vec![
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        squads_program_id(),
    ];
    let ix = build_squads_ix(SquadsInstruction::ConfigTransactionExecute, 2, &keys);
    let decoded = decoder.decode(&ix, &keys).expect("decode config_execute");

    assert_eq!(decoded.instruction_name, "config_transaction_execute");
    assert_eq!(decoded.risk, RiskLevel::Critical);
    // the Drift reference should be in the risk reasons
    let joined = decoded.risk_reasons.join(" ").to_lowercase();
    assert!(
        joined.contains("drift"),
        "expected Drift reference, got: {:?}",
        decoded.risk_reasons
    );
}

#[test]
fn squads_unknown_discriminator_falls_back() {
    let decoder = SquadsDecoder::new();
    let keys = vec![Pubkey::new_unique(), squads_program_id()];
    // Arbitrary, never-matching 8 bytes
    let ix = CompiledInstruction {
        program_id_index: 1,
        accounts: vec![0],
        data: vec![0xff; 16],
    };
    let decoded = decoder.decode(&ix, &keys).expect("decode fallback");
    assert_eq!(decoded.program_name, "Squads v4");
    assert_eq!(decoded.risk, RiskLevel::Medium);
}

#[test]
fn drift_pattern_critical_via_classifier() {
    // Build a synthetic decoded instruction matching config_transaction_execute
    // and pass `uses_durable_nonce=true` to the classifier. This must yield Critical.
    let decoded = DecodedInstruction {
        program_id: SQUADS_V4_PROGRAM_ID.to_string(),
        program_name: "Squads v4".to_string(),
        instruction_name: "config_transaction_execute".to_string(),
        summary: "test".to_string(),
        accounts: vec![],
        risk: RiskLevel::Critical,
        risk_reasons: vec!["test".into()],
    };

    let (overall, summary) = classify(&[decoded], &[], &[], true);
    assert_eq!(overall, RiskLevel::Critical);
    let joined = summary.join("\n").to_lowercase();
    assert!(
        joined.contains("drift"),
        "classifier summary missing Drift reference:\n{}",
        joined
    );
    assert!(
        joined.contains("critical"),
        "classifier summary missing CRITICAL flag:\n{}",
        joined
    );
}

#[test]
fn benign_tx_does_not_trigger_drift_pattern() {
    // An innocuous SOL transfer with no durable nonce and no multisig admin action
    // must stay at LOW risk and must not mention the Drift pattern.
    let decoded = DecodedInstruction {
        program_id: system_program::ID.to_string(),
        program_name: "System Program".to_string(),
        instruction_name: "Transfer".to_string(),
        summary: "benign".to_string(),
        accounts: vec![],
        risk: RiskLevel::Low,
        risk_reasons: vec![],
    };

    let (overall, summary) = classify(&[decoded], &[], &[], false);
    assert_eq!(overall, RiskLevel::Low);
    let joined = summary.join("\n").to_lowercase();
    assert!(!joined.contains("drift"));
    assert!(!joined.contains("durable nonce"));
}

#[test]
fn durable_nonce_alone_is_high_not_critical() {
    // durable nonce without a multisig admin action: elevates to HIGH, not CRITICAL.
    let decoded = DecodedInstruction {
        program_id: system_program::ID.to_string(),
        program_name: "System Program".to_string(),
        instruction_name: "Transfer".to_string(),
        summary: "nonced transfer".to_string(),
        accounts: vec![],
        risk: RiskLevel::Low,
        risk_reasons: vec![],
    };

    let (overall, _) = classify(&[decoded], &[], &[], true);
    assert_eq!(overall, RiskLevel::High);
}
