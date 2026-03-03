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
}

#[test]
fn drift_update_user_delegate_high_risk() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&DRIFT_V2_PROGRAM_ID).unwrap();
    let keys = keys_with_program(DRIFT_V2_PROGRAM_ID, 3);
    let ix = build_anchor_ix("update_user_delegate", 3, keys.len());
    let decoded = decoder
        .decode(&ix, &keys)
        .expect("decode update_user_delegate");
    assert_eq!(decoded.risk, RiskLevel::High);
    assert!(!decoded.risk_reasons.is_empty());
}

// -------- Kamino Lend --------

#[test]
fn kamino_borrow_is_high_risk() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&KAMINO_LEND_PROGRAM_ID).unwrap();
    let keys = keys_with_program(KAMINO_LEND_PROGRAM_ID, 6);
    let ix = build_anchor_ix("borrow_obligation_liquidity", 6, keys.len());
    let decoded = decoder.decode(&ix, &keys).expect("decode kamino borrow");
    assert_eq!(decoded.program_name, "Kamino Lend");
    assert_eq!(decoded.instruction_name, "borrow_obligation_liquidity");
    assert_eq!(decoded.risk, RiskLevel::High);
}

#[test]
fn kamino_withdraw_collateral_is_high_risk() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&KAMINO_LEND_PROGRAM_ID).unwrap();
    let keys = keys_with_program(KAMINO_LEND_PROGRAM_ID, 6);
    let ix = build_anchor_ix("withdraw_obligation_collateral", 6, keys.len());
    let decoded = decoder
        .decode(&ix, &keys)
        .expect("decode withdraw_obligation_collateral");
    assert_eq!(decoded.risk, RiskLevel::High);
}

#[test]
fn kamino_deposit_reserve_is_medium() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&KAMINO_LEND_PROGRAM_ID).unwrap();
    let keys = keys_with_program(KAMINO_LEND_PROGRAM_ID, 4);
    let ix = build_anchor_ix("deposit_reserve_liquidity", 4, keys.len());
    let decoded = decoder.decode(&ix, &keys).expect("decode deposit_reserve");
    assert_eq!(decoded.risk, RiskLevel::Medium);
}

// -------- MarginFi v2 --------

#[test]
fn marginfi_account_authority_transfer_is_critical() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&MARGINFI_V2_PROGRAM_ID).unwrap();
    let keys = keys_with_program(MARGINFI_V2_PROGRAM_ID, 3);
    let ix = build_anchor_ix("marginfi_account_set_account_authority", 3, keys.len());
    let decoded = decoder
        .decode(&ix, &keys)
        .expect("decode set_account_authority");
    assert_eq!(decoded.program_name, "MarginFi v2");
    assert_eq!(decoded.risk, RiskLevel::Critical);
    assert!(!decoded.risk_reasons.is_empty());
}

#[test]
fn marginfi_borrow_is_high_risk() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&MARGINFI_V2_PROGRAM_ID).unwrap();
    let keys = keys_with_program(MARGINFI_V2_PROGRAM_ID, 5);
    let ix = build_anchor_ix("lending_account_borrow", 5, keys.len());
    let decoded = decoder
        .decode(&ix, &keys)
        .expect("decode lending_account_borrow");
    assert_eq!(decoded.risk, RiskLevel::High);
}

// -------- Token-2022 --------

#[test]
fn token_2022_base_transfer_decoded() {
    // Token-2022 reuses tag 3 = Transfer from SPL Token.
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&TOKEN_2022_PROGRAM_ID).unwrap();
    let keys = keys_with_program(TOKEN_2022_PROGRAM_ID, 3);
    let mut payload = Vec::new();
    payload.extend_from_slice(&500_000u64.to_le_bytes());
    let ix = build_raw_ix(3, &payload, 3, keys.len());
    let decoded = decoder
        .decode(&ix, &keys)
        .expect("decode token-2022 transfer");
    assert_eq!(decoded.program_name, "Token-2022");
    assert_eq!(decoded.instruction_name, "Transfer");
    assert!(decoded.summary.contains("500000"));
}

#[test]
fn token_2022_permanent_delegate_is_critical() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&TOKEN_2022_PROGRAM_ID).unwrap();
    let keys = keys_with_program(TOKEN_2022_PROGRAM_ID, 2);
    // tag 35 = InitializePermanentDelegate
    let ix = build_raw_ix(35, &[0u8; 32], 2, keys.len());
    let decoded = decoder
        .decode(&ix, &keys)
        .expect("decode permanent_delegate");
    assert_eq!(decoded.risk, RiskLevel::Critical);
    assert!(decoded
        .summary
        .to_lowercase()
        .contains("permanent delegate"));
}

#[test]
fn token_2022_non_transferable_mint_is_high() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&TOKEN_2022_PROGRAM_ID).unwrap();
    let keys = keys_with_program(TOKEN_2022_PROGRAM_ID, 1);
    let ix = build_raw_ix(32, &[], 1, keys.len());
    let decoded = decoder
        .decode(&ix, &keys)
        .expect("decode non_transferable_mint");
    assert_eq!(decoded.risk, RiskLevel::High);
    assert!(
        decoded.summary.to_lowercase().contains("non-transferable")
            || decoded.summary.to_lowercase().contains("non_transferable")
    );
}

#[test]
fn token_2022_transfer_hook_high() {
    let registry = DecoderRegistry::default_set();
    let decoder = registry.get(&TOKEN_2022_PROGRAM_ID).unwrap();
    let keys = keys_with_program(TOKEN_2022_PROGRAM_ID, 2);
    let ix = build_raw_ix(36, &[], 2, keys.len());
    let decoded = decoder.decode(&ix, &keys).expect("decode transfer_hook");
    assert_eq!(decoded.risk, RiskLevel::High);
}

// -------- Registry completeness --------

#[test]
fn registry_has_all_new_decoders() {
    let registry = DecoderRegistry::default_set();
    for program_id in [
        JUPITER_V6_PROGRAM_ID,
        DRIFT_V2_PROGRAM_ID,
        KAMINO_LEND_PROGRAM_ID,
        MARGINFI_V2_PROGRAM_ID,
        TOKEN_2022_PROGRAM_ID,
    ] {
        assert!(
            registry.get(&program_id).is_some(),
            "program {} missing from registry",
            program_id
        );
    }
}
