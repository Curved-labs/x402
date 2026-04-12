//! x402sol settlement program (Anchor).

use anchor_lang::prelude::*;

declare_id!("12wgXGsPik37Sb2UViocZqLuBrSGZXPgsNtjM8K1yZ8Y");

#[program]
pub mod x402_settle {
    use super::*;

    pub fn open_escrow(ctx: Context<OpenEscrow>) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        e.authority = ctx.accounts.payer.key();
        e.bump = ctx.bumps.escrow;
        Ok(())
    }
}

#[account]
pub struct Escrow {
    pub authority: Pubkey,
    pub bump: u8,
}
impl Escrow { pub const SIZE: usize = 8 + 32 + 1; }

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
