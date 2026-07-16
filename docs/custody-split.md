# Custody split

The escrow separates two roles: the authority (who owns the money) and the delegate (who can authorize payments).

## Roles

| Role | Can deposit | Can withdraw | Can sign authorizations | Can revoke delegate |
|---|---|---|---|---|
| Authority | Yes | Yes | No (unless also delegate) | Yes |
| Delegate | No | No | Yes | No |

## Why

An AI agent that pays for API calls needs a signing key. If that key can also withdraw from the escrow, a compromised agent drains the entire balance. The custody split limits the damage: the agent can only spend via signed authorizations (bounded by the escrow balance), never withdraw to an arbitrary address.

## Setup

```typescript
// Human opens escrow, sets the bot as delegate
const ix = openEscrowIx(humanPubkey, botPubkey);

// Bot signs authorizations using its own key
const sig = signAuthorization(botKeypair, auth);

// Human can revoke the bot at any time
const revoke = setDelegateIx(humanPubkey, PublicKey.default);
```

After revocation, all outstanding signed authorizations become invalid immediately. The program checks `escrow.delegate != Pubkey::default` on every settlement, so there is no race window.

## Rotation

The authority can rotate the delegate to a new key without draining and re-funding:

```typescript
const rotate = setDelegateIx(humanPubkey, newBotPubkey);
```

The old bot's signatures stop working. The new bot's signatures start working. No fund movement.
