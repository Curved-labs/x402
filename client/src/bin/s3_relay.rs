//! x402sol S3: the open relayer market + the gasless proof that beats both
//! existing "no-facilitator" options.
//!
//! Proves the three-way advantage nobody else has:
//!   A. GASLESS — across a payment the agent's SOL is untouched; the relayer
//!      pays the fee. Beats "client submits its own tx" (bot must hold SOL and
//!      pay gas on every micropayment).
//!   B. PERMISSIONLESS RELAY, NO DOUBLE-SPEND — 3 unrelated relayers race the
//!      same authorization; exactly one wins (nonce guard), payee paid once.
//!   C. CENSORSHIP-RESISTANT — if relayers refuse, the payee self-relays.
//!      No hosted facilitator (Coinbase/PayAI) can refuse a valid payment.

use ed25519_dalek::Signer as _;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::{pubkey::Pubkey, signature::{Keypair, Signer}};
use x402_client::*;

fn balance(rpc: &RpcClient, k: &Pubkey) -> u64 { rpc.get_balance(k).unwrap_or(0) }
fn fund(rpc: &RpcClient, k: &Pubkey) {
    let sd = rpc.request_airdrop(k, 2_000_000_000).unwrap();
    while !rpc.confirm_transaction(&sd).unwrap_or(false) { std::thread::sleep(std::time::Duration::from_millis(120)); }
}

fn main() {
    let url = std::env::var("RPC").unwrap_or("http://127.0.0.1:8999".into());
    let rpc = RpcClient::new_with_commitment(url, CommitmentConfig::confirmed());
    let s = setup(&rpc, 500_000_000);
    let payer_pk: [u8; 32] = s.payer.pubkey().to_bytes();
    let (amount, expiry) = (1_000_000u64, i64::MAX / 2);
    println!("setup ok: agent escrow funded 500 USDC (one-time)");

    // ---- A. gasless: agent pays nothing; the relayer fronts the fee ----
    let agent_before = balance(&rpc, &s.payer.pubkey());
    let relayer = Keypair::new();
    fund(&rpc, &relayer.pubkey());
    let relayer_before = balance(&rpc, &relayer.pubkey());

    let m0 = authorization(&s.payer.pubkey(), &s.payee.pubkey(), &s.mint, amount, 10, expiry);
    let sg0: [u8; 64] = s.payer_sk.sign(&m0).to_bytes();
    send(&rpc, &relayer, &[], &[
        ed25519_ix(&payer_pk, &sg0, &m0),
        pay_ix(&relayer.pubkey(), &s.escrow, &s.mint, &s.vault, &s.payee_ata, &s.payer.pubkey(), amount, 10, expiry),
    ]);
    let b1: u64 = rpc.get_token_account_balance(&s.payee_ata).unwrap().amount.parse().unwrap();
    let agent_after = balance(&rpc, &s.payer.pubkey());
    let relayer_after = balance(&rpc, &relayer.pubkey());
    assert_eq!(b1, amount);
    assert_eq!(agent_after, agent_before, "agent paid zero SOL");
    assert!(relayer_after < relayer_before, "relayer paid the fee");
    println!("A ok: agent SOL unchanged, relayer paid {} lamports fee+rent. gasless is real.", relayer_before - relayer_after);

    // ---- B. open relay race: 3 relayers, same authorization, one wins ----
    let nonce = 20u64;
    let mr = authorization(&s.payer.pubkey(), &s.payee.pubkey(), &s.mint, amount, nonce, expiry);
    let sr: [u8; 64] = s.payer_sk.sign(&mr).to_bytes();
    let relayers: Vec<Keypair> = (0..3).map(|_| Keypair::new()).collect();
    for r in &relayers { fund(&rpc, &r.pubkey()); }
    let mut wins = 0;
    for (i, r) in relayers.iter().enumerate() {
        let res = send_res(&rpc, r, &[
            ed25519_ix(&payer_pk, &sr, &mr),
            pay_ix(&r.pubkey(), &s.escrow, &s.mint, &s.vault, &s.payee_ata, &s.payer.pubkey(), amount, nonce, expiry),
        ]);
        println!("   relayer {i}: {}", if res.is_ok() { "settled" } else { "rejected (nonce already spent)" });
        if res.is_ok() { wins += 1; }
    }
    assert_eq!(wins, 1, "exactly one relayer wins");
    let b2: u64 = rpc.get_token_account_balance(&s.payee_ata).unwrap().amount.parse().unwrap();
    assert_eq!(b2, amount * 2, "payee paid exactly once for this authorization");
    println!("B ok: 3 relayers raced, exactly 1 settled, no double-spend");

    // ---- C. censorship: payee self-relays when relayers won't ----
    let n3 = 30u64;
    let m3 = authorization(&s.payer.pubkey(), &s.payee.pubkey(), &s.mint, amount, n3, expiry);
    let s3: [u8; 64] = s.payer_sk.sign(&m3).to_bytes();
    send(&rpc, &s.payee, &[], &[
        ed25519_ix(&payer_pk, &s3, &m3),
        pay_ix(&s.payee.pubkey(), &s.escrow, &s.mint, &s.vault, &s.payee_ata, &s.payer.pubkey(), amount, n3, expiry),
    ]);
    let b3: u64 = rpc.get_token_account_balance(&s.payee_ata).unwrap().amount.parse().unwrap();
    assert_eq!(b3, amount * 3, "payee self-relayed");
    println!("C ok: payee self-relayed, no facilitator exists to refuse");

    println!("\nS3 PASS: gasless (agent pays 0 SOL), permissionless relay with no double-spend, uncensorable (payee self-relay). The gasless+trustless+uncensorable combination neither a hosted facilitator nor client-self-submit can offer.");
}
