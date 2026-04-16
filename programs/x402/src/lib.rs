//! x402sol settlement program (Anchor).
//!
//! An AI agent pre-funds a non-custodial escrow once, then makes gasless
//! micropayments by signing off-chain authorizations.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y");

pub const AUTH_DOMAIN: &[u8] = b"X402SOL_AUTH_V1";

#[program]
pub mod x402_settle {
    use super::*;

    pub fn open_escrow(ctx: Context<OpenEscrow>) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        e.authority = ctx.accounts.payer.key();
        e.nonce = 0;
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

    /// Settle one authorized payment. The payer must sign the transaction.
    pub fn pay(ctx: Context<Pay>, amount: u64, nonce: u64, expiry: i64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let payer = escrow.authority;

        require!(nonce == escrow.nonce, X402Error::NonceSpent);
        let now = Clock::get()?.unix_timestamp;
        require!(now <= expiry, X402Error::Expired);

        escrow.nonce += 1;

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

#[account]
pub struct Escrow {
    pub authority: Pubkey,
    pub nonce: u64,
    pub bump: u8,
}
impl Escrow { pub const SIZE: usize = 8 + 32 + 8 + 1; }

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
    #[account(seeds = [b"escrow", payer.key().as_ref()], bump = escrow.bump)]
    pub escrow: Box<Account<'info, Escrow>>,
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
pub struct Pay<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"escrow", payer.key().as_ref()], bump = escrow.bump)]
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
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum X402Error {
    #[msg("authorization expired")]
    Expired,
    #[msg("authorization already spent")]
    NonceSpent,
}
