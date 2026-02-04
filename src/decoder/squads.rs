//! Squads v4 multisig decoder.
//!
//! Squads v4 is an Anchor program. Each instruction is prefixed with an 8-byte
//! discriminator computed as `sha256("global:<instruction_name>")[0..8]`.
//!
//! We do not link against the Squads crate; instead we compute the discriminator
//! at runtime for a fixed set of instructions we care about — the ones whose
//! effects matter for legibility.
//!
//! Program ID: SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf (mainnet v4).

use std::str::FromStr;
use std::sync::OnceLock;

use solana_sdk::{hash::hashv, instruction::CompiledInstruction, pubkey::Pubkey};

use crate::types::{DecodedInstruction, RiskLevel};

use super::ProgramDecoder;

pub const SQUADS_V4_PROGRAM_ID: &str = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";

/// Instructions we specifically recognize. Anything else falls through to a
/// generic "Squads instruction (unknown)" entry that is flagged MEDIUM so a
/// human reviewer will look at it.
#[derive(Debug, Clone, Copy)]
pub enum SquadsInstruction {
    VaultTransactionCreate,
    VaultTransactionExecute,
    ConfigTransactionCreate,
    ConfigTransactionExecute,
    ProposalCreate,
    ProposalApprove,
    ProposalReject,
    MultisigCreate,
    MultisigCreateV2,
    MultisigSetConfig,
}

impl SquadsInstruction {
    pub fn ix_name(&self) -> &'static str {
        match self {
            SquadsInstruction::VaultTransactionCreate => "vault_transaction_create",
            SquadsInstruction::VaultTransactionExecute => "vault_transaction_execute",
            SquadsInstruction::ConfigTransactionCreate => "config_transaction_create",
            SquadsInstruction::ConfigTransactionExecute => "config_transaction_execute",
            SquadsInstruction::ProposalCreate => "proposal_create",
            SquadsInstruction::ProposalApprove => "proposal_approve",
            SquadsInstruction::ProposalReject => "proposal_reject",
            SquadsInstruction::MultisigCreate => "multisig_create",
            SquadsInstruction::MultisigCreateV2 => "multisig_create_v2",
            SquadsInstruction::MultisigSetConfig => "multisig_set_config",
        }
    }

    pub fn all() -> &'static [SquadsInstruction] {
        use SquadsInstruction::*;
        &[
            VaultTransactionCreate,
            VaultTransactionExecute,
            ConfigTransactionCreate,
            ConfigTransactionExecute,
            ProposalCreate,
            ProposalApprove,
            ProposalReject,
            MultisigCreate,
            MultisigCreateV2,
            MultisigSetConfig,
        ]
    }
}

/// Compute Anchor's `global:<name>` discriminator: sha256 of the preimage, first 8 bytes.
pub fn anchor_discriminator(ix_name: &str) -> [u8; 8] {
    let preimage = format!("global:{}", ix_name);
    let h = hashv(&[preimage.as_bytes()]);
    let bytes = h.to_bytes();
    let mut out = [0u8; 8];
    out.copy_from_slice(&bytes[..8]);
    out
}

fn discriminator_table() -> &'static [([u8; 8], SquadsInstruction)] {
    static TABLE: OnceLock<Vec<([u8; 8], SquadsInstruction)>> = OnceLock::new();
    TABLE.get_or_init(|| {
        SquadsInstruction::all()
            .iter()
