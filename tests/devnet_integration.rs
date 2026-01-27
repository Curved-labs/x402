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
