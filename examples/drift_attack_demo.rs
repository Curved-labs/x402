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
