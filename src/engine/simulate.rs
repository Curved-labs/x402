use anyhow::{anyhow, Context, Result};
use solana_account_decoder::{UiAccount, UiAccountEncoding};
use solana_client::{
    nonblocking::rpc_client::RpcClient,
    rpc_config::{RpcSimulateTransactionAccountsConfig, RpcSimulateTransactionConfig},
};
use solana_sdk::{
    commitment_config::CommitmentConfig, pubkey::Pubkey, transaction::VersionedTransaction,
};
use std::collections::HashSet;

use crate::types::AccountSnapshot;

#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub rpc_url: String,
    pub commitment: CommitmentConfig,
    pub replace_blockhash: bool,
}

impl EngineConfig {
    pub fn devnet() -> Self {
        Self {
            rpc_url: "https://api.devnet.solana.com".to_string(),
            commitment: CommitmentConfig::confirmed(),
            replace_blockhash: true,
        }
    }

    pub fn mainnet_beta() -> Self {
        Self {
            rpc_url: "https://api.mainnet-beta.solana.com".to_string(),
            commitment: CommitmentConfig::confirmed(),
            replace_blockhash: true,
        }
    }
}

pub struct SimulationOutcome {
    pub pre_accounts: Vec<AccountSnapshot>,
    pub post_accounts: Vec<AccountSnapshot>,
    pub logs: Vec<String>,
    pub success: bool,
    pub error: Option<String>,
    pub units_consumed: Option<u64>,
}

/// Collect every writable account in the transaction's message.
fn collect_writable_accounts(tx: &VersionedTransaction) -> Vec<Pubkey> {
    let msg = tx.message.clone();
    let keys = msg.static_account_keys();
    let mut seen: HashSet<Pubkey> = HashSet::new();
    let mut out = Vec::new();
    for (i, key) in keys.iter().enumerate() {
        if msg.is_maybe_writable(i, None) && seen.insert(*key) {
            out.push(*key);
        }
    }
    out
}

fn ui_account_to_snapshot(pubkey: Pubkey, ui: &UiAccount) -> Result<AccountSnapshot> {
    let data_vec = ui
        .data
        .decode()
        .ok_or_else(|| anyhow!("failed to decode UiAccount data for {}", pubkey))?;
    let owner = ui
        .owner
        .parse::<Pubkey>()
        .with_context(|| format!("bad owner pubkey on {}", pubkey))?;
    Ok(AccountSnapshot {
        pubkey,
        lamports: ui.lamports,
        owner,
        data: data_vec,
        executable: ui.executable,
    })
}

/// Fetch accounts in one RPC call, returning a snapshot per key (missing accounts become zero-lamport empty).
async fn fetch_snapshots(
    client: &RpcClient,
    keys: &[Pubkey],
    commitment: CommitmentConfig,
) -> Result<Vec<AccountSnapshot>> {
    if keys.is_empty() {
        return Ok(vec![]);
    }
    let fetched = client
        .get_multiple_accounts_with_commitment(keys, commitment)
        .await
        .context("get_multiple_accounts failed")?;
    let mut out = Vec::with_capacity(keys.len());
    for (key, maybe_acc) in keys.iter().zip(fetched.value.into_iter()) {
        out.push(match maybe_acc {
            Some(acc) => AccountSnapshot {
                pubkey: *key,
                lamports: acc.lamports,
                owner: acc.owner,
                data: acc.data,
                executable: acc.executable,
            },
            None => AccountSnapshot {
                pubkey: *key,
                lamports: 0,
                owner: Pubkey::default(),
