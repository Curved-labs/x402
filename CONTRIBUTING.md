# Contributing

Contributions are welcome. This document covers the basics.

## Development setup

```bash
# program
anchor build
anchor test

# sdk
cd sdk
npm install
npm run build
npm run typecheck

# client (separate workspace)
cd client
cargo build
```

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes. Add tests if the change is behavioral.
3. Run `cargo fmt --all` and `npm run format` before committing.
4. Open a PR against `main` with a clear description of what changed and why.

## Commit messages

Use conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

## Code style

- Rust: `rustfmt` defaults plus the overrides in `rustfmt.toml`.
- TypeScript: `prettier` defaults. Strict mode is on.
- No comments explaining what the code does. Comments are for why.

## Testing

The test suite runs against devnet. You need a funded devnet wallet in `stage-wallet.json` (not committed). Create one with:

```bash
solana-keygen new -o stage-wallet.json --no-bip39-passphrase
solana airdrop 2 $(solana address -k stage-wallet.json) --url devnet
```

Then run:

```bash
cd sdk
npm run test:suite    # 15 integration tests
npm run test:wallet   # 8 policy tests
```

## Security

If you find a vulnerability, do not open an issue. See [SECURITY.md](SECURITY.md).
