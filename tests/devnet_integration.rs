//! End-to-end devnet integration test.
//!
//! Strategy:
//!   1. Load the user's default Solana CLI keypair (~/.config/solana/id.json)
//!      which is already funded on devnet, avoiding the public faucet rate limit.
//!   2. Build a SOL transfer tx from that keypair to a freshly-generated recipient.
//!   3. Run it through the legibility engine without submitting.
//!   4. Assert: engine produces a coherent report — sim succeeds, 1 instruction
//!      decoded as System Program Transfer, overall risk LOW, fee payer diffs
//!      show a lamport decrease.
//!
//! This test requires network access and a funded devnet keypair. It is
//! `#[ignore]`'d by default; run with:
//!
//!     cargo test --test devnet_integration -- --ignored --nocapture

use std::path::PathBuf;

use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::{
    message::{v0, VersionedMessage},
    signature::{read_keypair_file, Keypair, Signer},
    system_instruction,
    transaction::VersionedTransaction,
};

use crif::{engine::EngineConfig, report::build_report, types::RiskLevel};

fn default_keypair_path() -> PathBuf {
    if let Ok(home) = std::env::var("USERPROFILE") {
        return PathBuf::from(home).join(".config/solana/id.json");
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".config/solana/id.json");
    }
    PathBuf::from("id.json")
}

#[tokio::test]
#[ignore]
async fn sol_transfer_devnet() {
    let cfg = EngineConfig::devnet();
    let client = RpcClient::new_with_commitment(cfg.rpc_url.clone(), cfg.commitment);

    let keypair_path = default_keypair_path();
    let payer: Keypair = read_keypair_file(&keypair_path).unwrap_or_else(|e| {
        panic!(
            "failed to load default keypair from {:?}: {}",
            keypair_path, e
        )
    });
    let recipient = Keypair::new();

    println!("payer:     {}", payer.pubkey());
    println!("recipient: {}", recipient.pubkey());

    let payer_balance = client
        .get_balance(&payer.pubkey())
        .await
        .expect("get_balance");
    println!(
        "payer balance: {} lamports ({:.6} SOL)",
        payer_balance,
        payer_balance as f64 / 1e9
    );
    assert!(
        payer_balance >= 10_000_000,
        "payer must have at least 0.01 SOL on devnet for this test"
    );

    let lamports_to_send: u64 = 1_234_567;
    let ix = system_instruction::transfer(&payer.pubkey(), &recipient.pubkey(), lamports_to_send);

    let blockhash = client.get_latest_blockhash().await.expect("blockhash rpc");

    let msg =
        v0::Message::try_compile(&payer.pubkey(), &[ix], &[], blockhash).expect("compile v0 msg");
    let tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[&payer]).expect("sign tx");

    let report = build_report(&cfg, &tx).await.expect("build_report");

    println!("\n{}", serde_json::to_string_pretty(&report).unwrap());

    assert!(
        report.simulation_success,
        "simulation must succeed: {:?}",
        report.simulation_error
    );
    assert!(
        !report.uses_durable_nonce,
        "plain transfer should not use durable nonce"
    );
    assert_eq!(report.instructions.len(), 1, "one instruction expected");
    assert_eq!(report.instructions[0].program_name, "System Program");
    assert_eq!(report.instructions[0].instruction_name, "Transfer");
    assert_eq!(report.overall_risk, RiskLevel::Low);

    let payer_str = payer.pubkey().to_string();
    let payer_diff = report
        .account_diffs
        .iter()
        .find(|d| d.address == payer_str)
        .expect("payer must appear in diffs");
    assert!(
        payer_diff.lamports_delta < 0,
        "payer should lose lamports, got delta {}",
        payer_diff.lamports_delta
    );
    println!(
        "payer lamport delta: {} (expected: -{} minus fee)",
        payer_diff.lamports_delta, lamports_to_send
    );
}
