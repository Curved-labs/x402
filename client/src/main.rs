//! x402sol S1 localnet e2e: payer signs an off-chain authorization, a DIFFERENT
//! keypair (the relayer) submits it, the program verifies + settles. No
//! facilitator. Measures submit->confirmed latency, plus negatives.

use ed25519_dalek::Signer as _;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::signature::Signer;
use std::time::Instant;
use x402_client::*;

fn main() {
    let url = std::env::var("RPC").unwrap_or("http://127.0.0.1:8999".into());
    let rpc = RpcClient::new_with_commitment(url, CommitmentConfig::confirmed());
    let s = setup(&rpc, 500_000_000);
    let payer_pk: [u8; 32] = s.payer.pubkey().to_bytes();
    println!("setup ok: agent escrow funded 500 USDC (withdrawable anytime)");

    // ---- one authorized micropayment: 1.5 USDC, relayed by the RELAYER ----
    let (amount, nonce, expiry) = (1_500_000u64, 1u64, i64::MAX / 2);
    let msg = authorization(&s.payer.pubkey(), &s.payee.pubkey(), &s.mint, amount, nonce, 0, expiry);
    let sig: [u8; 64] = s.payer_sk.sign(&msg).to_bytes();

    let t0 = Instant::now();
    send(&rpc, &s.relayer, &[], &[
        ed25519_ix(&payer_pk, &sig, &msg),
        pay_ix(&s.relayer.pubkey(), &s.escrow, &s.mint, &s.vault, &s.payee_ata, &s.payer.pubkey(), amount, nonce, 0, expiry),
    ]);
    let ms = t0.elapsed().as_millis();
    let bal: u64 = rpc.get_token_account_balance(&s.payee_ata).unwrap().amount.parse().unwrap();
    assert_eq!(bal, amount);
    println!("PAID: relayer settled 1.5 USDC, payer sent no tx. submit->confirmed {ms} ms");

    // negatives
    let bad = |amt: u64, n: u64, exp: i64, sig: &[u8; 64], m: &[u8]| {
        send_res(&rpc, &s.relayer, &[
            ed25519_ix(&payer_pk, sig, m),
            pay_ix(&s.relayer.pubkey(), &s.escrow, &s.mint, &s.vault, &s.payee_ata, &s.payer.pubkey(), amt, n, 0, exp),
        ])
    };
    assert!(bad(5_000_000, 2, expiry, &sig, &msg).is_err(), "tampered amount");
    println!("negative (relayer inflates amount) ok");
    assert!(bad(amount, nonce, expiry, &sig, &msg).is_err(), "replay");
    println!("negative (replay same nonce) ok");
    let em = authorization(&s.payer.pubkey(), &s.payee.pubkey(), &s.mint, amount, 3, 0, 1);
    let es: [u8; 64] = s.payer_sk.sign(&em).to_bytes();
    assert!(bad(amount, 3, 1, &es, &em).is_err(), "expired");
    println!("negative (expired authorization) ok");

    // censorship path: the payee self-relays a fresh payment
    let n4 = 4u64;
    let m4 = authorization(&s.payer.pubkey(), &s.payee.pubkey(), &s.mint, amount, n4, 0, expiry);
    let s4: [u8; 64] = s.payer_sk.sign(&m4).to_bytes();
    send(&rpc, &s.payee, &[], &[
        ed25519_ix(&payer_pk, &s4, &m4),
        pay_ix(&s.payee.pubkey(), &s.escrow, &s.mint, &s.vault, &s.payee_ata, &s.payer.pubkey(), amount, n4, 0, expiry),
    ]);
    let bal2: u64 = rpc.get_token_account_balance(&s.payee_ata).unwrap().amount.parse().unwrap();
    assert_eq!(bal2, amount * 2);
    println!("censorship path ok: payee self-relayed, no facilitator could refuse");

    println!("\nS1 PASS: facilitator-less verify+settle. gasless payer, permissionless relay, tamper/replay/expiry rejected, payee self-relay works.");
}
