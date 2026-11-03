# VaultKey Test Accounts and Scan Inputs

Create these two test-only users in the Auth0 database connection enabled for VaultKey. They are proposed identities, not existing accounts. Set a different generated password for each and save it in your password manager. If email verification is required, use two aliases at an inbox you control instead of the example addresses.

| User | Example login | Purpose |
| --- | --- | --- |
| Alice | `vaultkey-alice@example.com` | First scan owner |
| Bob | `vaultkey-bob@example.com` | Second scan owner |

Sign in as Alice in your normal browser and Bob in a private window. That keeps their login cookies separate. Use a development or demo tenant and synthetic input only.

## Alice: one finding on line 2

```text
// VaultKey synthetic test fixture, no live credentials
GITHUB_TOKEN=ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATST1
```

Expected: one GitHub finding on line 2. The displayed value should be `ghp_****TST1`. Save it and note the scan ID from its history link.

## Bob: a different finding

```text
GITHUB_TOKEN=ghp_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBTST2
```

Expected: one GitHub finding on line 1 with masked value `ghp_****TST2`. Bob’s history should show his scan and exclude Alice’s. When the detail endpoint is ready, opening Alice’s history link in Bob’s window should reveal no scan or findings.

## Either user: a clean scan

```js
const message = 'hello VaultKey'
```

Expected: zero findings, a successful save, and a new entry in that user’s history. A saved clean scan still counts as a scan.

For the empty history check, open `/history` as Bob before his first save. For the signed-out check, open `/history` in a browser session without an Auth0 login.
