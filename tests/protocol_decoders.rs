//! Offline tests for the protocol decoders added to the registry:
//! Jupiter v6, Drift v2, Kamino Lend, MarginFi v2, and Token-2022.
//!
//! For each Anchor program we construct a synthetic CompiledInstruction whose
//! data is the correct 8-byte discriminator for a well-known instruction, then
//! verify the decoder produces the right name/risk and lands in the registry.

use solana_sdk::{instruction::CompiledInstruction, pubkey::Pubkey};

use crif::{
    decoder::{
        anchor_generic::anchor_discriminator, drift_v2::DRIFT_V2_PROGRAM_ID,
        jupiter::JUPITER_V6_PROGRAM_ID, kamino::KAMINO_LEND_PROGRAM_ID,
        marginfi::MARGINFI_V2_PROGRAM_ID, registry::DecoderRegistry,
        token_2022::TOKEN_2022_PROGRAM_ID,
    },
    types::RiskLevel,
};

fn build_anchor_ix(ix_name: &str, account_count: usize, keys_len: usize) -> CompiledInstruction {
    let disc = anchor_discriminator(ix_name);
    let mut data = disc.to_vec();
    data.extend_from_slice(&[0u8; 16]); // padding so misc u64 reads don't fail
    CompiledInstruction {
        program_id_index: (keys_len - 1) as u8,
        accounts: (0..account_count as u8).collect(),
        data,
    }
}

fn build_raw_ix(
    tag: u8,
    payload: &[u8],
    account_count: usize,
    keys_len: usize,
) -> CompiledInstruction {
    let mut data = vec![tag];
    data.extend_from_slice(payload);
    CompiledInstruction {
        program_id_index: (keys_len - 1) as u8,
        accounts: (0..account_count as u8).collect(),
        data,
    }
}

fn keys_with_program(program_id: Pubkey, count: usize) -> Vec<Pubkey> {
    let mut keys: Vec<Pubkey> = (0..count).map(|_| Pubkey::new_unique()).collect();
    keys.push(program_id);
    keys
}

// -------- Jupiter v6 --------

#[test]
fn jupiter_shared_accounts_route_decoded() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry
        .get(&JUPITER_V6_PROGRAM_ID)
        .expect("jupiter in registry");
    let keys = keys_with_program(JUPITER_V6_PROGRAM_ID, 8);
    let ix = build_anchor_ix("shared_accounts_route", 8, keys.len());
    let decoded = decoder
        .decode(&ix, &keys)
        .expect("decode shared_accounts_route");
    assert_eq!(decoded.program_name, "Jupiter v6");
    assert_eq!(decoded.instruction_name, "shared_accounts_route");
    assert_eq!(decoded.risk, RiskLevel::Medium);
}

#[test]
fn jupiter_unknown_discriminator_falls_back_medium() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&JUPITER_V6_PROGRAM_ID).unwrap();
    let keys = keys_with_program(JUPITER_V6_PROGRAM_ID, 1);
    let ix = CompiledInstruction {
        program_id_index: (keys.len() - 1) as u8,
        accounts: vec![0],
        data: vec![0xaa; 16],
    };
    let decoded = decoder.decode(&ix, &keys).expect("decode fallback");
    assert_eq!(decoded.instruction_name, "unknown");
    assert_eq!(decoded.risk, RiskLevel::Medium);
}

// -------- Drift v2 --------

#[test]
fn drift_deposit_decoded() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&DRIFT_V2_PROGRAM_ID).unwrap();
    let keys = keys_with_program(DRIFT_V2_PROGRAM_ID, 5);
    let ix = build_anchor_ix("deposit", 5, keys.len());
    let decoded = decoder.decode(&ix, &keys).expect("decode drift deposit");
    assert_eq!(decoded.program_name, "Drift v2");
    assert_eq!(decoded.instruction_name, "deposit");
    assert_eq!(decoded.risk, RiskLevel::Medium);
}

#[test]
fn drift_liquidate_perp_is_high_risk() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&DRIFT_V2_PROGRAM_ID).unwrap();
    let keys = keys_with_program(DRIFT_V2_PROGRAM_ID, 5);
    let ix = build_anchor_ix("liquidate_perp", 5, keys.len());
    let decoded = decoder.decode(&ix, &keys).expect("decode liquidate_perp");
    assert_eq!(decoded.instruction_name, "liquidate_perp");
    assert_eq!(decoded.risk, RiskLevel::High);
