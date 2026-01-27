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
            "success"
        } else {
            "FAILED"
        }
    );
    if let Some(e) = &r.simulation_error {
        println!("   error:     {}", e);
    }
    println!(" Overall risk: {}", risk_badge(&r.overall_risk));
    if r.uses_durable_nonce {
        println!(" ! DURABLE NONCE: yes - this transaction has no expiry");
    }
    println!("----------------------------------------------------------------");
    println!(" Human-readable summary:");
    for line in &r.human_summary {
        println!("   {}", line);
    }
    println!("----------------------------------------------------------------");
    println!(" Instructions ({}):", r.instructions.len());
    for (i, ix) in r.instructions.iter().enumerate() {
        println!(
            "  #{} {} :: {} [{}]",
            i,
            ix.program_name,
            ix.instruction_name,
            risk_badge(&ix.risk)
        );
        println!("     {}", ix.summary);
    }
    println!("----------------------------------------------------------------");
    println!(" Account state diffs ({}):", r.account_diffs.len());
    for d in &r.account_diffs {
        println!(
            "  {} lamports {} -> {} (d {}), data changed: {}",
            d.address, d.lamports_before, d.lamports_after, d.lamports_delta, d.data_changed
        );
    }
    if !r.token_transfers.is_empty() {
        println!("----------------------------------------------------------------");
        println!(" Token transfers:");
        for t in &r.token_transfers {
            println!(
                "  {} -> {} ({} of mint {})",
                t.from, t.to, t.raw_amount, t.mint
            );
        }
    }
    println!("----------------------------------------------------------------");
    println!(" Simulation logs ({}):", r.simulation_logs.len());
    for l in r.simulation_logs.iter().take(20) {
        println!("  . {}", l);
    }
    if r.simulation_logs.len() > 20 {
        println!(
            "  ... ({} more lines truncated)",
            r.simulation_logs.len() - 20
        );
    }
    println!("================================================================");
}

fn risk_badge(r: &RiskLevel) -> &'static str {
    match r {
        RiskLevel::Low => "LOW",
        RiskLevel::Medium => "MEDIUM",
        RiskLevel::High => "HIGH",
        RiskLevel::Critical => "CRITICAL",
    }
}
