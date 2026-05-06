//! Shared x402sol client pieces: on-chain instruction builders + a localnet
//! setup that funds an agent escrow. Used by the S1 e2e and the S2 HTTP demo.

use ed25519_dalek::SigningKey;
use sha2::{Digest, Sha256};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use solana_sdk::sysvar::instructions as ix_sysvar;
use solana_system_interface::{instruction as system_instruction, program as system_program};
use std::str::FromStr;

pub const PROGRAM: &str = "12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y";
pub const ED25519_ID: &str = "Ed25519SigVerify111111111111111111111111111";
pub const TOKEN: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
pub const ATA: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
pub const AUTH_DOMAIN: &[u8] = b"X402SOL_AUTH_V1";
const MINT_LEN: usize = 82;

pub fn pid() -> Pubkey { Pubkey::from_str(PROGRAM).unwrap() }
pub fn token() -> Pubkey { Pubkey::from_str(TOKEN).unwrap() }
pub fn disc(n: &str) -> [u8; 8] { Sha256::digest(format!("global:{n}").as_bytes())[..8].try_into().unwrap() }

pub fn authorization(payer: &Pubkey, payee: &Pubkey, mint: &Pubkey, amount: u64, nonce: u64, expiry: i64) -> Vec<u8> {
    let mut m = Vec::new();
    m.extend_from_slice(AUTH_DOMAIN);
    m.extend_from_slice(payer.as_ref());
    m.extend_from_slice(payee.as_ref());
    m.extend_from_slice(mint.as_ref());
    m.extend_from_slice(&amount.to_le_bytes());
    m.extend_from_slice(&nonce.to_le_bytes());
    m.extend_from_slice(&expiry.to_le_bytes());
    m
}

pub fn ed25519_ix(pubkey: &[u8; 32], sig: &[u8; 64], msg: &[u8]) -> Instruction {
    let (pk_off, sig_off, msg_off): (u16, u16, u16) = (16, 48, 112);
    let mut data = vec![1u8, 0u8];
    for v in [sig_off, u16::MAX, pk_off, u16::MAX, msg_off, msg.len() as u16, u16::MAX] {
        data.extend_from_slice(&v.to_le_bytes());
    }
    data.extend_from_slice(pubkey);
    data.extend_from_slice(sig);
    data.extend_from_slice(msg);
    Instruction { program_id: Pubkey::from_str(ED25519_ID).unwrap(), accounts: vec![], data }
}

pub fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[owner.as_ref(), token().as_ref(), mint.as_ref()], &Pubkey::from_str(ATA).unwrap()).0
}

fn init_mint(mint: &Pubkey, auth: &Pubkey, dec: u8) -> Instruction {
    let mut d = vec![20u8, dec]; d.extend_from_slice(auth.as_ref()); d.push(0);
    Instruction { program_id: token(), accounts: vec![AccountMeta::new(*mint, false)], data: d }
}
fn mint_to(mint: &Pubkey, dst: &Pubkey, auth: &Pubkey, amt: u64) -> Instruction {
    let mut d = vec![7u8]; d.extend_from_slice(&amt.to_le_bytes());
    Instruction { program_id: token(), accounts: vec![AccountMeta::new(*mint, false), AccountMeta::new(*dst, false), AccountMeta::new_readonly(*auth, true)], data: d }
}
fn mk_ata(payer: &Pubkey, owner: &Pubkey, mint: &Pubkey) -> Instruction {
    Instruction { program_id: Pubkey::from_str(ATA).unwrap(), accounts: vec![
        AccountMeta::new(*payer, true), AccountMeta::new(ata(owner, mint), false),
        AccountMeta::new_readonly(*owner, false), AccountMeta::new_readonly(*mint, false),
        AccountMeta::new_readonly(system_program::id(), false), AccountMeta::new_readonly(token(), false),
    ], data: vec![0] }
}

/// One authorized-payment instruction (permissionless: `relayer` submits).
pub fn pay_ix(relayer: &Pubkey, escrow: &Pubkey, mint: &Pubkey, vault: &Pubkey, payee_ata: &Pubkey,
              payer_authority: &Pubkey, amount: u64, nonce: u64, expiry: i64) -> Instruction {
    // nonces are bitmap windows of 1024: rent once per window, not per payment
    let window = nonce / 1024;
    let nonce_pda = Pubkey::find_program_address(&[b"nonce", payer_authority.as_ref(), &window.to_le_bytes()], &pid()).0;
    let mut d = disc("pay").to_vec();
    d.extend_from_slice(&amount.to_le_bytes());
    d.extend_from_slice(&nonce.to_le_bytes());
    d.extend_from_slice(&expiry.to_le_bytes());
    Instruction { program_id: pid(), accounts: vec![
        AccountMeta::new(*relayer, true),
        AccountMeta::new_readonly(*escrow, false),
        AccountMeta::new_readonly(*mint, false),
        AccountMeta::new(*vault, false),
        AccountMeta::new(*payee_ata, false),
        AccountMeta::new(nonce_pda, false),
        AccountMeta::new_readonly(ix_sysvar::id(), false),
        AccountMeta::new_readonly(token(), false),
        AccountMeta::new_readonly(system_program::id(), false),
    ], data: d }
}

pub fn send(rpc: &RpcClient, fee: &Keypair, extra: &[&Keypair], ixs: &[Instruction]) {
    let bh = rpc.get_latest_blockhash().unwrap();
    let mut s = vec![fee]; s.extend_from_slice(extra);
    let tx = Transaction::new_signed_with_payer(ixs, Some(&fee.pubkey()), &s, bh);
    rpc.send_and_confirm_transaction(&tx).expect("tx");
}
pub fn send_res(rpc: &RpcClient, fee: &Keypair, ixs: &[Instruction]) -> Result<(), Box<dyn std::error::Error>> {
    let bh = rpc.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(ixs, Some(&fee.pubkey()), &[fee], bh);
    rpc.send_and_confirm_transaction(&tx)?;
    Ok(())
}

pub struct Setup {
    pub payer: Keypair,
    pub payer_sk: SigningKey,
    pub relayer: Keypair,
    pub payee: Keypair,
    pub mint: Pubkey,
    pub escrow: Pubkey,
    pub vault: Pubkey,
    pub payee_ata: Pubkey,
}

/// Airdrop, create a USDC-like mint, open + fund the agent's escrow.
pub fn setup(rpc: &RpcClient, deposit: u64) -> Setup {
    let payer = Keypair::new();
    let relayer = Keypair::new();
    let payee = Keypair::new();
    for k in [&payer, &relayer, &payee] {
        let s = rpc.request_airdrop(&k.pubkey(), 5_000_000_000).unwrap();
        while !rpc.confirm_transaction(&s).unwrap_or(false) { std::thread::sleep(std::time::Duration::from_millis(150)); }
    }
    let payer_sk = SigningKey::from_bytes(&payer.to_bytes()[..32].try_into().unwrap());

    let mint = Keypair::new();
    let rent = rpc.get_minimum_balance_for_rent_exemption(MINT_LEN).unwrap();
    send(rpc, &payer, &[&mint], &[
        system_instruction::create_account(&payer.pubkey(), &mint.pubkey(), rent, MINT_LEN as u64, &token()),
        init_mint(&mint.pubkey(), &payer.pubkey(), 6),
        mk_ata(&payer.pubkey(), &payer.pubkey(), &mint.pubkey()),
        mk_ata(&payer.pubkey(), &payee.pubkey(), &mint.pubkey()),
        mint_to(&mint.pubkey(), &ata(&payer.pubkey(), &mint.pubkey()), &payer.pubkey(), 1_000_000_000),
    ]);

    let escrow = Pubkey::find_program_address(&[b"escrow", payer.pubkey().as_ref()], &pid()).0;
    let vault = Pubkey::find_program_address(&[b"vault", escrow.as_ref(), mint.pubkey().as_ref()], &pid()).0;
    // v2: the payer is its own delegate here (self-owned agent, spike-compatible)
    let mut open = disc("open_escrow").to_vec();
    open.extend_from_slice(payer.pubkey().as_ref());
    send(rpc, &payer, &[], &[Instruction { program_id: pid(), accounts: vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new(escrow, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ], data: open }]);
    let mut dep = disc("deposit").to_vec(); dep.extend_from_slice(&deposit.to_le_bytes());
    send(rpc, &payer, &[], &[Instruction { program_id: pid(), accounts: vec![
        AccountMeta::new(payer.pubkey(), true),
        AccountMeta::new_readonly(escrow, false),
        AccountMeta::new_readonly(payer.pubkey(), false),
        AccountMeta::new_readonly(mint.pubkey(), false),
        AccountMeta::new(ata(&payer.pubkey(), &mint.pubkey()), false),
        AccountMeta::new(vault, false),
        AccountMeta::new_readonly(token(), false),
        AccountMeta::new_readonly(system_program::id(), false),
    ], data: dep }]);

    let payee_ata = ata(&payee.pubkey(), &mint.pubkey());
    Setup { payer, payer_sk, relayer, payee, mint: mint.pubkey(), escrow, vault, payee_ata }
}
