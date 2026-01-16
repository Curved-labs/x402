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
