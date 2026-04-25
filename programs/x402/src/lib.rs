//! x402sol settlement program (Anchor).
//!
//! An AI agent pre-funds a non-custodial escrow once, then makes gasless
//! micropayments by signing off-chain authorizations. Any relayer submits an
//! authorization to this program; the program is the facilitator.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked, ID as INSTRUCTIONS_ID,
};
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y");

pub const ED25519_ID: Pubkey =
    anchor_lang::solana_program::pubkey!("Ed25519SigVerify111111111111111111111111111");
pub const AUTH_DOMAIN: &[u8] = b"X402SOL_AUTH_V1";

#[program]
pub mod x402_settle {
    use super::*;

    pub fn open_escrow(ctx: Context<OpenEscrow>) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        e.authority = ctx.accounts.payer.key();
        e.bump = ctx.bumps.escrow;
        Ok(())
    }

    pub fn deposit(ctx: Context<Fund>, amount: u64) -> Result<()> {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.payer_tokens.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )
    }

    pub fn withdraw(ctx: Context<Fund>, amount: u64) -> Result<()> {
        let payer = ctx.accounts.payer.key();
        let seeds: &[&[u8]] = &[b"escrow", payer.as_ref(), &[ctx.accounts.escrow.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.payer_tokens.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )
    }

    /// Settle one authorized payment. Permissionless: `relayer` can be anyone.
    pub fn pay(ctx: Context<Pay>, amount: u64, nonce: u64, expiry: i64) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let payer = escrow.authority;
        let payee = ctx.accounts.payee_tokens.owner;
        let mint = ctx.accounts.mint.key();

        let msg = authorization(&payer, &payee, &mint, amount, nonce, expiry);
        verify_ed25519(&ctx.accounts.instructions.to_account_info(), &payer, &msg)?;

        let now = Clock::get()?.unix_timestamp;
        require!(now <= expiry, X402Error::Expired);

        let w = &mut ctx.accounts.nonce;
        let bit = (nonce % NonceWindow::BITS) as usize;
        let (byte, mask) = (bit / 8, 1u8 << (bit % 8));
        require!(w.bits[byte] & mask == 0, X402Error::NonceSpent);
        w.bits[byte] |= mask;

        let seeds: &[&[u8]] = &[b"escrow", payer.as_ref(), &[escrow.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.payee_tokens.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        Ok(())
    }
}

/// The exact message the payer signs off-chain.
pub fn authorization(payer: &Pubkey, payee: &Pubkey, mint: &Pubkey, amount: u64, nonce: u64, expiry: i64) -> Vec<u8> {
    let mut m = Vec::with_capacity(15 + 32 * 3 + 24);
    m.extend_from_slice(AUTH_DOMAIN);
    m.extend_from_slice(payer.as_ref());
    m.extend_from_slice(payee.as_ref());
    m.extend_from_slice(mint.as_ref());
    m.extend_from_slice(&amount.to_le_bytes());
    m.extend_from_slice(&nonce.to_le_bytes());
    m.extend_from_slice(&expiry.to_le_bytes());
    m
}

fn verify_ed25519(ix_sysvar: &AccountInfo, payer: &Pubkey, expected: &[u8]) -> Result<()> {
    let cur = load_current_index_checked(ix_sysvar)? as usize;
    require!(cur > 0, X402Error::MissingSig);
    let self_idx = (cur - 1) as u16;
    let ix = load_instruction_at_checked(cur - 1, ix_sysvar)?;
    require_keys_eq!(ix.program_id, ED25519_ID, X402Error::MissingSig);

    let d = &ix.data;
    require!(d.len() >= 16, X402Error::BadSigIx);
    require!(d[0] == 1, X402Error::BadSigIx);
    let u16at = |i: usize| u16::from_le_bytes([d[i], d[i + 1]]);
    let refs_self = |i: usize| { let v = u16at(i); v == u16::MAX || v == self_idx };
    require!(refs_self(4) && refs_self(8) && refs_self(14), X402Error::BadSigIx);

    let (pk_off, msg_off, msg_size) = (u16at(6) as usize, u16at(10) as usize, u16at(12) as usize);
    require!(d.len() >= pk_off + 32 && d.len() >= msg_off + msg_size, X402Error::BadSigIx);
    require!(&d[pk_off..pk_off + 32] == payer.as_ref(), X402Error::WrongSigner);
    require!(msg_size == expected.len() && &d[msg_off..msg_off + msg_size] == expected, X402Error::WrongAuth);
    Ok(())
}

#[account]
pub struct Escrow {
    pub authority: Pubkey,
    pub bump: u8,
}
impl Escrow { pub const SIZE: usize = 8 + 32 + 1; }

/// One account covers 1024 nonces, so the rent that used to be paid per
/// payment is paid once per window and amortised ~1000x.
#[account]
pub struct NonceWindow {
    pub bits: [u8; 128],
}
impl NonceWindow {
    pub const BITS: u64 = 1024;
    pub const SIZE: usize = 8 + 128;
}

#[derive(Accounts)]
pub struct OpenEscrow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init, payer = payer, space = Escrow::SIZE,
        seeds = [b"escrow", payer.key().as_ref()], bump
    )]
    pub escrow: Box<Account<'info, Escrow>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Fund<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"escrow", payer.key().as_ref()], bump = escrow.bump, has_one = authority @ X402Error::NotAuthority)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// CHECK: escrow.authority == payer enforced via has_one
    #[account(address = payer.key())]
    pub authority: UncheckedAccount<'info>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_tokens: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = payer,
        seeds = [b"vault", escrow.key().as_ref(), mint.key().as_ref()], bump,
        token::mint = mint, token::authority = escrow, token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, auth_nonce: u64)]
pub struct Pay<'info> {
    /// anyone: the relayer pays the fee, and the window rent once per 1024 nonces
    #[account(mut)]
    pub relayer: Signer<'info>,
    #[account(seeds = [b"escrow", escrow.authority.as_ref()], bump = escrow.bump)]
    pub escrow: Box<Account<'info, Escrow>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref(), mint.key().as_ref()], bump,
        token::mint = mint, token::authority = escrow,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint)]
    pub payee_tokens: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = relayer, space = NonceWindow::SIZE,
        seeds = [b"nonce", escrow.authority.as_ref(), &(auth_nonce / NonceWindow::BITS).to_le_bytes()], bump
    )]
    pub nonce: Box<Account<'info, NonceWindow>>,
    /// CHECK: constrained to the instructions sysvar
    #[account(address = INSTRUCTIONS_ID)]
    pub instructions: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum X402Error {
    #[msg("missing Ed25519 verification instruction")]
    MissingSig,
    #[msg("malformed Ed25519 instruction")]
    BadSigIx,
    #[msg("authorization not signed by the payer")]
    WrongSigner,
    #[msg("authorization does not match this payment")]
    WrongAuth,
    #[msg("authorization expired")]
    Expired,
    #[msg("authorization already spent")]
    NonceSpent,
    #[msg("not the escrow authority")]
    NotAuthority,
}
