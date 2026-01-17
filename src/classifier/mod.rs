use crate::types::{AccountDiff, DecodedInstruction, LegibilityReport, RiskLevel, TokenTransfer};

/// Instruction names that, combined with a durable nonce, match the Drift 2026 attack pattern:
/// a multisig admin action pre-signed via a never-expiring nonce.
const DRIFT_PATTERN_MULTISIG_ADMIN_IX: &[&str] = &[
    "config_transaction_execute",
    "multisig_set_config",
    "vault_transaction_execute",
];

/// Synthesize the final risk level, risk reasons, and the human-readable summary lines
/// from decoded instructions, state diffs, and metadata.
pub fn classify(
    instructions: &[DecodedInstruction],
    diffs: &[AccountDiff],
    token_transfers: &[TokenTransfer],
    uses_durable_nonce: bool,
) -> (RiskLevel, Vec<String>) {
    let mut overall = RiskLevel::Low;
    let mut summary: Vec<String> = Vec::new();

    for ix in instructions {
        overall = overall.clone().max(ix.risk.clone());
        summary.push(format!(
            "[{}] {} — {}",
            ix.program_name, ix.instruction_name, ix.summary
        ));
        for r in &ix.risk_reasons {
            summary.push(format!("   ⚠ {}", r));
        }
    }

    // Drift 2026 pattern: durable nonce + multisig admin action.
    // This is the exact shape of the Drift exploit and deserves an explicit CRITICAL
    // callout separate from the generic durable-nonce warning below.
    let matches_drift_pattern = uses_durable_nonce
        && instructions.iter().any(|i| {
            DRIFT_PATTERN_MULTISIG_ADMIN_IX
                .iter()
                .any(|name| i.instruction_name == *name)
        });
    if matches_drift_pattern {
        overall = overall.clone().max(RiskLevel::Critical);
        summary.push(
            "🛑 CRITICAL — this transaction matches the APRIL 2026 DRIFT EXPLOIT PATTERN:".into(),
        );
        summary.push(
            "   durable nonce + multisig admin execute. The attacker that drained $285M from Drift"
                .into(),
        );
        summary.push(
            "   used exactly this shape — pre-signed governance actions that stay valid indefinitely.".into(),
        );
        summary.push(
            "   DO NOT SIGN without verifying the inner instructions AND the nonce account lifecycle.".into(),
        );
    }

    // Durable nonce escalates by one level — these txs are valid until explicitly advanced.
    if uses_durable_nonce {
        overall = overall.clone().max(RiskLevel::High);
        summary.push(
            "⚠ This transaction uses a DURABLE NONCE — it can be executed at any time in the future."
                .into(),
        );
        summary.push(
            "   Signing means you are authorizing this action indefinitely. Revocation requires advancing the nonce account.".into(),
