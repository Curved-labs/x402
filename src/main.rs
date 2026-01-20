use anyhow::{Context, Result};
use base64::Engine as _;
use clap::{Parser, Subcommand};
use solana_sdk::transaction::VersionedTransaction;

use crif::{
    engine::EngineConfig,
    report::{build_report, build_report_offline},
    types::RiskLevel,
};

#[derive(Parser, Debug)]
#[command(
    name = "crif",
    version,
    about = "crif — transaction legibility engine for Solana"
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Simulate a base64-encoded versioned transaction and print a legibility report.
    Simulate {
        /// Base64-encoded serialized transaction.
        #[arg(long)]
        tx: String,

        /// RPC endpoint (devnet | mainnet | <custom url>).
        #[arg(long, default_value = "devnet")]
        rpc: String,

        /// Emit raw JSON instead of human format.
        #[arg(long)]
        json: bool,

        /// Skip RPC simulation entirely. Runs decoder + classifier against the
        /// transaction's static structure only. Useful for analyzing a tx
        /// without touching any network and for auditing programs that may not
        /// be deployed on the current cluster.
        #[arg(long)]
        offline: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Simulate {
            tx,
            rpc,
            json,
            offline,
        } => {
            let raw = base64::engine::general_purpose::STANDARD
                .decode(tx.as_bytes())
                .context("failed to base64-decode --tx")?;
            let versioned: VersionedTransaction = bincode::deserialize(&raw)
                .context("failed to deserialize versioned transaction")?;
            let report = if offline {
                build_report_offline(&versioned)
            } else {
                let cfg = parse_rpc(&rpc);
                build_report(&cfg, &versioned).await?
            };
            if json {
                println!("{}", serde_json::to_string_pretty(&report)?);
            } else {
                print_human(&report);
            }
        }
    }
    Ok(())
}

fn parse_rpc(s: &str) -> EngineConfig {
    match s {
        "devnet" => EngineConfig::devnet(),
        "mainnet" | "mainnet-beta" => EngineConfig::mainnet_beta(),
        url if url.starts_with("http") => EngineConfig {
            rpc_url: url.to_string(),
            commitment: solana_sdk::commitment_config::CommitmentConfig::confirmed(),
            replace_blockhash: true,
        },
        other => {
            eprintln!("⚠ unknown rpc alias '{}', defaulting to devnet", other);
            EngineConfig::devnet()
        }
    }
}

fn print_human(r: &crif::types::LegibilityReport) {
    println!();
    println!("================================================================");
    println!(" SOLANA TRANSACTION LEGIBILITY REPORT");
    println!("================================================================");
    println!(" Signature:    {}", r.tx_signature_preview);
    println!(" Fee payer:    {}", r.fee_payer);
    println!(
        " Simulation:   {}",
        if r.simulation_success {
