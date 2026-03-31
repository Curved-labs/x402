# Contributing to crif

Thank you for your interest in contributing to crif. This document outlines
the process for contributing to the project.

## Development setup

```bash
git clone https://github.com/Crifdotfun/crif
cd crif
cargo build
cargo test
```

## Pull request process

1. Fork the repository and create a feature branch from `main`.
2. Write or update tests for your changes.
3. Ensure `cargo fmt --check` and `cargo check` pass.
4. Commit using conventional commit messages (`feat:`, `fix:`, `refactor:`, etc.).
5. Open a pull request against `main`.

## Commit messages

This project uses conventional commits:

- `feat:` — new feature or capability
- `fix:` — bug fix
- `refactor:` — code restructuring without behavior change
- `docs:` — documentation only
- `test:` — adding or updating tests
- `chore:` — maintenance, dependencies, CI
- `perf:` — performance improvement

## Code style

- Rust: follow `rustfmt.toml` defaults (run `cargo fmt` before committing)
- TypeScript: follow prettier defaults
- No commented-out code in PRs
- No `TODO` or `FIXME` markers in final code

## Reporting issues

Use the GitHub issue templates for bug reports and feature requests.

## Security

For security vulnerabilities, see [SECURITY.md](SECURITY.md). Do not open
public issues for security reports.

## License

By contributing, you agree that your contributions will be licensed under
the MIT License.
