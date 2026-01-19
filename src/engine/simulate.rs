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
                data: vec![],
                executable: false,
            },
        });
    }
    Ok(out)
}

/// Simulate a transaction and produce pre/post account snapshots.
///
/// Strategy:
///   1. Extract writable account keys from the versioned tx.
///   2. Fetch current state of each writable account (pre-image).
///   3. Call `simulateTransaction` with `accounts` config so the RPC returns post-state.
///   4. Build the post-image from the RPC response, falling back to pre if the RPC omits an account.
pub async fn simulate_transaction(
    cfg: &EngineConfig,
    tx: &VersionedTransaction,
) -> Result<SimulationOutcome> {
    let client = RpcClient::new_with_commitment(cfg.rpc_url.clone(), cfg.commitment);

    let writable_keys = collect_writable_accounts(tx);
    let pre_accounts = fetch_snapshots(&client, &writable_keys, cfg.commitment).await?;

    let sim_cfg = RpcSimulateTransactionConfig {
        sig_verify: false,
        replace_recent_blockhash: cfg.replace_blockhash,
        commitment: Some(cfg.commitment),
        encoding: Some(solana_transaction_status::UiTransactionEncoding::Base64),
        accounts: Some(RpcSimulateTransactionAccountsConfig {
            encoding: Some(UiAccountEncoding::Base64),
            addresses: writable_keys.iter().map(|k| k.to_string()).collect(),
        }),
        min_context_slot: None,
        inner_instructions: false,
    };

    let sim = client
        .simulate_transaction_with_config(tx, sim_cfg)
        .await
        .context("simulateTransaction RPC call failed")?;

    let logs = sim.value.logs.clone().unwrap_or_default();
    let err_str = sim.value.err.as_ref().map(|e| format!("{:?}", e));
    let success = sim.value.err.is_none();
    let units = sim.value.units_consumed;

    let mut post_accounts = Vec::with_capacity(writable_keys.len());
    if let Some(ui_accounts) = sim.value.accounts {
        for (idx, key) in writable_keys.iter().enumerate() {
            let snapshot = match ui_accounts.get(idx).and_then(|x| x.as_ref()) {
                Some(ui) => ui_account_to_snapshot(*key, ui).unwrap_or_else(|_| {
                    pre_accounts
                        .get(idx)
                        .cloned()
                        .unwrap_or_else(|| empty_snapshot(*key))
                }),
                None => pre_accounts
                    .get(idx)
                    .cloned()
                    .unwrap_or_else(|| empty_snapshot(*key)),
            };
            post_accounts.push(snapshot);
        }
    } else {
        post_accounts = pre_accounts.clone();
    }

    Ok(SimulationOutcome {
        pre_accounts,
        post_accounts,
        logs,
        success,
        error: err_str,
        units_consumed: units,
    })
}

fn empty_snapshot(pubkey: Pubkey) -> AccountSnapshot {
    AccountSnapshot {
        pubkey,
        lamports: 0,
        owner: Pubkey::default(),
        data: vec![],
        executable: false,
    }
}
