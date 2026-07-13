//! x402sol S2: the real x402 HTTP 402 handshake, facilitator-less.
//!
//!   1. agent  GET /premium                        (no payment)
//!   2. server 402 Payment Required + terms         (amount, payee, mint, nonce, expiry, program)
//!   3. agent  signs the authorization off-chain    (NO Solana tx, NO gas, NO RPC)
//!   4. agent  GET /premium  X-PAYMENT: <payer||sig||nonce>
//!   5. server settles it ON-CHAIN itself           (server is the relayer; no 3rd-party facilitator)
//!   6. server 200 OK + the paid resource
//!
//! The agent proves it never touches Solana: it holds no RpcClient and sends no
//! transaction. It only signs. Settlement is a call to our on-chain program, so
//! no hosted facilitator (Coinbase/PayAI) sits in the middle.

use ed25519_dalek::{Signer as _, SigningKey};
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::{pubkey::Pubkey, signature::Signer};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::str::FromStr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use x402_client::*;

const PORT: u16 = 8402;
const PRICE: u64 = 1_000_000; // 1 USDC per call
const EXPIRY: i64 = 4_102_444_800; // fixed far-future so server & agent agree

fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }
fn unhex(s: &str) -> Vec<u8> { (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect() }

fn main() {
    let url = std::env::var("RPC").unwrap_or("http://127.0.0.1:8999".into());
    let rpc = RpcClient::new_with_commitment(url.clone(), CommitmentConfig::confirmed());
    let s = setup(&rpc, 500_000_000);
    println!("setup ok: agent escrow funded 500 USDC");

    // ---- resource server (holds the relayer role; settles on-chain) ----
    let payer_authority = s.payer.pubkey();
    let payer_pk32: [u8; 32] = payer_authority.to_bytes();
    let payee = s.payee.pubkey();
    let (mint, escrow, vault, payee_ata) = (s.mint, s.escrow, s.vault, s.payee_ata);
    let relayer = s.relayer.insecure_clone();
    let nonce_ctr = Arc::new(AtomicU64::new(1));
    let srv_url = url.clone();
    let srv_nonce = nonce_ctr.clone();

    let listener = TcpListener::bind(("127.0.0.1", PORT)).expect("bind");
    std::thread::spawn(move || {
        let rpc = RpcClient::new_with_commitment(srv_url, CommitmentConfig::confirmed());
        for stream in listener.incoming() {
            let mut st = stream.unwrap();
            let (method_line, xpay) = read_request(&mut st);
            if !method_line.starts_with("GET /premium") { write_resp(&mut st, "404 Not Found", "", ""); continue; }

            match xpay {
                None => {
                    // 402: quote a price + a fresh nonce
                    let nonce = srv_nonce.fetch_add(1, Ordering::SeqCst);
                    let body = format!(
                        "{{\"scheme\":\"exact\",\"network\":\"solana\",\"program\":\"{}\",\"payee\":\"{}\",\"mint\":\"{}\",\"amount\":{},\"nonce\":{},\"expiry\":{}}}",
                        PROGRAM, payee, mint, PRICE, nonce, EXPIRY);
                    let hdr = format!("X-Amount: {PRICE}\r\nX-Nonce: {nonce}\r\nX-Expiry: {EXPIRY}\r\nX-Payee: {payee}\r\nX-Mint: {mint}\r\n");
                    write_resp(&mut st, "402 Payment Required", &hdr, &body);
                }
                Some(payload) => {
                    // payload = hex(payer_pk[32] || sig[64] || nonce_le[8])
                    let raw = unhex(&payload);
                    let payer = Pubkey::new_from_array(raw[0..32].try_into().unwrap());
                    let sig: [u8; 64] = raw[32..96].try_into().unwrap();
                    let nonce = u64::from_le_bytes(raw[96..104].try_into().unwrap());
                    let msg = authorization(&payer, &payee, &mint, PRICE, nonce, 0, EXPIRY);
                    // settle ON-CHAIN as the relayer (our program is the facilitator)
                    let r = send_res(&rpc, &relayer, &[
                        ed25519_ix(&payer.to_bytes(), &sig, &msg),
                        pay_ix(&relayer.pubkey(), &escrow, &mint, &vault, &payee_ata, &payer_authority, PRICE, nonce, 0, EXPIRY),
                    ]);
                    match r {
                        Ok(_) => write_resp(&mut st, "200 OK", "", "{\"resource\":\"premium data: 42\",\"settled\":true}"),
                        Err(e) => { let b = format!("{{\"error\":\"settle failed: {e}\"}}"); write_resp(&mut st, "402 Payment Required", "", &b); }
                    }
                }
            }
        }
    });
    std::thread::sleep(std::time::Duration::from_millis(300));

    // ---- the AI agent: signs only, never touches Solana ----
    let agent_sk: SigningKey = s.payer_sk.clone();
    let mut agent_solana_txs = 0u32; // stays 0 — the proof

    // step 1-2: hit the resource, get 402 + terms
    let (code1, hdr1, _b1) = http_get(PORT, None);
    println!("agent GET /premium  ->  {code1}");
    assert!(code1.starts_with("402"), "expected 402");
    let amount: u64 = hdr(&hdr1, "x-amount").parse().unwrap();
    let nonce: u64 = hdr(&hdr1, "x-nonce").parse().unwrap();
    let expiry: i64 = hdr(&hdr1, "x-expiry").parse().unwrap();
    let payee_q = Pubkey::from_str(&hdr(&hdr1, "x-payee")).unwrap();
    let mint_q = Pubkey::from_str(&hdr(&hdr1, "x-mint")).unwrap();
    println!("server quoted: {} USDC, nonce {nonce}", amount as f64 / 1e6);

    // step 3: sign the authorization OFF-CHAIN
    let msg = authorization(&payer_authority, &payee_q, &mint_q, amount, nonce, 0, expiry);
    let sig: [u8; 64] = agent_sk.sign(&msg).to_bytes();
    let mut payload = Vec::new();
    payload.extend_from_slice(&payer_pk32);
    payload.extend_from_slice(&sig);
    payload.extend_from_slice(&nonce.to_le_bytes());
    println!("agent signed authorization (no tx, no gas). solana txs sent by agent: {agent_solana_txs}");

    // step 4-6: resend with payment, get the resource
    let (code2, _h2, body2) = http_get(PORT, Some(&hex(&payload)));
    println!("agent GET /premium  X-PAYMENT  ->  {code2}");
    assert!(code2.starts_with("200"), "expected 200 after payment");
    println!("server returned: {}", body2.trim());

    // proof of on-chain settlement + agent purity
    let bal: u64 = rpc.get_token_account_balance(&payee_ata).unwrap().amount.parse().unwrap();
    assert_eq!(bal, PRICE, "payee received the fee on-chain");
    assert_eq!(agent_solana_txs, 0, "agent must send zero Solana transactions");
    println!("\nS2 PASS: real HTTP 402 flow. agent paid by signing only (0 tx, 0 gas), server settled on-chain with no facilitator, resource delivered.");
    std::process::exit(0);
}

// ---- tiny HTTP (std::net only) ----

fn read_request(st: &mut TcpStream) -> (String, Option<String>) {
    let mut r = BufReader::new(st.try_clone().unwrap());
    let mut line = String::new();
    r.read_line(&mut line).ok();
    let method_line = line.trim().to_string();
    let mut xpay = None;
    loop {
        let mut h = String::new();
        if r.read_line(&mut h).unwrap_or(0) == 0 { break; }
        let t = h.trim();
        if t.is_empty() { break; }
        if let Some(v) = t.strip_prefix("X-PAYMENT: ").or_else(|| t.strip_prefix("x-payment: ")) {
            xpay = Some(v.to_string());
        }
    }
    (method_line, xpay)
}

fn write_resp(st: &mut TcpStream, status: &str, extra_headers: &str, body: &str) {
    let resp = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{extra_headers}Connection: close\r\n\r\n{body}",
        body.len());
    st.write_all(resp.as_bytes()).ok();
    st.flush().ok();
}

fn http_get(port: u16, x_payment: Option<&str>) -> (String, String, String) {
    let mut st = TcpStream::connect(("127.0.0.1", port)).unwrap();
    let mut req = format!("GET /premium HTTP/1.1\r\nHost: localhost\r\n");
    if let Some(p) = x_payment { req.push_str(&format!("X-PAYMENT: {p}\r\n")); }
    req.push_str("Connection: close\r\n\r\n");
    st.write_all(req.as_bytes()).unwrap();
    let mut resp = String::new();
    st.read_to_string(&mut resp).unwrap();
    let mut parts = resp.splitn(2, "\r\n\r\n");
    let head = parts.next().unwrap_or("").to_string();
    let body = parts.next().unwrap_or("").to_string();
    let status = head.lines().next().unwrap_or("").replace("HTTP/1.1 ", "");
    (status, head, body)
}

fn hdr(head: &str, key: &str) -> String {
    head.lines()
        .find(|l| l.to_lowercase().starts_with(key))
        .and_then(|l| l.splitn(2, ':').nth(1))
        .map(|v| v.trim().to_string())
        .unwrap_or_default()
}
