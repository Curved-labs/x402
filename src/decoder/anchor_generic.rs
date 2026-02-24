//! Generic Anchor-program decoder.
//!
//! Most DeFi programs on Solana are Anchor programs. Every Anchor instruction
//! is prefixed with an 8-byte discriminator of `sha256("global:<ix_name>")[0..8]`.
//! This module provides a reusable decoder that takes a program id + a static
//! table of (ix_name, display_name, summary, risk, reasons) and produces a
//! [`DecodedInstruction`] by discriminator match.
//!
//! Each protocol module (jupiter, drift, kamino, marginfi, squads) just builds
//! a table and plugs it into [`GenericAnchorDecoder`].

use std::sync::OnceLock;

use solana_sdk::{hash::hashv, instruction::CompiledInstruction, pubkey::Pubkey};

use crate::types::{DecodedInstruction, RiskLevel};

use super::ProgramDecoder;

/// One row of a protocol decoder table.
#[derive(Debug, Clone, Copy)]
pub struct AnchorIx {
    /// Anchor instruction name, exactly as declared in the program (snake_case).
    pub ix_name: &'static str,
    /// Display name the report shows — usually same as ix_name.
    pub display_name: &'static str,
    /// Pre-baked human summary. Interpolation is not yet supported.
    pub summary: &'static str,
    pub risk: RiskLevel,
    pub reasons: &'static [&'static str],
}

/// Compute the 8-byte Anchor discriminator for an instruction name.
pub fn anchor_discriminator(ix_name: &str) -> [u8; 8] {
    let preimage = format!("global:{}", ix_name);
    let h = hashv(&[preimage.as_bytes()]);
    let bytes = h.to_bytes();
    let mut out = [0u8; 8];
    out.copy_from_slice(&bytes[..8]);
    out
}

/// A decoder for any Anchor program. Caches the precomputed discriminators in a
/// OnceLock keyed on the program id — cheap to reinstantiate.
pub struct GenericAnchorDecoder {
    program_id: Pubkey,
    program_name: &'static str,
    table: &'static [AnchorIx],
    /// Default risk for unrecognized discriminators under this program.
    fallback_risk: RiskLevel,
    cache: OnceLock<Vec<([u8; 8], AnchorIx)>>,
}

impl GenericAnchorDecoder {
    pub const fn new(
        program_id: Pubkey,
        program_name: &'static str,
        table: &'static [AnchorIx],
        fallback_risk: RiskLevel,
    ) -> Self {
        Self {
            program_id,
            program_name,
            table,
            fallback_risk,
            cache: OnceLock::new(),
        }
    }

    fn lookup_table(&self) -> &Vec<([u8; 8], AnchorIx)> {
        self.cache.get_or_init(|| {
            self.table
                .iter()
