//! End-to-end Drift attack reproduction test.
//!
//! Builds a synthetic VersionedTransaction matching the shape of the April 2026
//! Drift exploit (durable nonce + Squads config_transaction_execute), feeds it
//! through `build_report_offline`, and asserts the engine flags it CRITICAL
//! with the Drift pattern callout.

use solana_sdk::{
    hash::Hash,
    instruction::{AccountMeta, Instruction},
    message::{v0, VersionedMessage},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction, system_program,
    transaction::VersionedTransaction,
};

use crif::{
    decoder::{anchor_generic::anchor_discriminator, squads::SQUADS_V4_PROGRAM_ID},
    report::build_report_offline,
    types::RiskLevel,
};

fn build_drift_attack_tx() -> VersionedTransaction {
    let council_member = Keypair::new();

    let nonce_account = Pubkey::new_unique();
    let multisig = Pubkey::new_unique();
    let vault = Pubkey::new_unique();
    let config_tx_account = Pubkey::new_unique();

    // ix #0: System Program AdvanceNonceAccount (marks this as a durable nonce tx)
    let advance =
        system_instruction::advance_nonce_account(&nonce_account, &council_member.pubkey());

    // ix #1: Squads v4 config_transaction_execute
    let squads_program: Pubkey = SQUADS_V4_PROGRAM_ID.parse().unwrap();
    let disc = anchor_discriminator("config_transaction_execute");
    let mut data = disc.to_vec();
    data.extend_from_slice(&[0u8; 32]);
    let execute = Instruction {
        program_id: squads_program,
        accounts: vec![
            AccountMeta::new(multisig, false),
            AccountMeta::new(vault, false),
            AccountMeta::new(config_tx_account, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data,
    };

    let blockhash = Hash::new_from_array([1u8; 32]);
    let msg = v0::Message::try_compile(
        &council_member.pubkey(),
        &[advance, execute],
        &[],
        blockhash,
    )
    .expect("compile v0 msg");

    VersionedTransaction::try_new(VersionedMessage::V0(msg), &[&council_member]).expect("sign tx")
}

#[test]
fn drift_attack_flagged_critical_by_offline_pipeline() {
    let tx = build_drift_attack_tx();
    let report = build_report_offline(&tx);

    // Durable nonce must be detected (first ix is AdvanceNonceAccount)
    assert!(
        report.uses_durable_nonce,
        "durable nonce should be detected from first instruction"
    );

    // Two instructions decoded
    assert_eq!(report.instructions.len(), 2);

    // ix #0: System Program AdvanceNonceAccount
    assert_eq!(report.instructions[0].program_name, "System Program");
    assert_eq!(
        report.instructions[0].instruction_name,
        "AdvanceNonceAccount"
    );

    // ix #1: Squads v4 config_transaction_execute
    assert_eq!(report.instructions[1].program_name, "Squads v4");
    assert_eq!(
        report.instructions[1].instruction_name,
        "config_transaction_execute"
    );
    assert_eq!(report.instructions[1].risk, RiskLevel::Critical);

    // Overall verdict: CRITICAL via Drift pattern combo
    assert_eq!(report.overall_risk, RiskLevel::Critical);

    // Human summary must mention the Drift pattern explicitly
    let joined = report.human_summary.join("\n").to_lowercase();
    assert!(
        joined.contains("drift"),
        "human summary missing Drift reference:\n{}",
        joined
    );
    assert!(
        joined.contains("critical"),
        "human summary missing CRITICAL callout:\n{}",
        joined
    );
    assert!(
        joined.contains("durable nonce"),
        "human summary missing durable nonce warning:\n{}",
        joined
    );
}

#[test]
fn drift_attack_tx_roundtrips_via_bincode_base64() {
    use base64::Engine as _;

    let tx = build_drift_attack_tx();
    let raw = bincode::serialize(&tx).expect("serialize");
    let b64 = base64::engine::general_purpose::STANDARD.encode(&raw);

    // Decode back and verify build_report_offline still reports CRITICAL.
    // This exactly mirrors the CLI --tx <base64> path.
    let decoded_raw = base64::engine::general_purpose::STANDARD
        .decode(b64.as_bytes())
        .expect("b64 decode");
    let roundtrip: VersionedTransaction =
        bincode::deserialize(&decoded_raw).expect("bincode deserialize");
    let report = build_report_offline(&roundtrip);
    assert_eq!(report.overall_risk, RiskLevel::Critical);
}
