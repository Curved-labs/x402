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
            .map(|ix| (anchor_discriminator(ix.ix_name()), *ix))
            .collect()
    })
}

pub struct SquadsDecoder {
    program_id: Pubkey,
}

impl SquadsDecoder {
    pub fn new() -> Self {
        Self {
            program_id: Pubkey::from_str(SQUADS_V4_PROGRAM_ID)
                .expect("hardcoded Squads program id must parse"),
        }
    }
}

impl ProgramDecoder for SquadsDecoder {
    fn program_id(&self) -> Pubkey {
        self.program_id
    }

    fn program_name(&self) -> &'static str {
        "Squads v4"
    }

    fn decode(
        &self,
        ix: &CompiledInstruction,
        account_keys: &[Pubkey],
    ) -> Option<DecodedInstruction> {
        if ix.data.len() < 8 {
            return Some(generic_unknown(ix, account_keys, "data too short"));
        }
        let mut disc = [0u8; 8];
        disc.copy_from_slice(&ix.data[..8]);

        let matched = discriminator_table()
            .iter()
            .find(|(d, _)| *d == disc)
            .map(|(_, ix_kind)| *ix_kind);

        let accts: Vec<String> = ix
            .accounts
            .iter()
            .filter_map(|i| account_keys.get(*i as usize).map(|k| k.to_string()))
            .collect();

        let (name, summary, risk, reasons) = match matched {
            Some(SquadsInstruction::VaultTransactionCreate) => (
                "vault_transaction_create",
                "Squads: queue a new VAULT transaction on a multisig (inner instructions will be executed from the treasury vault when approved)".to_string(),
                RiskLevel::High,
                vec![
                    "Creates a transaction that, once approved, will spend from the multisig vault".into(),
                    "Inner instructions are NOT yet decoded here — review them separately".into(),
                ],
            ),
            Some(SquadsInstruction::VaultTransactionExecute) => (
                "vault_transaction_execute",
                "Squads: EXECUTE a previously approved vault transaction — funds will move from the multisig vault NOW".to_string(),
                RiskLevel::Critical,
                vec![
                    "This instruction actually moves funds out of a multisig vault".into(),
                    "Verify the inner instructions of the referenced vault_transaction account".into(),
                ],
            ),
            Some(SquadsInstruction::ConfigTransactionCreate) => (
                "config_transaction_create",
                "Squads: queue a multisig CONFIG change (threshold / members / timelock)".to_string(),
                RiskLevel::High,
                vec!["Governance change — will alter who can sign and under what rules".into()],
            ),
            Some(SquadsInstruction::ConfigTransactionExecute) => (
                "config_transaction_execute",
                "Squads: EXECUTE a multisig config change (threshold / members / timelock change applies NOW)".to_string(),
                RiskLevel::Critical,
                vec![
                    "Governance change being applied — may add/remove signers, lower threshold, or drop timelock".into(),
                    "This is the class of instruction used in the April 2026 Drift exploit".into(),
                ],
            ),
            Some(SquadsInstruction::ProposalCreate) => (
                "proposal_create",
                "Squads: create a new proposal on a multisig".to_string(),
                RiskLevel::Medium,
                vec![],
            ),
            Some(SquadsInstruction::ProposalApprove) => (
                "proposal_approve",
                "Squads: APPROVE a multisig proposal — your signature contributes to the approval threshold".to_string(),
                RiskLevel::High,
                vec![
                    "Approving a proposal — verify the underlying transaction it refers to BEFORE signing".into(),
                    "If this is combined with a durable nonce, your approval can be replayed later".into(),
                ],
            ),
            Some(SquadsInstruction::ProposalReject) => (
                "proposal_reject",
                "Squads: reject a multisig proposal".to_string(),
                RiskLevel::Low,
                vec![],
            ),
            Some(SquadsInstruction::MultisigCreate) | Some(SquadsInstruction::MultisigCreateV2) => (
                "multisig_create",
                "Squads: create a new multisig".to_string(),
                RiskLevel::Medium,
                vec![],
            ),
            Some(SquadsInstruction::MultisigSetConfig) => (
                "multisig_set_config",
                "Squads: directly modify multisig configuration".to_string(),
                RiskLevel::Critical,
                vec!["Direct config mutation — changes to signers/threshold/timelock".into()],
            ),
            None => {
                return Some(generic_unknown(
                    ix,
                    account_keys,
                    "unrecognized Squads discriminator",
                ));
            }
        };

        Some(DecodedInstruction {
            program_id: self.program_id.to_string(),
            program_name: "Squads v4".to_string(),
            instruction_name: name.to_string(),
            summary,
            accounts: accts,
            risk,
            risk_reasons: reasons,
        })
    }
}

fn generic_unknown(
    ix: &CompiledInstruction,
    account_keys: &[Pubkey],
    why: &str,
) -> DecodedInstruction {
    DecodedInstruction {
        program_id: SQUADS_V4_PROGRAM_ID.to_string(),
        program_name: "Squads v4".to_string(),
        instruction_name: "unknown".to_string(),
        summary: format!(
            "Unrecognized Squads v4 instruction ({}) — {} accounts, {} data bytes",
            why,
            ix.accounts.len(),
            ix.data.len()
        ),
        accounts: ix
            .accounts
            .iter()
            .filter_map(|i| account_keys.get(*i as usize).map(|k| k.to_string()))
            .collect(),
        risk: RiskLevel::Medium,
        risk_reasons: vec!["Unknown Squads instruction — require human review".into()],
    }
}
