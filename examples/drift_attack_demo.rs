//! Drift 2026 attack reproduction — synthesizes a VersionedTransaction whose
//! shape matches the exploit: a durable-nonce transaction that, as its payload,
//! executes a Squads v4 `config_transaction_execute` on a multisig. This is
//! exactly the pattern used to drain $285M from Drift on April 1, 2026.
//!
//! Usage:
//!
//!     # Print the base64-encoded attack tx + the offline legibility report
//!     cargo run --example drift_attack_demo
//!
//!     # Capture just the base64 and pipe it through the CLI
//!     cargo run --example drift_attack_demo | grep '^BASE64: ' | cut -d' ' -f2 > attack.b64
//!     cargo run -- simulate --tx "$(cat attack.b64)" --offline
//!
//! This binary only builds a tx in memory — nothing is submitted anywhere.

use base64::Engine as _;
use solana_sdk::{
    hash::Hash,
    instruction::{AccountMeta, CompiledInstruction, Instruction},
    message::{v0, VersionedMessage},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction, system_program,
    transaction::VersionedTransaction,
};

use crif::{
    decoder::{anchor_generic::anchor_discriminator, squads::SQUADS_V4_PROGRAM_ID},
    report::build_report_offline,
};

fn main() {
    // ---- Actors -----------------------------------------------------------
    // A throwaway keypair to sign the tx. Nothing on-chain depends on it since
    // we never submit; the engine only cares about the message structure.
    let council_member = Keypair::new();

    // Three synthetic accounts we'd expect to see in a real Squads config_execute:
    //   - multisig PDA
    //   - vault PDA
    //   - transaction account (storing the queued config change)
    //   - rent payer
    let multisig = Pubkey::new_unique();
    let vault = Pubkey::new_unique();
    let config_tx_account = Pubkey::new_unique();
    let rent_payer = Pubkey::new_unique();

    // Durable nonce wiring:
    //   - nonce_account: the account that holds the nonce
    //   - recent_blockhashes_sysvar: legacy sysvar required by AdvanceNonce
    //   - nonce_authority: typically the council member
    let nonce_account = Pubkey::new_unique();
    let recent_blockhashes = solana_sdk::sysvar::recent_blockhashes::ID;
    let nonce_authority = council_member.pubkey();

    // ---- Instruction 1: System Program AdvanceNonceAccount ---------------
    // Durable-nonce txs must have this as their FIRST instruction. The runtime
    // enforces it, and so does our detector.
    let advance_nonce = system_instruction::advance_nonce_account(&nonce_account, &nonce_authority);

    // ---- Instruction 2: Squads v4 config_transaction_execute ------------
    // We don't have the full Anchor layout here, so we just prefix with the
    // correct 8-byte discriminator and pad. The decoder matches on the
    // discriminator alone.
    let squads_program: Pubkey = SQUADS_V4_PROGRAM_ID.parse().unwrap();
    let disc = anchor_discriminator("config_transaction_execute");
    let mut data = disc.to_vec();
    data.extend_from_slice(&[0u8; 32]); // padding

    let squads_execute = Instruction {
        program_id: squads_program,
        accounts: vec![
            AccountMeta::new(multisig, false),
            AccountMeta::new(vault, false),
            AccountMeta::new(config_tx_account, false),
            AccountMeta::new(rent_payer, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data,
    };

    // ---- Compile v0 message -----------------------------------------------
    let blockhash = Hash::new_from_array([1u8; 32]); // stand-in — never validated
    let msg = v0::Message::try_compile(
        &council_member.pubkey(),
        &[advance_nonce, squads_execute],
        &[],
        blockhash,
    )
    .expect("compile v0 message");

    let tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[&council_member])
        .expect("sign synthetic tx");

    // ---- Serialize + base64 ----------------------------------------------
    let raw = bincode::serialize(&tx).expect("bincode serialize");
    let b64 = base64::engine::general_purpose::STANDARD.encode(&raw);

    eprintln!("=== Drift 2026 attack reproduction — synthetic tx ===");
    eprintln!(" signer (council member): {}", council_member.pubkey());
    eprintln!(" multisig PDA (fake):     {}", multisig);
    eprintln!(" vault PDA (fake):        {}", vault);
    eprintln!(" config tx account:       {}", config_tx_account);
    eprintln!(" nonce account:           {}", nonce_account);
    eprintln!(" recent_blockhashes:      {}", recent_blockhashes);
    eprintln!(" instructions: AdvanceNonceAccount, Squads.config_transaction_execute");
    eprintln!();

    // Print the raw base64 on its own line (easy to grep/cut)
    println!("BASE64: {}", b64);

    // Also print the offline legibility report so the demo is self-contained.
    let report = build_report_offline(&tx);
    eprintln!();
    eprintln!("=== Offline legibility report ===");
    eprintln!(
        "{}",
        serde_json::to_string_pretty(&report).expect("serde json")
    );

    // Sanity — drive home the expected verdict
    eprintln!();
    eprintln!("overall_risk = {:?}", report.overall_risk);
    eprintln!("uses_durable_nonce = {}", report.uses_durable_nonce);
    assert!(
        matches!(report.overall_risk, crif::types::RiskLevel::Critical),
        "expected CRITICAL, got {:?}",
        report.overall_risk
    );

    // Bonus — decompile the compiled instructions back to prove the decoder
    // sees what we built, independent of the registry lookup path.
    if let VersionedMessage::V0(m) = &tx.message {
        for (i, ci) in m.instructions.iter().enumerate() {
            let program = m
                .account_keys
                .get(ci.program_id_index as usize)
                .map(|p| p.to_string())
                .unwrap_or_else(|| "?".into());
            eprintln!(
                "  ix #{}  program={}  data_len={}  discriminator/tag={:02x?}",
                i,
                program,
                ci.data.len(),
                &ci.data[..ci.data.len().min(8)]
            );
            let _ = ci_as_hint(ci);
        }
    }
}

fn ci_as_hint(ci: &CompiledInstruction) -> &CompiledInstruction {
    ci
}
