use anyhow::Result;
use solana_sdk::{message::VersionedMessage, transaction::VersionedTransaction};

use crate::{
    classifier,
    decoder::{decode_all, registry::DecoderRegistry},
    engine::{compute_account_diffs, simulate_transaction, EngineConfig},
    types::{LegibilityReport, RiskLevel, TokenTransfer},
};

/// Full report: runs simulation against live RPC, diffs state, decodes, classifies.
pub async fn build_report(
    cfg: &EngineConfig,
    tx: &VersionedTransaction,
) -> Result<LegibilityReport> {
    let outcome = simulate_transaction(cfg, tx).await?;
    let diffs = compute_account_diffs(&outcome.pre_accounts, &outcome.post_accounts);
    let token_transfers = extract_token_transfers(&outcome.pre_accounts, &outcome.post_accounts);
    Ok(assemble_report(
        tx,
        diffs,
        token_transfers,
        outcome.logs,
        outcome.success,
        outcome.error,
    ))
}

/// Offline report: skips simulation entirely. Runs the decoder and classifier
/// against the transaction's static structure only. Useful for auditing a tx
/// before it touches any RPC, for programs that may not be deployed on the
/// current cluster, and for the Drift attack reproduction demo.
pub fn build_report_offline(tx: &VersionedTransaction) -> LegibilityReport {
    assemble_report(
        tx,
        vec![],
        vec![],
        vec!["(offline mode — simulation skipped)".into()],
        true,
        None,
    )
}

fn assemble_report(
    tx: &VersionedTransaction,
    account_diffs: Vec<crate::types::AccountDiff>,
    token_transfers: Vec<TokenTransfer>,
    simulation_logs: Vec<String>,
    simulation_success: bool,
    simulation_error: Option<String>,
) -> LegibilityReport {
    let registry = DecoderRegistry::default_set();
    let instructions = decode_all(tx, &registry);

    let uses_durable_nonce = detect_durable_nonce(tx);
    let durable_warning = if uses_durable_nonce {
        Some("Transaction uses a durable nonce — no expiry until nonce account is advanced.".into())
    } else {
        None
    };

    let sig_preview = tx
        .signatures
        .first()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "(unsigned)".into());

    let fee_payer = match &tx.message {
        VersionedMessage::Legacy(m) => m.account_keys.first().map(|k| k.to_string()),
        VersionedMessage::V0(m) => m.account_keys.first().map(|k| k.to_string()),
    }
    .unwrap_or_else(|| "?".into());

    let mut report = LegibilityReport {
        tx_signature_preview: sig_preview,
        fee_payer,
        uses_durable_nonce,
        durable_nonce_warning: durable_warning,
        instructions,
        account_diffs,
        token_transfers,
        overall_risk: RiskLevel::Low,
        human_summary: vec![],
        simulation_logs,
        simulation_success,
        simulation_error,
    };

    classifier::attach(&mut report);
    report
}

/// Durable nonce detection: the first instruction of a durable-nonce tx must be a
/// System Program `AdvanceNonceAccount` (tag 4). This is enforced by the runtime.
fn detect_durable_nonce(tx: &VersionedTransaction) -> bool {
    let first_ix = match &tx.message {
        VersionedMessage::Legacy(m) => m.instructions.first().zip(Some(m.account_keys.as_slice())),
        VersionedMessage::V0(m) => m.instructions.first().zip(Some(m.account_keys.as_slice())),
    };
    let Some((ix, keys)) = first_ix else {
        return false;
    };
    let Some(program_id) = keys.get(ix.program_id_index as usize) else {
        return false;
    };
    if *program_id != solana_sdk::system_program::ID {
        return false;
    }
    if ix.data.len() < 4 {
        return false;
    }
    let tag = u32::from_le_bytes([ix.data[0], ix.data[1], ix.data[2], ix.data[3]]);
    tag == 4
}

/// Parse SPL Token / Token-2022 accounts from pre/post snapshots to synthesize
/// transfer events.
///
/// Classic SPL Token accounts are exactly 165 bytes. Token-2022 accounts are at
/// least 165 bytes — the first 165 bytes share the same layout (mint, owner,
/// amount at offset 64, ...), followed by a type-length-value extension area.
/// We only read the base layout here, so both programs work with the same code.
fn extract_token_transfers(
    pre: &[crate::types::AccountSnapshot],
    post: &[crate::types::AccountSnapshot],
) -> Vec<TokenTransfer> {
    let token_2022_id = crate::decoder::token_2022::TOKEN_2022_PROGRAM_ID;
    let mut transfers = Vec::new();
    for (p, q) in pre.iter().zip(post.iter()) {
        if p.data.len() < 165 || q.data.len() < 165 {
            continue;
        }
        let p_is_token = p.owner == spl_token::ID || p.owner == token_2022_id;
        let q_is_token = q.owner == spl_token::ID || q.owner == token_2022_id;
        if !p_is_token || !q_is_token {
            continue;
        }
        let pre_amount = read_u64_le(&p.data, 64);
        let post_amount = read_u64_le(&q.data, 64);
        if pre_amount == post_amount {
            continue;
        }
        let mint_bytes: [u8; 32] = p.data[0..32].try_into().unwrap_or([0u8; 32]);
        let mint = solana_sdk::pubkey::Pubkey::new_from_array(mint_bytes).to_string();
        let (from, to, raw) = if post_amount < pre_amount {
            (
                p.pubkey.to_string(),
                "?".to_string(),
                pre_amount - post_amount,
            )
        } else {
            (
                "?".to_string(),
                p.pubkey.to_string(),
                post_amount - pre_amount,
            )
        };
        transfers.push(TokenTransfer {
            mint,
            from,
            to,
            ui_amount: raw as f64,
            raw_amount: raw,
            decimals: 0,
        });
    }
    transfers
}

fn read_u64_le(data: &[u8], offset: usize) -> u64 {
    if data.len() < offset + 8 {
        return 0;
    }
    u64::from_le_bytes(data[offset..offset + 8].try_into().unwrap_or([0u8; 8]))
}
