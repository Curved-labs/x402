//! Offline decoder unit tests. These do not touch the network and verify that
//! the decoder correctly interprets System Program and SPL Token instructions
//! from raw CompiledInstruction bytes.

use solana_sdk::{instruction::CompiledInstruction, pubkey::Pubkey, system_program};

use crif::{
    decoder::spl_token::SplTokenDecoder,
    decoder::system::SystemDecoder,
    decoder::{registry::DecoderRegistry, ProgramDecoder},
    types::RiskLevel,
};

#[test]
fn system_transfer_decoded() {
    let decoder = SystemDecoder::new();
    let src = Pubkey::new_unique();
    let dst = Pubkey::new_unique();
    let keys = vec![src, dst, system_program::ID];

    // System::Transfer: tag=2 (u32 LE) + lamports=1_000_000 (u64 LE)
    let mut data = vec![];
    data.extend_from_slice(&2u32.to_le_bytes());
    data.extend_from_slice(&1_000_000u64.to_le_bytes());

    let ix = CompiledInstruction {
        program_id_index: 2,
        accounts: vec![0, 1],
        data,
    };

    let decoded = decoder.decode(&ix, &keys).expect("decode Transfer");
    assert_eq!(decoded.instruction_name, "Transfer");
    assert_eq!(decoded.risk, RiskLevel::Low);
    assert!(
        decoded.summary.contains("0.001000 SOL"),
        "summary: {}",
        decoded.summary
    );
    assert!(decoded.summary.contains(&src.to_string()));
    assert!(decoded.summary.contains(&dst.to_string()));
}

#[test]
