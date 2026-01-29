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
        );
    }

    // Large lamport outflow from any single account → escalate.
    for d in diffs {
        if d.lamports_delta <= -1_000_000_000 {
            overall = overall.clone().max(RiskLevel::High);
            summary.push(format!(
                "⚠ Account {} loses {:.4} SOL",
                short(&d.address),
                (-d.lamports_delta) as f64 / 1e9
            ));
        }
        if d.owner_before != d.owner_after {
            overall = overall.clone().max(RiskLevel::Critical);
            summary.push(format!(
                "⚠ Account {} changes owner program ({} → {})",
                short(&d.address),
                short(d.owner_before.as_deref().unwrap_or("?")),
                short(d.owner_after.as_deref().unwrap_or("?"))
            ));
        }
    }

    // Token transfers — if any single transfer moves ≥ 1M raw units on a token with ≥6 decimals, surface it.
    for t in token_transfers {
        summary.push(format!(
            "💸 Token transfer: {} → {} ({} of mint {})",
            short(&t.from),
            short(&t.to),
            t.ui_amount,
            short(&t.mint)
        ));
    }

    (overall, summary)
}

pub fn attach(report: &mut LegibilityReport) {
    let (risk, summary) = classify(
        &report.instructions,
        &report.account_diffs,
        &report.token_transfers,
        report.uses_durable_nonce,
    );
    report.overall_risk = risk;
    report.human_summary = summary;
}

fn short(s: &str) -> String {
    if s.len() <= 12 {
        return s.to_string();
    }
    format!("{}..{}", &s[..4], &s[s.len() - 4..])
}
