# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in this project, please report it privately through
GitHub's private vulnerability reporting:

**[Report a vulnerability](https://github.com/Curved-labs/x402/security/advisories/new)**

Do not open a public issue. Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge your report within 48 hours and provide a timeline for a fix.

## Scope

The following are in scope:

- The on-chain settlement program (`programs/x402/`)
- The SDK's relay and wall middleware (`sdk/src/`)
- The zero-dependency client (`sdk/zero/`)
- Authorization construction and signature verification

The following are out of scope:

- The devnet deployment (test environment)
- Example scripts in `examples/`
- The Rust client binaries (alpha, not audited)

## Supported versions

| Version | Supported |
|---|---|
| 0.4.x | Yes |
| < 0.4 | No |

## Disclosure policy

We follow coordinated disclosure. We ask that you give us 90 days to address the issue before any public disclosure.

## Known limitations

- The program has not been formally audited. It is deployed on devnet only.
- Single author. No independent review of the cryptographic verification logic has been done beyond the test suite.
- The nonce bitmap is append-only. There is no mechanism to reclaim rent from fully spent windows.
