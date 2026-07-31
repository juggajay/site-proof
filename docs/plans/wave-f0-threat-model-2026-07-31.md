# Wave F.0 — Threat model: the gate before any F3 code

**Date:** 31 July 2026 · **Status:** the blocking pre-build gate required by
`CIVOS-Validated-Buildout-Plan-2026-07-24.md` §7 (*"threat model as a gated
artifact before integration waves"*) and restated by
`docs/plans/wave-f-claim-readiness-spec-2026-07-31.md` §3.1 and §5's F3 gate 3.
**Docs only. No F3 code PR may merge until this artifact merges.**

**Every `file:line` in this document was opened in this worktree at HEAD
`4bce1fda4073d6163847452741730ea3302b8a9d`** (= `origin/master`,
`feat(handover): put the number in the folio-coverage nudge (#1700)`). Nothing
is quoted from memory, from the Wave F spec's citation list, or from the
adversarial review. §0.3 records which of the spec's citations moved, which are
wrong, and which point at code that does not do what the spec says it does.

**Why this artifact exists now.** Under the spec as written, F3 was parked
behind decision **D1** and this threat model was a future concern. **Jay's
2026-07-31 override builds F3 this wave**, which puts this document on the
critical path. It is written to the bar of
`docs/plans/wave-e0-threat-model-2026-07-28.md` (1,426 lines): numbered items,
each terminating in a binding `### Disposition` with a named owner and a
testable exit condition.

**This artifact does not authorise any code.** It disposes of twenty items. F3
becomes buildable only for those surfaces whose blocking items are dispositioned
non-`Block` **and** whose named remediation work (§21) has landed.

---

## 0. How to read this

### 0.1 The disposition vocabulary — and the rule that makes it binding

Carried over verbatim from Wave E.0 §0.1, because the rule is what stops a
verdict decaying into documentation:

| Disposition | What it means | What discharges it |
|---|---|---|
| **Accept** | The risk is taken as-is, in a named person's name. | The accepting sentence, with the owner's name, appears in this artifact. Nothing further is built. |
| **Mitigate before X** | The risk is real and X may not ship without the fix. | A named PR **and** a named test. Both must exist before X merges. |
| **Block until X** | No F3 work proceeds on that surface until X is true. | A re-disposition, in a PR amending this artifact. |
| **PROPOSED-ACCEPT** | This artifact recommends acceptance but **Jay has not accepted it**. Until he does, it is not an Accept. | Jay's sentence in a PR body or in an amendment to this file. **§24 is the complete list.** |

**The rule Wave E.0 §0.1 added, applied literally here: a *current* violation may
not be dispositioned as "documented".** Where shipped behaviour already breaks a
stated boundary and F3 touches it, the disposition is `Mitigate before F3` and
the fix is a named remediation PR (**`F.0a`**, §21), not a paragraph in this
file.

**Nothing in this document is a legal conclusion, and nothing in CIVOS may
state one.** Where a question is legal in character (§17, §18) it is written as
facts plus a position for counsel, never as a finding. This mirrors Wave E.0
§7.3 and the research register's own caveat.

### 0.2 Scope — what F3 actually is, stated before it is threatened

Per spec §2.3 and §5 F3, the increment is:

> Push one claim as one DRAFT `ACCREC` invoice into the connected Xero org, with
> the evidence-pack PDF attached.

Concretely that is: a per-company `XeroConnection` holding an encrypted refresh
token; connect / callback / disconnect routes; a push action reusing the CSV's
pure mapping function (`buildXeroInvoiceExport`,
`backend/src/routes/claims/xeroExport.ts:129`); a PDF attach; and Xero
status/error columns on `ProgressClaim`.

**F1** (project-level blocked-value aggregate) and **F2** (per-company account
code and tax type) are in scope for exactly one item — **item 19**, which tests
the spec's own claim that neither needs this gate.

### 0.3 Citation regeneration at `4bce1fda` — including three that are wrong

The spec was written against `18bd3cfc`. `git diff --name-only 18bd3cfc 4bce1fda`
touches `backend/src/routes/handoverExports/`, `frontend/src/lib/queryKeys.ts`
and two handover frontend files — **none** of the files this threat model or the
spec's Xero sections cite. Every discrepancy below is therefore an authoring
error at `18bd3cfc`, not drift.

| Spec citation | Spec says | At `4bce1fda` | Verdict |
|---|---|---|---|
| `oauth.ts:384` "issuer allowlist", offered as **outbound** OAuth2-client precedent | outbound client reuse | `:371` reads `GOOGLE_CLIENT_ID` for audience check; `:386` throws `Invalid Google token issuer`. This is **inbound Google ID-token validation** | **WRONG — material.** It is not outbound-client precedent and gives F3 nothing. |
| `runtimeConfig.ts:486-487` as "the fail-fast pattern" for `XERO_*` asserts | the pattern to copy | `:486-487` is the **Resend** assertion. The two that matter are `:446` (`assertProductionHexKey('ENCRYPTION_KEY', …, 32)`) and `:460-461` (`FATAL: ALLOW_PLAINTEXT_SECRET_STORAGE=true is not allowed in production`) | **WRONG — material**, and it changes item 3's disposition: the production case the spec fears is already impossible. |
| `auditLog.ts:142` `parseAuditLogChanges` | the function | declared `:134`; `:142` is the re-sanitise call inside it | DRIFTED (harmless) |
| `stateStore.ts:100` "cleanup" | the cleanup | `cleanupExpiredStates` at `:88`; `:100` is the `setInterval` | DRIFTED (harmless) |
| `auditLog.ts:18-40` sensitive patterns | eight patterns implied | **nine** patterns at `:18-40`; the ninth (`/^notificationSentTo$/i`, `:39`) landed from Wave E.0 §18 row 9c | Spec's range is right; the count is now nine. |
| `encryption.ts:44`/`:80` | encrypt / decrypt | `:44` encrypt, `:80` decrypt | **Exact.** |
| `xeroExport.ts:184-194` invariant | the guard | `:184` index lookup, `:189-194` the throw | Substantively exact. |
| `claims.ts:15` subcontractor hard-deny | the deny | `:15` defines the set; the throw is `:42-44` | DRIFTED (harmless) |
| `ProgressClaim.evidencePackageUrl` as the attachment source (§2.4) | the PDF lives here | column exists at `schema.prisma:1538` and has **zero readers and zero writers** in `backend/src` | **WRONG — blocking.** See item 8. |
| §2.4 "One line per claimed lot" as the complete line inventory | one source | the shipped mapper emits **two**: lot rows `xeroExport.ts:153-170` **and variation rows `:171-181`** | **WRONG — blocking.** See item 7, row 7f. |
| §2.4 omits `*DueDate` entirely | not listed | `*DueDate` is header column 4 (`xeroExport.ts:27`), populated from a CIVOS-computed SOPA date (`ClaimsPage.tsx:532`) | **OMISSION — material.** See item 7, row 7d. |
| D6 "invoice number set from `Claim #{n} — {Project.name}`" | with a `#` | shipped string has **no `#`**: `` `Claim ${claim.claimNumber} — ${claim.projectName}` `` (`xeroExport.ts:138`) | DRIFTED, and the underlying value is not unique — item 10. |

### 0.4 What this artifact found that neither the spec nor the review found

Four findings originate here. All four carry a disposition below.

1. **The evidence-pack PDF that D4 calls "the reason to build F3 at all" does not
   exist as a server-side artifact.** It is generated **in the browser** from a
   JSON payload and never persisted: `frontend/src/pages/claims/ClaimsPage.tsx:578-579`
   dynamically imports `generateClaimEvidencePackagePDF`
   (`frontend/src/lib/pdf/claimEvidencePackagePdf.ts:41`), which ends in
   `savePdf(doc, filename, 'claim-evidence-package.pdf')` (`:930`) — a browser
   download. `ProgressClaim.evidencePackageUrl` (`schema.prisma:1538`) is a dead
   column. **Item 8, `Block until`.**
2. **That PDF is a manifest, not photographs — and it can print staff email
   addresses.** `claimEvidencePackagePdf.ts:750-778` renders an `EVIDENCE
   MANIFEST` of document names and ids ("*Use CIVOS document IDs to retrieve
   controlled originals*"), and photos appear only as **counts** (`:189`,
   `:630`). Meanwhile the backend payload sets
   `name: c.completedBy.fullName || c.completedBy.email`
   (`backend/src/routes/claims/evidenceRoutes.ts:317-320`, `:325-328`,
   `:376-379`), and the PDF prints that `name` at `:444-454`. **So the spec
   overstates the photographs and understates the personal data.** **Item 7 row
   7g, item 8.**
3. **Sentry breadcrumbs are entirely unfiltered, on both backend and frontend.**
   `scrubSentryEvent` (`backend/src/lib/sentry.ts:35-67`) sanitises message,
   `extra` and `request`, and deletes cookies and the `authorization` header
   (`:58-62`) — but it **never iterates `event.breadcrumbs`**, and there is no
   `beforeBreadcrumb` and no `integrations` override in `Sentry.init`
   (`:81-89`), so Node's default HTTP auto-instrumentation is on. The frontend
   has **no `beforeSend` at all** (`frontend/src/lib/sentry.ts:13-20`). §3.2
   row 1's control *"excluded from Sentry breadcrumbs"* is asserted, not built.
   **Item 12.**
4. **There is no company-deletion path in the codebase, and the nominal cascade
   is unreachable anyway.** No route, no helper, no script deletes a `Company`
   (§23). Even if one existed, `Project.company` is `onDelete: Restrict`
   (`schema.prisma:400`), so any company with one project cannot be deleted —
   which makes `WebhookConfig`'s `onDelete: Cascade` (`:196`), the exact
   precedent F3 would copy, a control that never fires. A Xero refresh token
   would have **no automated destruction trigger at all**. **Item 16.**

### 0.5 External sources — how they were obtained, because it changes their grade

The spec graded two Xero pages **A ("read directly")** and marked five
`[VERIFY BEFORE BUILD]` because `developer.xero.com` returned 60-second
timeouts. The adversarial review reproduced those timeouts and could not
reproduce the grade-A claim.

**This pass fetched eleven primary Xero pages successfully**, by rendering them
with local headless Playwright — `developer.xero.com` serves a JavaScript shell
whose content is client-rendered from Contentful, so `WebFetch` and plain `curl`
both return an empty page while a real browser does not. **Every fact tagged
`[FETCHED]` below is verbatim from a rendered primary Xero page**, and the
method is recorded here so the next agent does not repeat the failure. Facts
tagged `[SECONDARY]` come from search snippets, GitHub repositories or SDK docs.

This closes spec Honest Unknowns **#1, #2, #3, #9** outright, and item 10 shows
that one of the answers is **materially worse than the spec assumed**.

---

## 1. Item 1 — The capability being created, before and after

### 1.1 Current state at `4bce1fda`

**CIVOS holds no third-party OAuth credential of any kind today.** Verified by
grep across `backend/prisma/schema.prisma` for `xero|integration|refresh_token|
refreshToken|accessToken` — **zero hits**. The only outbound OAuth2 client is
Google, and it is **login-only**: it exchanges a code, reads
`https://www.googleapis.com/oauth2/v2/userinfo` (`oauth.ts:288`), and keeps
nothing. No token is stored.

The only **reversible** secret in the schema is `WebhookConfig.secret`
(`schema.prisma:189`), encrypted on write
(`backend/src/routes/webhooks.ts:60-61`, applied `:225` and `:402`) and
decrypted on delivery (`backend/src/routes/webhooks/delivery.ts:126-127`,
`:149`). Everything else that can be one-way hashed **is** hashed — `ApiKey.keyHash`
(`schema.prisma:140`), `OauthState.stateHash` (`:264`),
`HoldPointReleaseToken.token` (`:825`). `User.twoFactorSecret` (`:51`) is the
second reversible one, encrypted at `backend/src/routes/mfa.ts:143` and
decrypted at `:194`, `:278` and `backend/src/routes/auth.ts:326`.

### 1.2 After F3

A `XeroConnection` row holds a refresh token that grants **ongoing write access
to a customer's accounting system**, renewable indefinitely, revocable only by
the customer or by CIVOS calling Xero. This is a **new class of asset for this
codebase**: `WebhookConfig.secret` is a value CIVOS *mints and replays to prove
its own identity*; a Xero refresh token is a value a *third party issues* that
*authorises CIVOS to act as the customer*. The blast radius of a leak is not
"someone can forge a CIVOS webhook"; it is "someone can write invoices into a
construction company's books".

**Scope of what one token reaches — worse than one organisation.** [FETCHED]
https://developer.xero.com/documentation/guides/oauth2/tenants states: *"If the
user has authorised your app previously, they may have existing tenant
connections. **All of the user's connected tenants can be accessed with the most
recent access token.**"* Tenant isolation on Xero's side is enforced **only by
which `xero-tenant-id` header CIVOS sends**. This is item 6 and it is the single
most consequential external fact in this document.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| Introducing a renewable third-party write credential as a new asset class | **PROPOSED-ACCEPT** — it is the increment. The capability is what F3 *is*; the controls are items 2–6, 12, 16. | Jay | Jay's sentence in the F3 PR body. Not accepted until then. |
| `WebhookConfig` as the structural precedent (per-company row, AES-256-GCM, `onDelete: Cascade`) | **Accept the encryption precedent; do NOT accept the lifecycle precedent** — see item 16, where the cascade is shown to be unreachable. | build agent | The migration reuses `encrypt()`/`decrypt()` (item 3) **and** item 16's deletion path exists. A migration that copies only the cascade discharges nothing. |

---

## 2. Item 2 — Connect-time company binding and the `state` parameter · **Blocks F3**

### 2.1 The shipped state store binds no actor — verified

`backend/src/routes/oauth/stateStore.ts:10-22`:

```
backend/src/routes/oauth/stateStore.ts:10-19
export async function createOAuthState(redirectUri?: string): Promise<string> {
  const state = crypto.randomBytes(32).toString('hex');

  await prisma.oauthState.create({
    data: {
      stateHash: hashOAuthState(state),
      redirectUri: redirectUri || null,
      expiresAt: new Date(Date.now() + OAUTH_STATE_EXPIRY_MS),
    },
  });
```

and `verifyOAuthState` (`:24-48`) returns exactly
`{ valid: boolean; redirectUri?: string }`, deleting the row at `:42` before it
returns. **No `userId`, no `companyId`, nowhere to put one.** Entropy is 32
random bytes (`:11`), stored as a sha256 digest, TTL `OAUTH_STATE_EXPIRY_MS =
10 * 60 * 1000` (`:6`), swept at `:88-98` and on an interval at `:100-104`.

That design is **correct for Google login**, where the callback establishes
identity *from the returned ID token* (`oauth.ts:371`, `:386`). It is
**insufficient for Xero**, where the callback must attach a returned refresh
token to one specific CIVOS company and **Xero's response contains no CIVOS
identity to derive it from**.

### 2.2 The three paths a build agent will take, and why two of them are the threat

Spec §2.5 says *"reuse `stateStore.ts:10` `createOAuthState()`"* and picks none
of these:

1. **Extend `OauthState` with a nullable `companyId`.** Correct. Costs one
   additive column on a table the spec did not budget a migration for (§5 F3
   budgets "one reviewed additive migration", for `XeroConnection`).
2. **Smuggle it through `redirectUri`.** Server-side-bound, so not
   client-tamperable — but `redirectUri` is *also* fed straight into a redirect
   (`oauth.ts:170`, `:177-178`). Overloading a redirect target with an
   authorization subject is how open-redirect and confused-deputy bugs get
   written. Reject.
3. **Read `companyId` from a callback query parameter.** Lowest friction,
   and **it is the tenant-crossing vulnerability at connect time**: an attacker
   who can induce a victim admin to complete a Xero authorization with an
   attacker-chosen `companyId` binds the *victim's* Xero org to the *attacker's*
   CIVOS company. Spec §3.2 row 9's control (*"the connection is looked up from
   the claim's project's company"*) guards the **push**, not the **connect**, so
   row 9 does not cover this.

### 2.3 What Xero gives us to work with

- **`state` is echoed back unchanged and is optional.** [FETCHED]
  https://developer.xero.com/documentation/guides/oauth2/auth-flow/ — *"Pass in
  a value that's unique to the user you're sending through authorisation. It
  will be passed back after the user completes authorisation"*, and *"If the
  states don't match, the request may have been created by a third party and you
  should abort the process."*
- **No documented size limit on `state`.** Could not establish from any Xero
  page. **Treat as undocumented**: keep `state` an opaque 32-byte handle and
  hold the binding server-side. Do not embed a payload.
- **PKCE is the wrong flow here, and the spec's §3.2 row 4 is wrong to list it
  as a required control.** [FETCHED]
  https://developer.xero.com/documentation/guides/oauth2/auth-flow/ — *"The
  standard authorization code flow is **suitable for web server applications
  that can securely store a client secret**. If you're building a native app
  (desktop or mobile) then you should refer to the PKCE flow."* And [FETCHED]
  https://developer.xero.com/documentation/guides/oauth2/pkce-flow — PKCE apps
  get *"no option to generate a client secret"*, and *"Single Page Apps (SPAs)
  are not currently supported."* The CIVOS backend is a **confidential client**.
  A repo-wide grep for `code_verifier|code_challenge|pkce|PKCE` across
  `backend/src` returns **zero hits** (§23), so listing PKCE as a control also
  implies a mechanism that does not exist.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **Connect-time company binding** | **Block until the design item is written into the spec (Rev 2) and the binding is server-side.** The `companyId` must be established from `requireCompanyAdmin(req.user!)` (`backend/src/routes/company/access.ts:6-17`) at **connect** and carried in the **state store**, never in a callback query parameter and never in `redirectUri`. | build agent (design in Rev 2); Jay ratifies the extra migration | A test that a callback carrying an **attacker-supplied `companyId` query parameter** creates **no connection** — and that removing the server-side binding makes that test fail. Plus a test that a valid callback binds to the *authenticated admin's* company and no other. |
| The 32-byte sha256 state + 10-minute TTL as the CSRF control | **PROPOSED-ACCEPT** — 256-bit entropy, hashed at rest, single-use (`stateStore.ts:42` deletes before returning), 10-minute window. This is already correct. | Jay | `stateStore.ts:6`, `:10-22`, `:24-48` unchanged except for the additive binding above; a test asserting a replayed state fails. |
| **PKCE listed as a required control in spec §3.2 row 4** | **Mitigate before F3 — by deletion.** Rev 2 drops PKCE and states the one-line reason (confidential client; Xero positions PKCE for clients that cannot hold a secret). Leaving it in makes a reviewer believe a control exists. | build agent | §3.2 row 4 in Rev 2 no longer names PKCE, and names the standard authorization-code flow instead. |

---

## 3. Item 3 — Token storage at rest, and the passthrough that hides a plaintext token forever · **Blocks F3**

### 3.1 The cipher is correct

`backend/src/lib/encryption.ts:7` — `ALGORITHM = 'aes-256-gcm'`; 96-bit IV
(`:8`), 128-bit auth tag (`:9`), key read from `ENCRYPTION_KEY` as 64 hex
characters (`:22`, length checked `:31-34`). Authenticated encryption, correctly
parameterised. Nothing to fix.

### 3.2 The write path is already fail-closed in production — correcting the spec

Spec §2.5 constraint 1 says *"A misconfigured staging environment therefore
stores a live customer's Xero refresh token in cleartext with no error"* and
§3.2 row 2 treats production plaintext as a live threat. Read at this SHA:

- `encryption.ts:49-53` — when `getEncryptionKey()` is null, `encrypt()` returns
  plaintext **only if** `isPlaintextSecretStorageAllowed()` (`:12-18`:
  `NODE_ENV` development or test, **or** `ALLOW_PLAINTEXT_SECRET_STORAGE ===
  'true'`); otherwise it **throws** `'Encryption key not configured'`.
- `backend/src/lib/runtimeConfig.ts:446` —
  `assertProductionHexKey('ENCRYPTION_KEY', process.env.ENCRYPTION_KEY, 32);`
- `runtimeConfig.ts:460-461` —
  `throw new Error('FATAL: ALLOW_PLAINTEXT_SECRET_STORAGE=true is not allowed in production');`

**So in production, both arms of `isPlaintextSecretStorageAllowed()` are
unreachable and the process refuses to boot without a valid key.** The spec's
scenario is real for **staging** (`NODE_ENV !== 'production'`) and already
impossible in production. The connect-time assert is still worth building — it
turns a staging misconfiguration into a refused connection rather than a
cleartext customer credential — but it must be justified honestly.

### 3.3 The read path is the actual defect — and it is silent

`backend/src/lib/encryption.ts:80-87`:

```
backend/src/lib/encryption.ts:80-87
export function decrypt(encryptedValue: string): string {
  const key = getEncryptionKey();

  // Check if value is encrypted format
  if (!isEncrypted(encryptedValue)) {
    // Value is not encrypted, return as-is (for migration support)
    return encryptedValue;
  }
```

**This passthrough is unconditional and un-env-gated.** It runs before the
key-null check at `:90-96`, and `isEncrypted` (`:129-136`) is a pure format test
against `ENCRYPTED_FORMAT_REGEX` (`:10`).

The consequence for F3, in production, with a valid `ENCRYPTION_KEY` set:
**a refresh token that reached the database as cleartext by any route decrypts
"successfully" forever.** The push works. The refresh works. Every monitoring
signal in spec §4.4 is green. And a live customer refresh token sits in
plaintext in the row, in every nightly backup, and in any read replica —
indefinitely, because nothing deletes it (item 16).

The routes by which cleartext can arrive are not hypothetical: a staging or
local database promoted or restored into production; a manual `INSERT` during
incident recovery; a build agent writing the token before wiring `encrypt()`;
`ALLOW_PLAINTEXT_SECRET_STORAGE=true` set in a preview environment whose data is
later copied. The passthrough's stated purpose — *"for migration support"* — is
real for MFA secrets encrypted after the fact; it is exactly wrong for a
credential created after the encryption existed.

### 3.4 Key rotation has no story, and the spec is right about it

`ENCRYPTED_FORMAT_REGEX` (`:10`) is `iv:authTag:ciphertext` with **no key id**.
Rotating `ENCRYPTION_KEY` orphans every stored token, and `decrypt()` throws
inside `crypto`'s auth-tag check rather than returning a typed failure. The
spec's answer — re-consent, surfaced as `status='expired'` — is the right
answer, and a versioned-key envelope is correctly out of scope.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| AES-256-GCM via the shipped `encrypt()`/`decrypt()` | **PROPOSED-ACCEPT** — correct primitive, correct parameters, existing precedent (`webhooks.ts:225`). | Jay | `XeroConnection`'s token column is written through `encrypt()` (`encryption.ts:44`) and never through a raw assignment — a grep assertion in the F3 PR that no Prisma write sets the token field from an un-`encrypt()`ed expression. |
| **Plaintext-on-read passthrough (`encryption.ts:84-87`)** | **Block until the F3 read path asserts `isEncrypted()`.** F3 must **not** call `decrypt()` bare on the refresh token. It must call `isEncrypted(stored)` (`encryption.ts:129`) first and treat a bare value as `status='expired'` requiring re-consent — never as a usable token. | build agent | **AT-F3-PLAINTEXT-READ:** a `XeroConnection` row seeded with a **non-encrypted** token string, with `ENCRYPTION_KEY` set, produces a refused push and `status='expired'` — **and the test fails if the guard is removed**. Asserted by re-reading the row, not by inspecting the response. |
| Connect-time `ENCRYPTION_KEY` assert | **Mitigate before F3** — but justified as a **staging** control, not a production one (§3.2). | build agent | A test that with `ENCRYPTION_KEY` unset and `NODE_ENV='test'`, the connect route **refuses** rather than storing plaintext. Spec §5.5's `ENCRYPTION_KEY absent → connect refused` already names it; this pins the reason. |
| No key rotation story | **PROPOSED-ACCEPT** — re-consent is the documented recovery, surfaced as `status='expired'`. A versioned envelope is a separate, larger change. | Jay | A test that a decrypt failure yields `status='expired'` + a reconnect prompt, never a crash and never a silent skip. The runbook sentence naming re-consent as the rotation procedure. |
| Spec §2.5 constraint 1 / §3.2 row 2 wording | **Mitigate before F3 — by correction.** Rev 2 cites `runtimeConfig.ts:446` and `:460-461` and scopes the risk to staging. | build agent | The Rev 2 text cites those two lines, not `:486-487`. |

---

## 4. Item 4 — Refresh, rotation, and the write-ordering that kills a connection

### 4.1 The external facts, now primary

| Fact | Value | Source |
|---|---|---|
| Access token lifetime | **up to 30 minutes** | [FETCHED] https://developer.xero.com/documentation/guides/oauth2/token-types |
| Refresh token lifetime (unused) | **60 days**, then full re-authorisation | [FETCHED] same, and https://developer.xero.com/faq/oauth2 |
| Rotation | **Every refresh returns a new refresh token**; both must be persisted | [FETCHED] token-types — *"Every time you use a refresh_token, you will get a new one along with the new access_token."* |
| Failed-refresh grace | **30 minutes**, documented | [FETCHED] token-types — *"If your app doesn't receive the response, or fails to save the new token, you can retry using your existing refresh token for a grace period of 30 minutes."* |
| Refresh endpoint | `POST https://identity.xero.com/connect/token`, HTTP Basic with `client_id:client_secret` | [FETCHED] token-types |

The spec's §2.5 table is **correct on all five**, and its grade-A label is now
earned rather than asserted (§0.5).

### 4.2 The dangerous line, restated precisely

Spec §2.5's failure table calls the rotation-persist ordering *"the single most
dangerous line in the integration"*. It is right, and the reason is the 30-minute
grace: **the grace window is what makes the correct ordering recoverable and the
incorrect ordering fatal.**

- Persist the new refresh token **before** using the new access token: a crash
  between the two loses nothing; the next refresh uses the persisted token.
- Use the new access token first and persist after: a crash leaves Xero holding
  a rotated token and CIVOS holding the old one. **Within 30 minutes** the old
  one still works. **After 30 minutes it does not**, and the customer must
  reconnect — with no CIVOS-side signal that anything happened until the next
  push fails.

**This makes the grace window a monitoring requirement, not just a retry
policy.** A rotation-persist failure has a 30-minute remediation window and then
becomes permanent. Spec §4.4 already says *"refresh-token rotation failures (any
non-zero value is an incident)"* — that sentence is load-bearing and this item
ratifies it.

### 4.3 The HTTP client, and the one place the default timeout is wrong

`fetchWithTimeout` (`backend/src/lib/fetchWithTimeout.ts:10-14`) with
`DEFAULT_FETCH_TIMEOUT_MS = 15000` (`:1`). Spec §2.5 is right that bare `fetch`
is forbidden. The refresh call, the invoice create and the `GET /connections`
call all fit comfortably in 15s. **The attachment upload does not necessarily**
— item 8 and spec §4.2's F3 row both flag this, and the timeout must be raised
deliberately and stated, not inherited.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| 30-minute access token, 60-day refresh, rotation on every refresh | **Accept** — external facts, now primary-sourced. Not a CIVOS decision. | build agent | The F3 client persists the rotated refresh token on every refresh; a test asserts the stored value **changed** after a refresh, read back from the database. |
| **Rotation-persist ordering** | **Mitigate before F3.** Persist first, use second. No exceptions, including in error paths. | build agent | Spec §5.5's *"rotation-persist failure → `status='expired'` + reconnect prompt, never a silent dead connection"* — **plus** a fault-injection test where the DB write throws *after* Xero rotated, asserting `status='expired'` and that **no** push proceeded on the new access token. |
| The 30-minute grace as a **monitoring** requirement | **Mitigate before F3.** A rotation-persist failure is a 30-minute incident, not a log line. | build agent | Spec §4.4's rotation-failure metric exists and is non-zero-alerting **at deploy**, not "later". Stated in the F3 PR body with the alert's destination named. |
| Attachment-call timeout inherited from the 15s default | **Mitigate before F3** — see item 8. | build agent | The attachment call passes an explicit `timeoutMs`, and the F3 PR body states the number **and the measured p95 evidence-pack size it was derived from**. |

---

## 5. Item 5 — Revocation and disconnect are two different things, and CIVOS needs both

### 5.1 The finding that closes Honest Unknown #9 — and adds a second endpoint

Spec Honest Unknown #9 asks whether Xero exposes a revocation endpoint. **It
does, and there is also a separate disconnect endpoint, and they do different
things.**

**Revocation** — [FETCHED]
https://developer.xero.com/documentation/guides/oauth2/token-types:

- `POST https://identity.xero.com/connect/revocation`
- `Authorization: Basic base64(client_id + ":" + client_secret)`
- body `application/x-www-form-urlencoded`, single param `token=<refresh_token>`
- success = **200, empty body**
- effect, verbatim: *"You can revoke a user's refresh token and **remove all
  their connections to your app**"*

**Disconnect one tenant** — [FETCHED]
https://developer.xero.com/documentation/guides/oauth2/tenants:

- `DELETE https://api.xero.com/connections/{connectionId}` with
  `Authorization: Bearer <access_token>`
- success = **204, empty body**
- `{connectionId}` is the `id` from `GET /connections` — **not** the `tenantId`
- and the sentence that matters: *"Note that this does **not** make the tokens
  you are using invalid. In order to revoke your tokens, use the token
  revocation endpoint."*

Corroborated in the OpenAPI spec: `DELETE /Connections/{id}`, *"Deletes a
connection for this user (i.e. disconnect a tenant)"* — [FETCHED]
https://raw.githubusercontent.com/XeroAPI/Xero-OpenAPI/master/xero-identity.yaml

### 5.2 The ordering constraint, and why getting it wrong leaves a live credential

`DELETE /connections/{id}` **requires a live access token**. `/connect/revocation`
**invalidates the refresh token that mints access tokens**. So the order is
forced:

1. `DELETE /connections/{connectionId}` — while the access token still works.
2. `POST /connect/revocation` — kill the refresh token.
3. Delete the local row and write the audit entry.

Revoking first strands the connection: Xero still lists CIVOS as a connected app
in the customer's Connected Apps page, and CIVOS can no longer call the endpoint
that removes it. The customer must then clean up manually, in a UI they were
told they would not have to touch.

**And a local-delete-only disconnect is worse than either.** If CIVOS deletes its
row without calling Xero, the customer's Xero org still shows CIVOS as connected
and the refresh token — which CIVOS just discarded, but which Xero still honours
for up to 60 days — remains valid. Nothing in CIVOS can revoke it any more,
because the only copy was deleted. **A disconnect must revoke before it
forgets.**

The spec's §2.5 disconnect bullet says *"deletes the stored tokens and writes an
audit row"* and defers the Xero call to `[VERIFY BEFORE BUILD]`. That ordering is
now the wrong ordering.

### 5.3 The three revocation directions

| Direction | Trigger | Required behaviour |
|---|---|---|
| **CIVOS-initiated** | admin clicks Disconnect | §5.2's three steps, in order. A Xero-side failure at step 1 or 2 is **logged and surfaced**, and the local row is still removed — but the audit row must record that the remote revocation failed, so an operator can finish it. |
| **Xero-initiated** | customer disconnects in Xero's Connected Apps; loses tenant permission; tenant deleted; app deleted ([FETCHED] tenants page) | detected on the next call as an auth failure → `status='revoked'`, reconnect prompt, **stop all further calls**. Do not retry into a revoked connection. |
| **Expiry** | 60 days unused | `status='expired'` → reconnect prompt. Spec §4.4's *"days-since-last-refresh per connection with an alert before the 60-day cliff"* is the control. |

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **Disconnect must call Xero, in the order disconnect-then-revoke** | **Mitigate before F3.** Honest Unknown #9 is closed (§5.1); the conditional wording in spec §2.5 must become a required sequence in Rev 2. | build agent | Three tests: (a) a successful disconnect issues `DELETE /connections/{id}` **then** `POST /connect/revocation` **then** deletes the row — asserted on call order, not just on call presence; (b) a Xero failure at either step still deletes the local row **and** writes an audit row recording the remote failure; (c) after disconnect, a push attempt is refused. |
| Xero-initiated revocation → `status='revoked'`, stop calling | **Mitigate before F3** | build agent | Spec §5.5's `Revocation: CIVOS-initiated, Xero-initiated, expiry` — extended so the Xero-initiated case asserts **no further outbound call is attempted** after the flip, not merely that the status changed. |
| 60-day expiry cliff | **Mitigate before F3** | build agent | The days-since-last-refresh metric exists at deploy with an alert threshold **below 60 days**, stated as a number in the F3 PR body. |

---

## 6. Item 6 — One access token reaches every org that user ever connected · **Blocks F3**

### 6.1 The fact

[FETCHED] https://developer.xero.com/documentation/guides/oauth2/tenants:

> *"A user may have access to multiple tenants and will choose which ones to
> connect to your app… If the user has authorised your app previously, they may
> have existing tenant connections. **All of the user's connected tenants can be
> accessed with the most recent access token.**"*

Every Accounting API call carries **both** `Authorization: Bearer …` **and**
`xero-tenant-id: <tenantId GUID>`. **The tenant header is the only thing
selecting the organisation.** `GET https://api.xero.com/connections` returns the
array of `{ id, authEventId, tenantId, tenantType, tenantName, … }`, and an
optional `?authEventId=` filter narrows it to *the orgs authorised in this
specific flow* — the `authentication_event_id` claim is inside the decoded
access token ([FETCHED] token-types).

### 6.2 Why this is a CIVOS threat and not a Xero one

The realistic CIVOS customer is a head contractor whose bookkeeper or director
also has Xero access to other entities — a related trading company, a family
trust, a previous employer, a client. That person connects CIVOS. **CIVOS's
access token now reaches every one of those organisations**, and the only thing
preventing an invoice landing in the wrong set of books is which GUID CIVOS puts
in a header.

Three concrete failure shapes:

1. **Naive selection.** A build agent calls `GET /connections` and takes
   `connections[0]` because the happy path has one entry. The first entry is not
   ordered by anything the customer chose.
2. **Stale selection.** The tenant is chosen once at connect and stored. The
   customer later disconnects that org in Xero and connects a different one;
   `GET /connections` changes; CIVOS keeps pushing against a `tenantId` that is
   now either invalid or — worse — still valid and no longer the one they meant.
3. **Silent widening.** [FETCHED] scopes page: *"any new scopes will be **added
   to previously consented scopes**"* — authority accumulates across
   re-authorisations and never narrows. A second connect flow, run for an
   unrelated reason, can broaden what the stored token can do without anyone
   deciding to broaden it.

**Spec §3.2 row 9 does not cover this.** Its control is *"the connection is
looked up from the claim's project's company, never from a request parameter"* —
which correctly stops CIVOS company A pushing through company B's *connection*.
It says nothing about which *Xero organisation* that connection resolves to.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **Tenant selection must be an explicit, recorded, re-confirmable customer choice** | **Block until the design names it.** `XeroConnection` stores the chosen `tenantId` **and** `tenantName` **and** the `connectionId`. If `GET /connections` returns more than one, the admin **chooses** — no defaulting to index 0. The chosen `tenantName` is displayed on the connection card and beside the push button, so the pushing user sees which books they are writing to. | build agent (design in Rev 2); Jay ratifies the UI disclosure | **AT-F3-TENANT-CHOICE:** a connect flow returning two connections creates **no** connection until one is chosen; a test that `connections[0]` is never auto-selected. **AT-F3-TENANT-HEADER:** every outbound Accounting call carries the **stored** `tenantId` and a push cannot be issued with a `tenantId` from any request-supplied value. |
| **Stale tenant detection** | **Mitigate before F3.** Before a push, if the stored `connectionId` is absent from `GET /connections`, refuse and surface a reconnect prompt naming the organisation. | build agent | A test where `GET /connections` no longer contains the stored `connectionId`: the push is **refused before any invoice call**, with a message naming the stored `tenantName`. |
| Scope accumulation across re-authorisations | **PROPOSED-ACCEPT** — it is Xero's model and CIVOS cannot narrow it. The mitigation is requesting the minimum scope set and never adding one casually. | Jay | The requested scope string is a **single compiled constant** and a test pins it (item 20's frozen-scope assertion). Scopes: `accounting.invoices`, `accounting.attachments`, `accounting.contacts.read`, `offline_access` — see §6.3. |

### 6.3 Scopes — the minimum set, and a deprecation the spec does not know about

[FETCHED] https://developer.xero.com/documentation/guides/oauth2/scopes:

| Need | Scope | Status |
|---|---|---|
| Create a draft `ACCREC` invoice | **`accounting.invoices`** | Current granular scope |
| Attach a file to an invoice | **`accounting.attachments`** | Current |
| Read contacts (link, not create) | **`accounting.contacts.read`** | Current |
| Obtain a refresh token | **`offline_access`** | Required — *"To get a refresh token, you must request the offline_access scope."* |

**`accounting.transactions` — the broad scope most third-party examples show — is
marked Deprecated.** Verbatim: *"Broad scopes are being replaced by granular
scopes… Broad scopes will remain available until **September 2027**."* Since
**March 2026** all new Web and PKCE apps are assigned granular scopes. A build
agent copying a 2024-vintage tutorial will request a deprecated scope and get
more authority than the increment needs. **Rev 2 must name the four scopes
above explicitly.**

---

## 7. Item 7 — The egress inventory, field by field

### 7.1 The rule being measured against

Spec §0.3 boundary 1 and 3, quoted:

> **CIVOS is a data compiler, not a financial tool. Xero owns money.** CIVOS
> never computes GST, retention, revenue, cash flow, or amounts owed.
> …
> **No CIVOS-computed dollar total appears on an evidence document.**

and §2.4's own framing: the table is *"the complete output surface"* for a
frozen-payload test.

### 7.2 What actually leaves the tenant — eight rows, each dispositioned

Every field below was read at `4bce1fda` in
`backend/src/routes/claims/xeroExport.ts`, which spec §5 F3 requires F3 to reuse
unchanged (*"the invoice payload builder is the same pure mapping function the
CSV uses… If the F3 build writes a second mapping function, that is a review
failure"*).

| # | Field | Where | Classification | Verdict | Disposition | Owner |
|---|---|---|---|---|---|---|
| **7a** | **`*ContactName`** — `claim.clientName?.trim() \|\| claim.projectName` | `xeroExport.ts:149`; source `Project.clientName` (`schema.prisma:373`) | Customer business identity — free text | In scope. The customer's own client, going into the customer's own ledger. | **PROPOSED-ACCEPT** | Jay |
| **7b** | **`*InvoiceNumber`** — `` `Claim ${n} — ${projectName}` `` | `xeroExport.ts:138` | Project name — commercially identifying, not personal | In scope, but **not unique** — item 10. | **Mitigate before F3** (uniqueness, item 10) | build agent |
| **7c** | **`*InvoiceDate`** — `config.invoiceDate ?? claim.periodEnd` | `xeroExport.ts:139-140`; `ProgressClaim.claimPeriodEnd` (`schema.prisma:1524`) | Business date | In scope. D6 recommends `periodEnd`; already the default. | **PROPOSED-ACCEPT** | Jay |
| **7d** | **`*DueDate`** — a **CIVOS-computed SOPA statutory payment date** | header `xeroExport.ts:27`; emitted `:148`, `:163`, `:175`; provenance comment `:241-243`; computed client-side at `frontend/src/pages/claims/ClaimsPage.tsx:532` via `calculatePaymentDueDate(claim.submittedAt, claim.projectState)` | **CIVOS-derived statutory position** | **Boundary question.** §0.3 excludes *"SOPA validity"* from CIVOS's outputs, unparking **"Never"** — and this value is already shipping. Not listed in §2.4 at all. | **Block until Jay rules (D8)** — see §7.3 | **Jay** |
| **7e** | **Lot lines** — `Lot {n} — {activityType} — this claim {x}% (cumulative {y}%)`, quantity `1`, ex-GST unit amount | `xeroExport.ts:153-170`; description `:155-158` | Project delivery detail — lot numbers, activity types, progress percentages | In scope. This is what an invoice line *is*. | **PROPOSED-ACCEPT** | Jay |
| **7f** | **Variation lines** — `Variation {number} — {title}`, free-text title, approved amount | `xeroExport.ts:171-181`; sourced `:290-294` | Commercial free text authored by CIVOS users | **In scope but UNDISCLOSED.** §2.4 says *"One line per claimed lot"* and §5 F3's Excluded list says *"variations as credit notes"*, which reads as "variations are out". | **Mitigate before F3** — see §7.4 | build agent |
| **7g** | **Evidence-pack PDF attachment** (D4) | **does not exist server-side** — see item 8 | Staff names, and **staff email addresses** when `fullName` is null (`evidenceRoutes.ts:317-320`, `:325-328`, `:376-379` → `claimEvidencePackagePdf.ts:444-454`); document names and ids; photo **counts** not photographs (`:189`, `:630`, `:750-778`) | **Block** — item 8 | build agent |
| **7h** | **Account code, tax type** | F2 config; defaults `xeroExport.ts:239` (`'200'`) and `:71` (`XERO_DEFAULT_TAX_TYPE = 'GST on Income'`) | Non-secret accounting configuration | In scope, trivially. | **Accept** | Jay |

### 7.3 Row 7d in full — the SOPA due date, and why it is a Jay decision

The frontend computes a per-state SOPA business-day payment date and sends it as
a query parameter:

```
frontend/src/pages/claims/ClaimsPage.tsx:531-534
      const dueDate = claim.submittedAt
        ? calculatePaymentDueDate(claim.submittedAt, claim.projectState ?? undefined)
        : null;
      const dueDateParam = dueDate ? `&dueDate=${encodeURIComponent(dueDate)}` : '';
```

The backend takes it verbatim (`xeroExport.ts:244`) and writes it to `*DueDate`
(`:148`), with its own comment saying why (`:241-243`): *"The frontend computes
the SOPA-derived payment due date (it owns the per-state business-day tables)
and passes it here."*

**Three facts make this the highest-consequence row in the inventory:**

1. A due date drives receivables ageing and, in an AU civil context, a payment
   date sits adjacent to a statutory entitlement position.
2. **It is already shipped**, so F3 does not create it. But §2.4 is presented as
   the *complete* output surface for a frozen-payload test, and it omits the
   field entirely — so a build agent writing that test from the spec produces a
   test that does not cover the most sensitive value in the payload.
3. **F3 changes its character.** In CSV a human sees the value on Xero's import
   screen before it lands. Via the API it is written directly. And CIVOS already
   hedges this language *inside its own UI* — the claims table renders
   *"Indicative Payment Schedule Due"* / *"Indicative Payment Due"* — a hedge
   that does not survive the trip into Xero, where the field is just `DueDate`.

**The alternative exists and is one line:** omit `dueDate` and let the shipped
fallback apply — `invoiceDate + XERO_DEFAULT_PAYMENT_TERMS_DAYS` where
`XERO_DEFAULT_PAYMENT_TERMS_DAYS = 30` (`xeroExport.ts:74`, applied `:144-148`).
That writes a plain commercial payment term instead of a statutory-derived date.

**This artifact does not rule on it.** It is a boundary question in Jay's
company's name, it is filed as **D8**, and §24 carries it.

### 7.4 Row 7f in full — variations, and the failure mode if the spec is followed literally

```
backend/src/routes/claims/xeroExport.ts:171-181
  const variationRows: CsvCell[][] = variations.map((variation) => [
    contactName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    `Variation ${variation.variationNumber} — ${variation.title}`,
    1,
    roundClaimAmountToCents(variation.approvedAmount),
    config.accountCode,
    taxType,
  ]);
```

A build agent writing §2.4's frozen-payload test from the spec's one-line
inventory reaches one of two outcomes:

1. Test written from §2.4 → the reused mapper emits variation rows → **the
   frozen-payload test fails on every claim that has a variation.**
2. The agent "fixes" it by dropping variation lines → but
   `totalClaimedAmount` still includes them
   (`backend/src/routes/claims/inclusionDecision.ts:292`:
   `roundClaimAmountToCents(lotClaimedAmount + variationClaimedAmount)`, from
   `:281` and `:284`) → the total-matches-lines invariant
   (`xeroExport.ts:189-194`) throws → **every claim containing a variation
   becomes permanently unpushable**, with spec §2.5's prescribed behaviour
   ("Block the push before any call") and no remediation path anywhere.

This is a data-disclosure defect **and** an availability defect from the same
omission. Free-text variation titles authored by CIVOS users already leave the
tenant today via CSV and are disclosed nowhere.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| Rows 7a, 7c, 7e, 7h | **PROPOSED-ACCEPT** — ordinary invoice content going into the customer's own ledger. | Jay | The frozen-payload test covers each field by name; adding a field fails it. |
| Row 7h (account code, tax type) | **Accept** — non-secret configuration, no personal or commercial sensitivity. | Jay | This sentence. |
| **Row 7d — the SOPA `*DueDate`** | **Block until D8 is decided by Jay.** Either accept it with stated reasoning, or fall back to `invoiceDate + 30` (`xeroExport.ts:74`) for the API path. | **Jay** | A dated sentence in the F3 PR body recording the decision, **plus** a test pinning whichever behaviour was chosen. Silence is not a decision. |
| **Row 7f — variation lines** | **Mitigate before F3.** Rev 2 adds variations to §2.4 as first-slice invoice lines (credit notes are the separate deferred thing), and the connect-time disclosure names them. | build agent | The frozen-payload test uses a claim with **at least one variation**, and asserts the variation row's description and amount. A test that only covers lot-only claims does not discharge this. |
| **Connect-time disclosure of the complete inventory** | **Mitigate before F3.** Spec §3.2 row 6 requires it; this table is its content. | build agent | An in-product connect screen listing rows 7a–7h in customer language, **and** a frontend test asserting the list renders. Removing a row fails the test. |
| **The frozen-payload test as the enforcement mechanism** | **Mitigate before F3** | build agent | The test is written against the **pure mapper** (`buildXeroInvoiceExport`, `xeroExport.ts:129`), not against the route, so it cannot be satisfied by a route-level filter. Adding any field to the mapper fails it. |

---

## 8. Item 8 — The evidence-pack attachment does not exist as specified · **Blocks F3's attachment, which is F3's stated reason to exist**

### 8.1 The finding

Spec §2.4 lists the attachment source as `ProgressClaim.evidencePackageUrl`, and
D4 calls the attachment *"the reason to build F3 at all"* — *"Without the
attachment, F3 is a worse CSV with an OAuth liability."*

**`ProgressClaim.evidencePackageUrl` (`backend/prisma/schema.prisma:1538`) has
zero readers and zero writers in `backend/src`.** A repo-wide grep for
`evidencePackageUrl` across `backend/src` returns hits only for
`HoldPoint.evidencePackageUrl` (`schema.prisma:791`) and hold-point email
payload fields — `backend/src/lib/email.ts:490`, `:525`;
`backend/src/routes/holdpoints/chaseCore.ts:398`, `:404`;
`backend/src/lib/handover/exportMemberSources.ts:344`, `:399`;
`backend/src/routes/handoverExports/snapshot.ts:189`, `:200`, `:251`; and
`backend/src/routes/folio/assemble.ts:185`, which selects it inside a
**HoldPoint** select (the neighbouring fields at `:178-184` are `pointType`,
`releasedAt`, `releasedByName`, `releaseSignatureUrl`). **The claim-grain column
is dead.**

### 8.2 Where the PDF actually comes from

It is generated **in the browser, on demand, and never persisted**:

```
frontend/src/pages/claims/ClaimsPage.tsx:573-579
        const data = await apiFetch<ClaimEvidencePackageData>(
          `/api/projects/${encodeURIComponent(projectId)}/claims/${encodeURIComponent(claimId)}/evidence-package`,
        );
        const { generateClaimEvidencePackagePDF } = await import('@/lib/pdfGenerator');
        await generateClaimEvidencePackagePDF(data, options);
```

`generateClaimEvidencePackagePDF` is
`frontend/src/lib/pdf/claimEvidencePackagePdf.ts:41`, and it terminates in
`savePdf(doc, filename, 'claim-evidence-package.pdf')` (`:930`) — a browser
download. There is **no server-side claim evidence PDF renderer anywhere in
`backend/src`**.

### 8.3 The two ways to build F3's attachment, and why both need a decision the spec did not budget

**Path A — the browser uploads the PDF it just generated.** The push becomes a
multipart request carrying a **client-supplied file**, which the backend
forwards to a third party. That is a **new file-upload trust boundary**, and
spec §3.3 states the opposite: *"Malware scanning and file-type validation on
any new upload surface — **F3 adds none** (the PDF is CIVOS-generated)."* Under
path A the PDF is *browser*-generated, and "CIVOS-generated" stops being true
the moment a request can carry arbitrary bytes to the customer's accounting
system. Path A therefore reopens every control §3.3 waives.

**Path B — build a server-side claim evidence PDF renderer.** No such renderer
exists. `claimEvidencePackagePdf.ts` is 930+ lines of jsPDF, and
`architecture_complexity_hotspots` records `pdfGenerator` as a
do-not-refactor area. This is a substantial increment that spec §5 F3 does not
scope, does not estimate and does not gate.

**Neither path is in the spec. The spec assumes a third path — a persisted
server-side artifact — that does not exist.**

### 8.4 What the PDF actually contains, which changes the disclosure too

Spec §2.4 says the attachment *"Contains site photographs, test certificates,
and personnel names"*. Read at this SHA:

- **Not photographs.** `claimEvidencePackagePdf.ts:750-778` renders an
  `EVIDENCE MANIFEST` with the explanatory line *"Document evidence recorded
  against claimed lots and approved variations. Use CIVOS document IDs to
  retrieve controlled originals."* Photos appear only as counts — `:189`
  (`Photos: ${data.summary.totalPhotos}`) and `:630`
  (`Photos recorded: ${lot.summary.photoCount}`). **No image bytes are
  embedded.**
- **Personnel names — and email addresses.** The backend payload sets
  `name: c.completedBy.fullName || c.completedBy.email`
  (`backend/src/routes/claims/evidenceRoutes.ts:317-320`), the same fallback for
  `verifiedBy` (`:325-328`) and for test verifiers (`:376-379`). The PDF prints
  that `name` verbatim at `claimEvidencePackagePdf.ts:444-454`
  (`Completed by …`, `Verified by …`). **So whenever a CIVOS user has no
  `fullName`, their email address is printed into the document.**

This is structurally the same defect Wave E.0 dispositioned as item 4d and fixed
in `E.0a` — a `fullName || email` fallback putting a staff email onto an
externally-visible artifact. Here the artifact goes into a third-party
accounting system.

**The disclosure in §2.4 is therefore wrong in both directions**: it promises a
sensitivity (photographs) that is not there, and omits one (email addresses)
that is.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **The attachment source does not exist** | **Block until Rev 2 picks path A or path B and scopes it.** F3 may not start its attachment work on the spec as written. If neither path is acceptable within the wave, **D4 must be re-decided** — and per D4's own reasoning, an F3 without the attachment is *"a worse CSV with an OAuth liability"*, which makes this a wave-shaping question, not a detail. | **Jay** (re-decides D4 if needed); build agent (scopes the chosen path) | A named section in Rev 2 stating the path, and — if path A — the malware-scanning and file-type controls §3.3 currently waives, with tests. |
| **If path A: the client-supplied-file boundary** | **Block until §3.3's waiver is withdrawn.** A request that can carry arbitrary bytes into a customer's accounting system is the highest-value upload surface in the product. | build agent | File-type validation, size cap, and the repo's existing malware-scanning control applied — each with a test asserting a non-PDF and an oversized file are **refused before any Xero call**. |
| **The `fullName \|\| email` fallback printing staff emails into the attachment** | **Mitigate before F3 → `F.0a`** (§21). The fallback drops the email arm on the claim evidence payload, exactly as Wave E.0 `E.0a` change 3 did for `batch.requestedBy`. | build agent | A test that a claim evidence payload for a user with `fullName: null` contains **no `@`** in any `name` field, **and** that the existing `fullName` case still renders. This is the first negative assertion on the claim evidence payload. |
| **§2.4's description of the attachment's contents** | **Mitigate before F3 — by correction.** Rev 2 states: a manifest of document names and ids, photo **counts**, personnel names (and emails until `F.0a` lands), and test result metadata. Not embedded photographs. | build agent | The connect-time disclosure (item 7) describes the attachment accurately. A disclosure promising photographs when none are sent is as wrong as one omitting them. |
| **Attachment irreversibility** | **Mitigate before F3.** D4's per-company opt-in is **prospective only**. A customer who opts out after fifty evidence PDFs are in their Xero org cannot un-send them; the spec offers no remediation path and does not say so. | build agent | The opt-out UI states, in product, that it applies to future pushes only and that already-attached files must be removed in Xero. A frontend test asserts the sentence. |

### 8.5 Xero's attachment limits — and a contradiction in Xero's own live docs

| Fact | Value | Source |
|---|---|---|
| Max attachments per invoice | **10** | [FETCHED] both pages, consistent |
| Max size per file — **generic Attachments page** | *"10 attachments can be uploaded per document (each up to **10mb** in size)"* | [FETCHED] https://developer.xero.com/documentation/api/accounting/attachments |
| Max size per file — **Invoices page** | *"You can upload up to 10 attachments (each up to **25mb** in size) per invoice"* | [FETCHED] https://developer.xero.com/documentation/api/accounting/invoices |
| Max request size, all APIs | **10 MB** | [FETCHED] https://developer.xero.com/documentation/guides/oauth2/limits/ |

**Two live Xero pages disagree (10 MB vs 25 MB).** The 10 MB global
max-request-size on the Limits page is consistent with the lower figure and makes
25 MB look stale. **Design to 10 MB.** Upload shape:
`POST|PUT https://api.xero.com/api.xro/2.0/Invoices/{InvoiceID}/Attachments/{Filename}`
with raw bytes as the body; **re-POSTing the same filename replaces the existing
attachment**; filenames containing `< > : " / \ | ? * \0 +` are rejected 400.

This closes spec Honest Unknown **#3** and constrains Honest Unknown **#7**: the
evidence-pack size must be measured against **10 MB**, not 25.

---

## 9. Item 9 — Push authority (D7): who can write into the customer's books

### 9.1 The shipped gates

- **Push** would sit behind `requireCommercialProjectAccess`
  (`backend/src/routes/claims.ts:36-54`): subcontractor roles hard-denied at
  `:42-44`, then the effective project role must be in
  `CLAIM_COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager']` (`:14`).
- **Connect / disconnect** would sit behind `requireCompanyAdmin`
  (`backend/src/routes/company/access.ts:6-17`): `owner` or `admin` only
  (`:11`), and it returns the caller's `companyId` (`:16`) — which is exactly
  the binding item 2 needs.

### 9.2 The abuse cases, stated

D7 recommends accepting *"any commercial-role user on any project can push into
the company Xero org"* on the grounds that *"it matches how the CSV export
already works… it is not a new capability — only a lower-friction one."* That
argument is **half right**, and the half that is wrong is the half that matters.

| Abuse case | Under CSV today | Under F3 |
|---|---|---|
| **Mass push by a disgruntled commercial user** | They download N CSV files. To get them into Xero, someone with Xero access must open Xero, choose Import, upload each file, and confirm. **A second human with a different credential is in the loop, and they see a preview screen.** | They click Push N times. **No second human, no second credential, no preview.** N draft invoices appear in the books. |
| **Wrong project → wrong client** | The importing human sees the contact name and invoice lines before confirming. | Nobody sees anything until the invoice is already in Xero. |
| **Replay / duplicate** | A human notices they are importing the same file twice. | Bounded by the idempotency key — **for six minutes** (item 10). |
| **Attribution** | The Xero audit trail attributes the import to the Xero user who performed it. | The Xero audit trail attributes every push to **the CIVOS app**, not to the CIVOS user. Attribution to a human exists **only in the CIVOS audit log** (item 13). |

**The friction the CSV imposes is not incidental — it is a second-person
control, and F3 removes it.** That does not make D7's recommendation wrong; a
draft invoice is reversible in Xero and the customer's own admin retains
control. It makes the recommendation something Jay should accept **knowing that
the second-person control is what he is trading away**, rather than on the
grounds that nothing changes.

### 9.3 The one control worth building anyway

A **per-push rate ceiling per company** — not for Xero's benefit (item 11) but
because a mass-push has no other brake. The repo already has the building block:
`consumeRateLimit(bucket, key, window, max)`
(`backend/src/lib/rateLimiter.ts:215`), used at five sites. A push limiter keyed
on `companyId` is a handful of lines beside its siblings, and it converts
"disgruntled user creates 400 invoices" into "disgruntled user creates the
ceiling and then gets an error someone notices".

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **Connect / disconnect = company admin only** | **Mitigate before F3** | build agent | Spec §5.5's permission matrix, asserting `project_manager` (a commercial role) **cannot** connect or disconnect. |
| **Push = the existing commercial project gate** | **PROPOSED-ACCEPT, on the corrected reasoning in §9.2** — the trade is the loss of the second-person import step, not "no new capability". Jay accepts knowing that. | **Jay** | A sentence in the F3 PR body in Jay's name that names the second-person control being traded away. The connect-time disclosure carries spec §3.2 row 5's verbatim warning. |
| Subcontractor roles denied everywhere | **Accept** — already hard-denied at `claims.ts:42-44`, before any project lookup. | Jay | Spec §5.5's *"subcontractor roles denied everywhere"* test. |
| **Per-company push rate ceiling** | **Mitigate before F3** — reuse `rateLimiter.ts:215`. | build agent | A test that the (N+1)th push in the window is refused **before any Xero call**, and that the refusal is audited. |
| A per-project push allowlist | **PROPOSED-ACCEPT the deferral** — D7's follow-on. Not needed for the first slice given the ceiling above. | Jay | This sentence. Unparks if a pilot objects. |

---

## 10. Item 10 — Idempotency, duplicate invoicing, and a six-minute window · **Blocks F3**

### 10.1 The fact that closes Honest Unknown #2 — and is worse than assumed

[FETCHED]
https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/:

> *"Idempotency keys are intended to help resolve transient issues only and so
> **keys are stored for 6 minutes from the time of the first call**, after which
> they expire. Repeating the same key after expiry won't produce this error and
> will instead be processed as a new key, this should be avoided."*

Also from the same page:

- Header `Idempotency-Key`, **not case-sensitive**, **max 128 characters**
  (over-length → 400 naming the key and its length).
- **POST, PUT, PATCH only** — *"The idempotency key header will be ignored for
  all other HTTP methods."*
- Same key + any change to URL, body or method → 400
  `Idempotency Key: KEY_VALUE is used with a different request.`
- **Errors are cached**: *"If an idempotent request errors out internally, the
  error will be cached and returned when the request is re-run even if the
  internal error is resolved."*
- Idempotency is evaluated **after** rate limiting — a duplicate still burns
  rate limit.
- Xero recommends concatenating **four UUIDs** as the key.
- If Xero's idempotency subsystem is unavailable it returns **500** rather than
  risk processing.

### 10.2 Why six minutes breaks the spec's plan

Spec §2.5's failure table says:

> *Network drop after Xero created the invoice* → *The `Idempotency-Key` (UUID
> derived deterministically from `claimId`) makes the retry return the original
> invoice instead of creating a duplicate.* **[VERIFY BEFORE BUILD]** *the key
> retention window; if it is shorter than a plausible retry gap, fall back to a
> Xero query-by-reference before creating.*

**The window is six minutes, and that is shorter than a plausible retry gap.**
Concretely: a user clicks Push, the network drops after Xero created the
invoice, the user is distracted, comes back after lunch and clicks Push again.
The deterministic key derived from `claimId` is identical, Xero no longer
remembers it, and **a second invoice is created in the customer's books**. The
spec's own conditional fallback is therefore not optional — it is required.

**The error-caching clause compounds it.** If the first attempt hit a Xero
internal error, that error is returned for every retry inside the window even
after Xero fixes it. So the retry policy has two regimes: inside six minutes a
retry is safe but may replay a stale error; outside six minutes a retry is
unsafe. Both need handling and they need opposite handling.

### 10.3 The invoice number is not unique, and that breaks the fallback too

The fallback the spec names is *"a Xero query-by-reference before creating"*.
That query is only sound if the reference identifies exactly one invoice.

```
backend/src/routes/claims/xeroExport.ts:138
  const invoiceNumber = `Claim ${claim.claimNumber} — ${claim.projectName}`;
```

`Project.name` (`backend/prisma/schema.prisma:371`) has **no uniqueness
constraint**. The model's only unique key is
`@@unique([companyId, projectNumber])` (`:434`). Two projects in one company may
share a name — the schema permits it and nothing in the product prevents it.

In CSV this degrades gracefully: a human sees the import screen. Via the API it
does not — two same-named projects each pushing their Claim 1 into one Xero org
produce a duplicate invoice number, **and the query-by-reference fallback
returns two invoices and cannot tell which is which**. So the uniqueness defect
and the idempotency-window defect intersect: the fallback that rescues the
short window is itself unsound.

**The fix is one field:** use `projectNumber`, which is already unique per
company (`schema.prisma:434`).

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **The six-minute idempotency window** | **Block until the query-by-reference fallback is specified and built.** Honest Unknown #2 is closed and the answer forces the fallback the spec made conditional. | build agent | **AT-F3-STALE-KEY:** a retry **after** the key has expired queries Xero by reference first and, finding the invoice, **links rather than creates** — asserted by a test where the create endpoint is not called at all. A test that only exercises the in-window retry does not discharge this. |
| **Invoice-number uniqueness (D6)** | **Mitigate before F3.** D6's recommendation changes to `projectNumber`. | build agent | An AT with **two same-named projects in one company**, each pushing their Claim 1, asserting the two invoice numbers differ. Applies to the CSV path too (it is the same mapper) and can land in F2. |
| Deterministic key derivation from `claimId` | **PROPOSED-ACCEPT** — a UUID `claimId` is well under the 128-char limit, never a counter, never reused across companies (spec §3.2 row 10). | Jay | A test pinning the key's derivation and asserting it is ≤128 characters. |
| Cached errors inside the window | **Mitigate before F3** | build agent | A test that a retry inside the window returning a cached Xero error surfaces it as a **Xero-side failure needing a new attempt**, not as a CIVOS bug and not as a silent success. |
| Idempotency evaluated after rate limiting | **Accept** — external behaviour, no CIVOS control. Noted so the push-count budget in item 11 counts retries. | build agent | This sentence. |

---

## 11. Item 11 — Rate limits, including an app-wide ceiling shared across every customer

### 11.1 The numbers, now primary

[FETCHED] https://developer.xero.com/documentation/guides/oauth2/limits/:

| Limit | Value |
|---|---|
| Concurrent calls per tenant | **5 in progress at one time** |
| Per minute per tenant | **60 calls per minute** |
| Per day per tenant | **1,000/day (starter tier), 5,000/day (higher tiers)** |
| **App-wide, across ALL tenants** | **10,000 calls per minute** |
| Headers on every response | `X-DayLimit-Remaining`, `X-MinLimit-Remaining`, `X-AppMinLimit-Remaining` |
| Breach | **HTTP 429** with `X-Rate-Limit-Problem` naming which limit; `Retry-After` **only for the minute or daily limits** |

Windows are **fixed windows that reset at different times per tenant**.

**Two corrections to the spec.** First, spec §2.5 states the daily limit flatly
as *"5,000 calls per tenant per 24h"* and grades it A. The Limits page
distinguishes **1,000/day for starter** from 5,000 for higher tiers, while
https://developer.xero.com/faq/limits still says a flat 5,000 [FETCHED, and it
disagrees with the Limits page]. **Sources disagree; treat 1,000/day as the
floor for a new app.** Second, spec §2.5 lists `X-AppMinLimit-Remaining` in its
header table but **never states what the app-level limit is**, and §4.4 monitors
day-limit per tenant only. This closes spec Honest Unknown **#1**: the
per-minute figure is **60/min/tenant**, confirmed primary.

### 11.2 The app-wide limit is a cross-tenant blast radius

`X-AppMinLimit-Remaining` counts against **10,000 calls per minute across every
CIVOS customer's Xero org combined**. Consequences:

1. **One customer's burst degrades every other customer.** A mass-push (item 9)
   or a retry storm in one tenant consumes a budget shared by all.
2. **There is no `Retry-After` on an app-minute 429** — `Retry-After` is sent
   only for the minute and daily limits. On an app-level breach CIVOS must back
   off on its own schedule, blind.
3. **It fails globally, not per tenant.** Every customer's push fails at the
   same instant, which looks like a CIVOS outage rather than a rate limit.

Spec §3.2 row 12 covers only the per-tenant daily limit and frames the threat as
*"denial of service against the customer's Xero org"*. **The larger threat is
denial of service against every other CIVOS customer**, and it is not in the
spec.

### 11.3 What F3's call budget actually is

Per push, at minimum: **create invoice** (1) + **attach PDF** (1). Plus
`GET /connections` for the stale-tenant check (item 6, 1) and a token refresh
when the 30-minute access token has lapsed (1). Contact **link** rather than
create (spec §5 F3) means no contact write, but selecting one costs a read.
**Call it 3–5 calls per push.** At 60/min/tenant that is roughly a dozen pushes
per minute per customer before the per-tenant minute limit bites — which is
comfortably above any human's click rate and comfortably below what a script
could do.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| Reading limits from response headers rather than hard-coding | **Accept** — spec §2.5 already requires it and it is correct, especially given the 1,000-vs-5,000 disagreement. | build agent | A test that the client reads `X-DayLimit-Remaining` / `X-MinLimit-Remaining` and that **no numeric limit is hard-coded** — a grep assertion that the literals `5000`, `1000` and `60` do not appear as limits in the Xero client. |
| 429 handling: honour `Retry-After`, never hot-retry | **Mitigate before F3** | build agent | Spec §5.5's 429 test, extended to assert the client **waits** the `Retry-After` value rather than retrying immediately. |
| **The app-wide 10,000/min ceiling as a cross-tenant noisy neighbour** | **Mitigate before F3.** Rev 2 adds the limit to §2.5's table and a row to §3.2. `X-AppMinLimit-Remaining` is monitored with a low-water-mark alert, alongside the per-tenant day limit §4.4 already names. | build agent | A test that a 429 carrying `X-Rate-Limit-Problem` naming the app limit is handled **without** a `Retry-After` header present — i.e. the client has its own backoff and does not crash on the missing header. Plus the metric existing at deploy. |
| **The per-company push ceiling as the CIVOS-side brake** | **Mitigate before F3** — same control as item 9. | build agent | Item 9's ceiling test. One control discharges both rows. |
| The 1,000-vs-5,000 daily disagreement | **Accept as an external ambiguity** — resolved by reading the header, not by picking a number. | build agent | The header-reading test above. Noted in the F3 PR body so nobody re-researches it. |

---

## 12. Item 12 — Secrets in logs, and the Sentry breadcrumbs nobody scrubs · **Blocks F3**

### 12.1 What is genuinely well-defended

`sanitizeLogText` and friends (`backend/src/lib/logSanitization.ts`) are strong
on this class of value. `SENSITIVE_LOG_KEY_PATTERNS` (`:4-15`) includes
`/token/i` (`:5`), `/secret/i` (`:6`), `/^code$/i` (`:10`) and `/^state$/i`
(`:11`) — the four keys an OAuth flow leaks through. `sanitizeLogText`
(`:38-65`) additionally strips `refresh_token`/`access_token` in both
JSON-ish (`:41-45`) and query-string (`:52-55`) shapes, and `Bearer`/`ApiKey`
prefixed values (`:50`). `sanitizeUrlValueForLog` (`:143-158`) redacts **every**
query value regardless of key.

`serverLogger` routes everything through these (`backend/src/lib/serverLogger.ts:5-21`,
applied `:24`), and a top-level `Error` is reduced to `{name, message}` with the
stack only in development (`:6-13`).

**The audit log is also correct by construction.** `SENSITIVE_AUDIT_KEY_PATTERNS`
(`backend/src/lib/auditLog.ts:18-40`) contains `/token/i` (`:20`) and
`/secret/i` (`:21`), applied via `sanitizeAuditChanges` (`:66-73`) on write
(`:90`) **and** on every historic read through `parseAuditLogChanges` (`:134`,
re-sanitising at `:142`). `refreshToken`, `refresh_token`, `access_token` and
`clientSecret` all match. **Spec §2.5 constraint 3 is correct and verified.**

**One residual, worth a sentence rather than a row:** the audit sanitiser matches
**keys**, not values. `{ error: 'refresh failed for token abc123' }` is stored
verbatim, because `error` matches no pattern. F3's error-recording path must put
Xero error text under a key that either matches the trap or is known not to carry
a token.

### 12.2 The Sentry gap — asserted in the spec, absent in the code

Spec §3.2 row 1 lists, as an existing control, that the refresh token is
*"excluded from Sentry breadcrumbs"*. It is not.

```
backend/src/lib/sentry.ts:81-89
  Sentry.init({
    dsn,
    environment: getEnvironment(),
    release: getRelease(),
    // Conservative for launch: errors only by default, no perf sampling.
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0),
    sendDefaultPii: false,
    beforeSend: (event) => scrubSentryEvent(event),
  });
```

`scrubSentryEvent` (`:35-67`) sanitises `event.message` (`:36-37`),
`event.extra` (`:46-48`) and `event.request` (`:50-63`, deleting cookies and the
`authorization` header at `:58-62`). **It never touches `event.breadcrumbs`.**
And `Sentry.init` has **no `beforeBreadcrumb` and no `integrations` override**
(verified by grep — zero `beforeBreadcrumb` hits repo-wide), so the Node SDK's
**default integration set is active**, including HTTP auto-instrumentation that
records outbound requests as breadcrumbs.

The frontend is worse: `frontend/src/lib/sentry.ts:13-20` has
`sendDefaultPii: false` (`:19`) and **no `beforeSend` at all**.

**Why this matters specifically for F3 and not for what shipped before.** Until
F3, CIVOS's outbound calls are Resend, Supabase, Anthropic and webhooks — none
of which puts a credential in a **URL**. The Xero flow does: the authorization
callback arrives as `…/callback?code=<authorization code>&state=<state>`, and an
error thrown anywhere in the request that follows can carry that URL as a
breadcrumb to a third party. `sendDefaultPii: false` does not help — a
breadcrumb URL is not PII in Sentry's sense.

**The mitigating factor, stated so the row is not overstated:** the inbound
callback URL is captured by Sentry only if an error is captured during that
request, `captureException` is called in exactly one place
(`backend/src/lib/sentry.ts:130`, from the error handler at `:114-132`), and the
`request` context it attaches is hand-built and pre-sanitised (`:123-129`).
So the exposure is the **breadcrumb trail**, not the request context. That is
still a real path, and it is a control the spec claims already exists.

### 12.3 `XERO_CLIENT_SECRET`

Handled the same way `GOOGLE_CLIENT_SECRET` is (`oauth.ts:116`): read from the
environment at use, never persisted, never logged. It belongs in Railway env
only, and the production assertion belongs beside `:446`/`:460-461` in
`runtimeConfig.ts` (**not** `:486-487`, which is Resend — §0.3).

**One F3-specific hazard:** the refresh call uses HTTP Basic auth
(`Authorization: Basic base64(client_id:client_secret)` — [FETCHED] token-types).
`sanitizeLogText:46-49` redacts `authorization: <value>` and `:50` redacts
`Bearer|ApiKey <value>` — but **not** a bare `Basic <value>` outside an
`authorization` key. If any F3 code logs a constructed header value directly
rather than the header object, the client secret leaves in cleartext.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| `logSanitization` + `serverLogger` as the log-redaction control | **Accept** — verified sufficient for token-shaped values. | Jay | A test that a simulated Xero token/refresh payload logged through `logError` emits `[REDACTED]` for every token field. |
| Audit redaction (`auditLog.ts:18-40`, `:66-73`, `:90`, `:142`) | **Accept** — spec §2.5 constraint 3 verified. | Jay | Spec §5.5's *"audit rows written in-transaction for connect/disconnect/push with tokens redacted"*, asserted on the **stored row read back from the database**, not on the argument passed in. |
| Audit sanitiser matches keys, not values | **Mitigate before F3** | build agent | A test that a Xero error string containing a token-like value, recorded on the claim, is not persisted verbatim — or that the error field is documented as never carrying one. |
| **`beforeBreadcrumb` does not exist; `scrubSentryEvent` never iterates `event.breadcrumbs`** | **Block until a breadcrumb scrubber exists.** F3 is the first feature that puts a credential in a URL. §3.2 row 1's control must be built, not asserted. | build agent | **AT-F3-SENTRY-BREADCRUMB:** a `beforeBreadcrumb` hook routes breadcrumb `data.url` / `message` through `sanitizeLogText`, with a unit test that a breadcrumb carrying `?code=…&state=…` is redacted — **and the test fails if the hook is removed**. |
| Frontend Sentry has no `beforeSend` | **Mitigate before F3** — narrower: F3's connect flow is initiated from the browser, so the callback URL can land in a frontend breadcrumb too. | build agent | A `beforeSend` on `frontend/src/lib/sentry.ts:13-20` that strips query strings from breadcrumb URLs, with a test. |
| `XERO_CLIENT_SECRET` in Railway env only, production-asserted | **Mitigate before F3** | build agent | The assert sits beside `runtimeConfig.ts:446`; a test that production boot fails without it. **Plus** a grep assertion that no `Basic ` header value is passed to any logger (§12.3). |

---

## 13. Item 13 — Audit logging for connect, disconnect and push

### 13.1 The right helper already exists and the spec picks it correctly

`writeAuditLogInTransaction` (`backend/src/lib/auditLog.ts:127-132`) propagates
failure so the surrounding transaction rolls back. Its own doc comment
(`:114-126`) puts *"privileged company/security actions — role changes,
ownership transfer, member/key/webhook deletions and mutations"* in that class,
explicitly contrasting it with best-effort `createAuditLog` (`:105-112`), which
swallows failures at `:110`.

**Connect, disconnect and push are all in the privileged class**, and spec §3.3
already says so. This item ratifies it and adds the reason: **the CIVOS audit
log is the only place a push is attributed to a human.** Xero's own audit trail
attributes every push to the CIVOS app (item 9.2). If the CIVOS audit row is
best-effort and the write fails, the attribution is gone and there is no second
copy anywhere.

### 13.2 The vocabulary

New actions go in `AuditAction` (`backend/src/lib/auditLog.ts:157`) beside the
existing privileged vocabulary — `API_KEY_CREATED` (`:177`), `WEBHOOK_CREATED`
(`:179`), `WEBHOOK_SECRET_REGENERATED` (`:182`), `COMPANY_UPDATED` (`:183`).

**The naming hazard Wave E.0 §9.2 identified applies here.** The audit sanitiser
matches on key name, so a key called `xeroRefreshToken` is redacted (matches
`/token/i`, `:20`) and a key called `xeroCredential` is **not** (the pattern is
`/^credential$/i`, anchored, `:25`). This is a load-bearing naming convention
protected only by a comment, and F3 adds new audit keys — the moment it is most
likely to be broken.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| Connect / disconnect / push audited in-transaction | **Mitigate before F3** | build agent | Spec §5.5's audit test, extended: the audit write is `writeAuditLogInTransaction` (`auditLog.ts:127`) and a **forced audit-write failure rolls the push back** — asserted by re-reading the claim and finding no Xero invoice id. |
| Push attribution as the only human-level record | **Accept** — with the reason recorded here so it is not later downgraded to best-effort. | Jay | This sentence, plus the rollback test above. |
| New audit keys must not escape the redaction trap | **Mitigate before F3** | build agent | A grep assertion that every new key added by F3 that could carry a credential contains the substring `token` or `secret`, **plus** a test asserting the stored row is `[REDACTED]` for each. |
| Remote-revocation failure recorded | **Mitigate before F3** — item 5's disconnect. | build agent | Item 5's test (b). |

---

## 14. Item 14 — SSRF and the outbound host

### 14.1 The comparison the spec draws is correct

Webhook delivery has a real SSRF problem because the destination is
user-supplied, and the repo answers it properly:
`backend/src/routes/webhooks/destinationSafety.ts` blocks local hosts (`:6`),
link-local and private ranges (`:13` onwards),
`normalizeWebhookHostnameForSafety` (`:53`), `isDisallowedWebhookIpAddress`
(`:66`), `isDisallowedWebhookHost` (`:81`).

**F3 has no user-supplied destination.** The hosts are three compiled constants:
`https://identity.xero.com` (authorize, token, revocation),
`https://api.xero.com` (connections, accounting, attachments), and
`https://login.xero.com` for the authorization redirect. Spec §3.2 row 8's
control — *"there is no configurable host, and a test should assert the host
constant"* — is the right control.

### 14.2 The one place a URL is assembled from data

The attachment endpoint embeds a **filename** in the path:
`POST|PUT https://api.xero.com/api.xro/2.0/Invoices/{InvoiceID}/Attachments/{Filename}`.
`{InvoiceID}` is a Xero GUID. `{Filename}` is CIVOS-chosen — but if it is ever
derived from user-controlled text (a project name, a claim reference), path
traversal and injection become reachable inside an otherwise fixed host. Xero
rejects `< > : " / \ | ? * \0 +` in filenames with a 400 ([FETCHED] attachments
page), which is a remote control, not a local one.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| Fixed compiled hosts, no configurable destination | **Accept** — spec §3.2 row 8's control is correct. | Jay | A test asserting the three host constants, and a grep assertion that no Xero URL is built from a database value or a request parameter. |
| **Attachment filename in the path** | **Mitigate before F3** | build agent | The filename is a **constant or a slug of the claim number**, never free text. A test with a project named `../../evil` asserting the emitted filename contains no `/`, `\` or `..`. |
| No inbound webhook surface in F3 | **Accept for F3** — see item 18. | Jay | Item 18's exit condition. |

---

## 15. Item 15 — Reconciliation: when CIVOS and Xero disagree

### 15.1 The posture is right and this item ratifies it

Spec §2.6 states: push is create-only and idempotent; once the invoice leaves
`DRAFT`, CIVOS is read-only against it forever; CIVOS never reads a Xero amount
back into `totalClaimedAmount`; divergence is surfaced and CIVOS stops. **All
four are ratified.** The reasoning is sound and matches the §0.3 boundary.

The verbatim divergence sentence — *"This claim's total in CIVOS ($A) no longer
matches the Xero invoice ($B). CIVOS has not changed either. Resolve in Xero, or
raise a new claim."* — is the right shape: it names both numbers, both systems,
and takes no side.

### 15.2 Three things §2.6 does not cover

1. **Xero state must live in dedicated columns, and `disputeNotes` is the trap.**
   §2.6 clause 5 says so, and the reason is recorded in the research doc:
   `ProgressClaim.disputeNotes` (`backend/prisma/schema.prisma:1541`) is an
   overloaded free-text column with multiple writers. A Xero push must not
   become another one. Ratified as a hard rule.
2. **The invariant-failure path has no user remediation.** §2.5 says an invariant
   failure blocks the push and §5.5 tests that it does; neither says what the
   user does next. The path looks near-unreachable — `amountClaimed` is rounded
   per-lot at write (`inclusionDecision.ts:247`) and the total is
   `round(round(Σlots) + round(Σvariations))` (`:281`, `:284`, `:292`), so line
   and claim totals agree by construction — but it is reachable if a stored
   total ever diverges from its member rows. **One sentence in the runbook.**
3. **Partial attachment is a first-class state, not an error.** §2.5's table
   says an invoice-created-but-attach-failed push leaves the invoice and offers
   attach retry, never a re-push. That is correct and it means the claim needs a
   **two-part status** — invoice pushed, attachment pushed — not one boolean.
   A single `pushed` flag makes the retry-attach path unrepresentable.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| Create-only, never update; read-only after `DRAFT`; never read amounts back | **Accept** — ratified as specified. | Jay | Spec §5.5's *"Re-push against a non-DRAFT invoice is refused naming the Xero status"* and the divergence test asserting the §2.6 sentence **verbatim**. |
| Xero state in dedicated columns; `disputeNotes` untouched | **Mitigate before F3** | build agent | A grep assertion that F3's diff contains no write to `disputeNotes`. |
| **Two-part push status (invoice / attachment)** | **Mitigate before F3** | build agent | A test that an invoice-created-but-attach-failed claim offers **attach retry only**, and that a re-push is refused — which requires the two states to be separately representable. |
| Invariant-failure remediation | **Mitigate before F3** — one runbook sentence. | build agent | The runbook section exists and the F3 PR body links it. |

---

## 16. Item 16 — Retention and deletion: the token has no destruction path · **Blocks F3**

### 16.1 There is no company deletion, anywhere

Verified by grep across `backend/src` for `company.delete`, `deleteCompany`,
`prisma.company.delete` and DELETE routes on the company router. **Every
non-test hit is a false positive**: `backend/src/routes/company/logoStorage.ts:268`
deletes a *logo file*; `backend/src/test/setup.ts:103` and two `backend/scripts/`
benchmarks are teardown. The company router mounts at `/api/company`
(`backend/src/server.ts:175`) and its only DELETE handlers are
`backend/src/routes/company/memberRoutes.ts:627` (remove a **member**) and
`backend/src/routes/company/apiKeyInventoryRoutes.ts:70` (revoke a **user's** API
key).

**The tenant lifecycle has no terminal state in code.**

### 16.2 And the cascade that looks like a control cannot fire

`WebhookConfig.company` is `onDelete: Cascade` (`backend/prisma/schema.prisma:196`)
— the exact structural precedent F3 would copy. But `Project.company` is
**`onDelete: Restrict`** (`:400`). **Any company with at least one project can
never be deleted by Prisma**, which is every real tenant. So the cascade is a
control that never runs, and copying it onto `XeroConnection` copies the
appearance of a deletion path rather than a deletion path.

### 16.3 The retention sweep cannot reach it either

`RETENTION_POLICIES` (`backend/src/lib/dataRetention.ts:16-50`) declares ten
entries; only three drive a deletion —
`usedHoldPointReleaseTokens` (`:40`, applied `:66`/`:140`), `processedSyncItems`
(`:46`, applied `:127`) and `productEvents` (`:49`, applied `:148-149`). The
sweep's Prisma client type (`:93-103`) enumerates exactly eight delegates
(`:95-102`) and **deliberately omits `auditLog`**. `:109` states the rule:
*"Project, audit, NCR, lot and test data are never auto-deleted."* The worker
(`backend/src/lib/dataRetentionWorker.ts:20-30`, gate at `:40`) defaults to
production-only (`:29`).

**A new `XeroConnection` model would not be swept unless explicitly added to
that union and to `applyRetentionPolicies`.** Nothing does that by default.

### 16.4 The DSR surface is user-scoped and explicitly refuses to help

`DELETE /api/auth/delete-account`
(`backend/src/routes/auth/accountDeletionRoutes.ts:41-42`, factory `:34`) is a
real, well-built GDPR deletion path — it anonymises ITP attributions, deletes
tokens and memberships, nulls audit-log `userId`, deletes the user (`:175-177`).
**And it blocks the one person who could drain a tenant:**

```
backend/src/routes/auth/accountDeletionRoutes.ts:88-92
  'Company owners must transfer ownership before deleting their account'
```

It never touches `Company`, `WebhookConfig`, or any company-scoped secret.
Deleting the last member of a company leaves the company row and its secrets
behind, unreachable.

Meanwhile `frontend/src/pages/legal/PrivacyPolicyPage.tsx:183-189` tells
customers *"You may request deletion of your account and personal data at any
time through your account settings"* — true at user grain, and the company-grain
gap is not stated.

### 16.5 The consequence for F3, stated plainly

**A customer's Xero refresh token, once stored, has no automated destruction
trigger of any kind.** Not on company offboarding (none exists), not by cascade
(unreachable), not by retention sweep (not enrolled), not by user DSR (wrong
grain, and the owner is blocked from leaving). The only deletion is the
Disconnect button — a **voluntary** action by a customer who is presumably
leaving and has no reason to click it.

The token expires at Xero after 60 days unused, which limits its *usefulness*.
It does not limit its *existence*: the ciphertext, and the `tenantId` and
`tenantName` naming the customer's accounting organisation, persist forever.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **No destruction path for the stored token** | **Block until an operator-reachable deletion exists.** The minimum honest implementation is small: enrol `XeroConnection` in the retention sweep on a "revoked or expired for N days → delete the row" predicate, following the `usedHoldPointReleaseTokens` pattern (`dataRetention.ts:40`, `:66`). This is one policy entry, one delegate in the union at `:95-102`, and one clause in `applyRetentionPolicies`. | build agent | **AT-F3-RETENTION:** a `XeroConnection` with `status='revoked'` older than the retention window is deleted by `applyRetentionPolicies`; one inside the window is not. Asserted against the database. |
| **Disconnect must revoke at Xero before deleting locally** | **Mitigate before F3** — item 5. One control discharges both rows; without it, a "deletion" leaves a live credential at Xero that CIVOS can no longer revoke. | build agent | Item 5's ordered-call test. |
| **Copying `WebhookConfig`'s cascade as if it were a deletion path** | **Mitigate before F3 — by not doing it.** The migration may set `onDelete: Cascade` for correctness, but the F3 PR body must state that it is unreachable while `Project.company` is `Restrict` (`schema.prisma:400`) and name the retention sweep as the actual control. | build agent | The sentence in the PR body, plus the AT above. |
| **No company-grain offboarding anywhere in the product** | **PROPOSED-ACCEPT as a recorded pre-existing condition, NOT as "documented".** F3 does not create it and cannot fix it. But F3 is the **first** feature to put a live third-party credential inside that gap, which changes what the gap costs. | Jay | This sentence, in the F3 PR body, in Jay's name. **Mitigate before any company-grain privacy or offboarding commitment CIVOS makes to a customer** — named here so it is not rediscovered. |
| The privacy policy's deletion sentence (`PrivacyPolicyPage.tsx:183-189`) | **Mitigate before F3** — it becomes materially incomplete once a third-party credential is held at company grain. | build agent | The sentence is amended in the same PR as item 17's subprocessor update, or the F3 PR body states why it need not be. |

---

## 17. Item 17 — Subprocessor disclosure, and the register's own accuracy invariant

### 17.1 Two files, not one

Spec §3.2 row 7 says *"Xero is added to the subprocessor register (Wave 0,
program §3)"*. The register is `docs/ops/customer-operations-pack.md:259-279`,
and it carries a self-check that updating one file alone would falsify:

> `docs/ops/customer-operations-pack.md:261-262` — *"Cross-checked against
> `frontend/src/pages/legal/PrivacyPolicyPage.tsx` (§Third-Party Service
> Providers, updated 2026-07-24). All nine appear there."*
>
> `:276-278` — *"Register accuracy note: the code's disclosed list and this pack
> match exactly — no undisclosed subprocessor was found in the code, and no
> listed subprocessor is unused."*

The nine current entries (`:264-274`): Railway, Vercel, Supabase, Resend,
Anthropic, Google, MapTiler, Formspree, Sentry. The code-side list is
`frontend/src/pages/legal/PrivacyPolicyPage.tsx:161-174` — nine items, matching
exactly.

**Adding Xero to only the ops doc breaks the invariant the ops doc asserts about
itself.** The privacy policy is also the legally operative disclosure. **Both
files, same PR.**

### 17.2 The framing question the register has no category for

Xero is not straightforwardly a CIVOS subprocessor. The customer owns the Xero
relationship, chooses the destination organisation, and authorises the
connection themselves. That is closer to a **customer-directed disclosure** than
to CIVOS engaging a processor on the customer's behalf — the shape is more like
"the customer told us to send this there" than "we chose a vendor".

The register has no category for that today, and the difference is not cosmetic:
a subprocessor entry implies CIVOS selected the recipient and owes diligence on
it; a customer-directed disclosure implies the customer did.

**This artifact does not decide it.** It is a characterisation question with
legal content, it is filed for Jay, and §24 carries it. **What this artifact does
rule is that Xero appears in both files before the first production push**,
under whichever heading — the customer must be able to see that their data can
go there, and the heading is a refinement.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **Xero disclosed in both files before the first production push** | **Mitigate before F3** | build agent | Both `docs/ops/customer-operations-pack.md:264-274` and `frontend/src/pages/legal/PrivacyPolicyPage.tsx:161-174` name Xero, the pack's count sentence at `:261-262` is updated from "nine", and the accuracy note at `:276-278` still reads true. |
| **Subprocessor vs customer-directed-disclosure framing** | **PROPOSED-ACCEPT the subprocessor framing as the safe default** — it over-discloses rather than under-discloses, and over-disclosure is the recoverable error. Jay may re-file it under a new category with counsel. | **Jay** | Jay's sentence. **No legal conclusion in any CIVOS document.** |
| Retention of the pushed data inside Xero | **Accept** — it is the customer's Xero org and their retention policy. **Say so at connect**, per spec §3.2 row 7. | Jay | The connect-time disclosure states that data pushed to Xero is governed by the customer's Xero retention, not CIVOS's, and that CIVOS cannot delete it. A frontend test asserts the sentence. |

---

## 18. Item 18 — The inbound surface: one callback, and no webhooks

### 18.1 The callback is the only new inbound route

F3 adds exactly one unauthenticated-by-Xero inbound path: the OAuth callback.
Its controls are item 2's (state verification, server-side company binding). Two
properties it must have, both mirroring Wave E.0 item 6.2's GET-purity ruling:

1. **Exact-match redirect-URI allowlist**, no wildcards, no user-supplied
   redirect. Spec §3.2 row 4 requires it and it is correct. Note Xero's own
   constraint: PKCE redirect URIs must be https except localhost — CIVOS is not
   using PKCE (item 2), but https-only is the right posture regardless.
2. **The callback must be idempotent and single-use.** `verifyOAuthState`
   deletes the state row before returning (`stateStore.ts:42`), so a replayed
   callback fails closed already. F3 must not weaken that by verifying before
   deleting.

### 18.2 Webhooks — the surface exists at Xero and F3 does not build it

Spec §2.3 defers Xero webhooks and §5 F3 excludes them. **Confirmed and
ratified.** For the record, so the next agent does not re-research it:

[FETCHED] https://developer.xero.com/documentation/webhooks/overview:

- Event categories: **Contact**, **Invoice**, **Credit Note**, **Subscription**
  (CREATE/UPDATE). **There is no Payment webhook category** — payments surface
  only indirectly via Invoice UPDATE. This matters for **D3/F4**: payment
  sync-back cannot be webhook-driven and genuinely needs the durable poller
  spec §5 F4 describes.
- Subscriptions are **per-app**, and *"we will send you events for every Xero
  organisation connected to the app"* — **one endpoint receives every tenant's
  events**, so the handler must authorise by tenant itself. Combined with item
  6, that is a substantial new trust boundary.
- Signature: header **`x-xero-signature`**, payload hashed with **HMAC-SHA256**
  using the webhook signing key, base64-encoded.
- The endpoint **must return 401 for an invalid signature** — Xero's "intent to
  receive" validation deliberately sends bad signatures and fails the
  subscription if you do not 401.
- Must respond within **5 seconds** with 2xx, no cookies in response headers.
- Failures retry every 15 minutes for 24 hours, then the subscription is
  **disabled**; events are stored up to **31 days and replayed in order**, so
  any consumer must be idempotent and replay-safe.

**None of this exists in CIVOS and none of it is built by F3.**

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| Exact-match redirect-URI allowlist | **Mitigate before F3** | build agent | A test that a callback whose redirect target is not the compiled constant is refused; a grep assertion that no wildcard appears in the allowlist. |
| Callback single-use / replay-closed | **Accept** — `stateStore.ts:42` already deletes before returning. | Jay | A test that a replayed callback (same state, second time) creates no connection. |
| **Xero webhooks: the surface does not exist in CIVOS and F3 must not create it** | **Block the successor increment until it returns here.** Any webhook work reopens this threat model: a per-app endpoint receiving every tenant's events is a new cross-tenant trust boundary that no row in this document covers. | successor increment's build agent | A mechanical check in every F3 PR body: the diff adds **no** inbound Xero route other than the single OAuth callback, and no `x-xero-signature` handling. |
| No Payment webhook category exists at Xero | **Accept as an external fact** — recorded so D3/F4 is not scoped around a webhook that does not exist. | build agent | This sentence. |

---

## 19. Item 19 — Do F1 and F2 need this gate? Testing the spec's own claim

Spec §3.1 asserts F1 and F2 do not need a threat model, and then does the honest
thing: *"This scoping is itself a claim the reviewer should test; if F1's
aggregate is judged to widen a trust boundary, the threat model gates F1 too."*
Tested here.

### 19.1 F1 — the blocked-value aggregate

**Ruling: it does not widen a trust boundary, and it is not gated by this
artifact.** Three reasons, each verified:

1. **No new data class.** F1 reads lot budget amounts and readiness reason codes
   — both already exposed to the same audience on the same page, inside
   `CreateClaimModal`.
2. **No new gate.** The existing endpoint sits behind
   `requireCommercialProjectAccess` (`backend/src/routes/claims/readRoutes.ts:330`),
   which hard-denies subcontractor roles before any project lookup
   (`backend/src/routes/claims.ts:42-44`). F1 reuses it.
3. **No egress.** F1 is a read view rendered in CIVOS. Nothing leaves.

**One caution, because following the spec's own advice would break it.** Spec §5
F1 flags *"the trap: `readRoutes.ts:250` hardcodes `canViewCommercial: true`…
the aggregate must set it from the effective role, not inherit the hardcode."*
Verified: `readRoutes.ts:250` is `canViewCommercial: true`. But that route sits
**behind** `requireCommercialProjectAccess` at `:330`, so **everyone reaching it
is commercial and `true` is correct**. Deriving it from a role risks the opposite
failure: a role-derived `false` would silently drop budget values and produce an
**under-counted blocked-value total with no error** — a wrong number on the one
surface §1.4 exists to hedge. **Keep the hardcode behind the gate, with a comment
saying why.**

### 19.2 F2 — per-company account code and tax type

**Ruling: it does not widen a trust boundary and is not gated.** It moves two
non-secret accounting configuration values from `localStorage`
(`frontend/src/pages/claims/ClaimsPage.tsx:527`) to a company-scoped row behind
`requireCompanyAdmin` (`backend/src/routes/company/access.ts:6-17`). That is a
**narrowing**: a per-browser value readable by any script on the origin becomes
a server-side value writable only by a company admin.

**Two things F2 should carry from this document**, neither a gate:

1. **Item 10's invoice-number fix belongs in F2**, not F3 — it is the same
   mapper, and it fixes the CSV too.
2. **Item 7's row 7d applies to the CSV path today.** F2's exit gate is
   *"byte-identical CSV to today"*, which **locks in** the unexamined SOPA due
   date. If Jay's D8 ruling changes the due-date behaviour, F2's characterization
   test must be written to the new behaviour, not frozen against the old.

### Disposition

| Sub-item | Disposition | Owner | Testable exit condition |
|---|---|---|---|
| **F1 is not gated by this threat model** | **Accept** — ruled in §19.1. | Jay | The F1 PR body carries this ruling by reference. F1's diff adds no new route gate and no egress — reviewer-checkable. |
| **F2 is not gated by this threat model** | **Accept** — ruled in §19.2. | Jay | The F2 PR body carries this ruling by reference. |
| The `canViewCommercial` hardcode | **Mitigate before F1 — by NOT changing it.** Keep `readRoutes.ts:250` as `true` behind the `:330` gate, with a comment naming the gate. | build agent | A test that a non-commercial role gets 403 from the aggregate (proving the gate), **and** that the aggregate's budget total for a commercial user is non-zero on a project with budgets (proving nothing was dropped). |
| **D8 sequencing against F2's byte-identical gate** | **Mitigate before F2** | build agent | F2's PR body states whether D8 has been decided. If it has not, F2's characterization test is written so a later due-date change is a **deliberate** test update, not a surprise failure. |

---

## 20. Item 20 — Blast radius, one row per increment

The worst outcome per increment, and whether it is accepted.

| Increment | Worst outcome | Accepted? |
|---|---|---|
| **Today (baseline)** | A commercial user downloads a CSV containing lot descriptions, variation titles, a client name and a CIVOS-computed SOPA due date, and imports it into a Xero org by hand. A second human with Xero credentials sees a preview before it lands. **No credential is stored anywhere.** | Accepted as shipped. Row 7d (the SOPA date) is a **pre-existing** condition, not created by F3 — but F3 promotes it, so it is D8. |
| **F.0** | None. Docs only. | Accept. |
| **F.0a** | Strictly reduces the baseline: staff email addresses stop appearing in the claim evidence payload and PDF (§21). New risk is a regression in the authed display, which is why the `fullName` case's test must stay green **unchanged**. | Accept. |
| **F1** | An over-counted or under-counted blocked-value figure on `ClaimsPage`, seen by commercial roles only, labelled *"Project-management indicator — not an accounting balance or entitlement."* No egress, no credential, no new gate. | Accept — bounded by §1.4's label tests and §19.1's `canViewCommercial` ruling. |
| **F2** | A wrong account code or tax type on an exported CSV — which is **the bug F2 fixes**, currently possible per-browser. Company-admin-only write. | Accept. |
| **F3** | **The step change.** A leaked or misused connection means: draft invoices written into a customer's accounting system, potentially into **any Xero organisation the connecting user has ever connected** (item 6); an evidence document containing staff names — and, until `F.0a`, staff email addresses — attached irreversibly to those invoices (item 8); a refresh token that has **no destruction path** (item 16) and, if it ever reached the database in cleartext, **decrypts successfully forever** while every monitor stays green (item 3). | **Accept only with items 2, 3, 6, 8, 10, 12, 16 discharged.** Every one of those is a `Block until`. |
| **F4 — payment sync-back (D3, deferred)** | Writes payment state back into CIVOS from a third party, through a durable poller that does not exist, with no Payment webhook available (item 18) and `disputeNotes` waiting to become a fourth writer. | **Block** — not dispositioned here beyond naming its preconditions: F3 shipped and stable, a durable worker, and its own threat model pass. |

### Disposition

- **Disposition: Accept**, per row, with each row's `Block until` dependencies
  named.
- **Owner:** Jay.
- **Exit condition (testable):** every Wave F PR body carries its own
  increment's row. F3's body additionally carries the outcome of Jay's one real
  push (spec §5 F3 exit gate) — the push id, the org name, and confirmation that
  the attachment landed — measured, not asserted.

---

## 21. `F.0a` — the prerequisite remediation PR

Wave E.0 §17's precedent: a named PR slot that may not be silently skipped, and
which is closed with a sentence if it turns out empty.

**`F.0a` is NOT empty.** One current disclosure defect is dispositioned
`Mitigate before F3` in item 8. Its scope is exactly this, and nothing else:

| # | Change | Files | Test change |
|---|---|---|---|
| 1 | The claim evidence payload's `fullName \|\| email` fallback drops its **email** arm. A user with no `fullName` gets a non-identifying label, never their email address. | `backend/src/routes/claims/evidenceRoutes.ts:317-320` (`completedBy`), `:325-328` (`verifiedBy`), `:376-379` (test `verifiedBy`) | A **new** case with `fullName: null` asserting the response body contains no `@`. The existing `fullName` case stays green **unchanged**. This is the first negative assertion on the claim evidence payload. |
| 2 | The PDF is starved automatically — it reads the `name` field the backend supplies (`frontend/src/lib/pdf/claimEvidencePackagePdf.ts:444-454`), so no frontend change is required. | none | An assertion that no `@` appears in the rendered `Completed by` / `Verified by` rows for a `fullName: null` fixture. |

**Explicitly NOT in `F.0a`:**

- Staff **names** — legitimate and load-bearing. The evidence package's job is to
  show who did the work. Wave E.0 item 4g ruled the identical question and
  `Accept`ed it; the same ruling applies.
- Lab names, test result metadata, document names and ids — provenance, not
  contact details. Wave E.0 item 4h's reasoning applies unchanged.
- Anything about the **attachment mechanism** — that is item 8's `Block until`
  and it is a design decision, not a remediation.
- The SOPA due date — that is **D8**, a Jay decision, not a defect fix.

**Blocking relationship:** `F.0a` blocks **F3's attachment**, not F1, not F2, and
not F3's non-attachment work. If item 8's `Block until` resolves to "no
attachment in the first slice", `F.0a` still lands — the email addresses are on
the claim evidence PDF a customer already downloads and forwards.

**A second remediation is named and is NOT `F.0a`:** item 12's Sentry breadcrumb
scrubber. It belongs **inside F3's first PR** (it is the control §3.2 row 1
already claims), not in a separate slot. It is listed in §22 so it cannot be
lost.

---

## 22. The F.0 verdict table

Every row, its disposition, owner and testable exit condition.

| # | Item | Disposition | Owner | Testable exit condition |
|---|---|---|---|---|
| 1a | New renewable third-party write credential as an asset class | **PROPOSED-ACCEPT** | Jay | Jay's sentence in the F3 PR body |
| 1b | `WebhookConfig` encryption precedent (not its lifecycle) | **Accept encryption; reject lifecycle** | build agent | Token written via `encrypt()`; item 16's retention row satisfied |
| 2a | **Connect-time company binding** | **Block until server-side binding is designed** | build agent | Attacker-supplied `companyId` query param creates no connection |
| 2b | 32-byte sha256 state, 10-min TTL, single-use | **PROPOSED-ACCEPT** | Jay | Replayed state fails; `stateStore.ts` otherwise unchanged |
| 2c | PKCE listed as a control | **Mitigate before F3 — by deletion** | build agent | §3.2 row 4 in Rev 2 names the standard flow, not PKCE |
| 3a | AES-256-GCM via shipped `encrypt()`/`decrypt()` | **PROPOSED-ACCEPT** | Jay | Grep: no raw token write |
| 3b | **Plaintext-on-read passthrough (`encryption.ts:84-87`)** | **Block until `isEncrypted()` is asserted on read** | build agent | **AT-F3-PLAINTEXT-READ**, failing if the guard is removed |
| 3c | Connect-time `ENCRYPTION_KEY` assert (staging control) | **Mitigate before F3** | build agent | Connect refused with key unset |
| 3d | No key-rotation story → re-consent | **PROPOSED-ACCEPT** | Jay | Decrypt failure → `status='expired'`, never a crash |
| 3e | Spec §2.5 c1 / §3.2 row 2 cite the wrong lines | **Mitigate before F3 — by correction** | build agent | Rev 2 cites `runtimeConfig.ts:446`, `:460-461` |
| 4a | 30-min / 60-day / rotate-every-refresh | **Accept** (external fact) | build agent | Stored refresh token changes after a refresh, read back from DB |
| 4b | **Rotation-persist ordering** | **Mitigate before F3** | build agent | Fault-injection: DB write throws after rotation → `status='expired'`, no push |
| 4c | 30-min grace as a monitoring requirement | **Mitigate before F3** | build agent | Rotation-failure alert live at deploy, destination named |
| 4d | Attachment call timeout | **Mitigate before F3** | build agent | Explicit `timeoutMs` + the measured p95 size it came from |
| 5a | **Disconnect-then-revoke ordering** | **Mitigate before F3** | build agent | Call-order test; failure still deletes locally and audits the remote failure |
| 5b | Xero-initiated revocation → stop calling | **Mitigate before F3** | build agent | No outbound call attempted after the flip |
| 5c | 60-day expiry cliff alert | **Mitigate before F3** | build agent | Threshold below 60 days, stated as a number |
| 6a | **Tenant selection must be explicit and recorded** | **Block until the design names it** | build agent | **AT-F3-TENANT-CHOICE** + **AT-F3-TENANT-HEADER** |
| 6b | Stale tenant detection before push | **Mitigate before F3** | build agent | Missing `connectionId` → refused before any invoice call |
| 6c | Scope accumulation across re-authorisations | **PROPOSED-ACCEPT** | Jay | Frozen four-scope constant, pinned by a test |
| 7a | `*ContactName` | **PROPOSED-ACCEPT** | Jay | Frozen-payload test |
| 7b | `*InvoiceNumber` | **Mitigate before F3** (uniqueness → row 10b) | build agent | Row 10b's test |
| 7c | `*InvoiceDate` | **PROPOSED-ACCEPT** | Jay | Frozen-payload test |
| 7d | **`*DueDate` — the CIVOS-computed SOPA date** | **Block until D8** | **Jay** | A dated decision in the PR body + a test pinning the chosen behaviour |
| 7e | Lot lines | **PROPOSED-ACCEPT** | Jay | Frozen-payload test |
| 7f | **Variation lines — undisclosed, and omitting them makes claims unpushable** | **Mitigate before F3** | build agent | Frozen-payload test uses a claim **with a variation** |
| 7g | Evidence-pack attachment | **Block** — item 8 | build agent | Item 8's rows |
| 7h | Account code, tax type | **Accept** | Jay | This sentence |
| 7i | Connect-time disclosure of the full inventory | **Mitigate before F3** | build agent | Frontend test; removing a row fails it |
| 7j | Frozen-payload test written against the **pure mapper** | **Mitigate before F3** | build agent | Adding any field to `buildXeroInvoiceExport` fails the test |
| 8a | **The attachment source does not exist** | **Block until Rev 2 picks path A or B** | **Jay** / build agent | A named section in Rev 2 scoping the chosen path |
| 8b | If path A: client-supplied-file boundary | **Block until §3.3's waiver is withdrawn** | build agent | Non-PDF and oversized file refused before any Xero call |
| 8c | **`fullName \|\| email` prints staff emails into the PDF** | **Mitigate before F3 → `F.0a`** | build agent | `fullName: null` payload contains no `@` |
| 8d | §2.4's description of the attachment contents | **Mitigate before F3 — by correction** | build agent | Disclosure describes a manifest + counts, not photographs |
| 8e | Attachment egress is irreversible | **Mitigate before F3** | build agent | Opt-out UI states prospective-only; frontend test |
| 9a | Connect/disconnect = company admin only | **Mitigate before F3** | build agent | `project_manager` cannot connect |
| 9b | **Push = commercial gate, trading away the second-person import step** | **PROPOSED-ACCEPT on the corrected reasoning** | **Jay** | Jay's sentence naming what is traded away |
| 9c | Subcontractor roles denied everywhere | **Accept** | Jay | Permission-matrix test |
| 9d | **Per-company push rate ceiling** | **Mitigate before F3** | build agent | (N+1)th push refused before any Xero call, and audited |
| 9e | Per-project push allowlist deferred | **PROPOSED-ACCEPT** | Jay | This sentence |
| 10a | **Six-minute idempotency window** | **Block until query-by-reference fallback is built** | build agent | **AT-F3-STALE-KEY**: post-expiry retry links, never creates |
| 10b | **Invoice number not unique (D6)** | **Mitigate before F3** (landable in F2) | build agent | Two same-named projects produce different invoice numbers |
| 10c | Key derived from `claimId` | **PROPOSED-ACCEPT** | Jay | Derivation pinned, ≤128 chars |
| 10d | Cached errors inside the window | **Mitigate before F3** | build agent | Cached error surfaces as a Xero-side failure, never a silent success |
| 10e | Idempotency evaluated after rate limiting | **Accept** (external) | build agent | This sentence |
| 11a | Read limits from headers, hard-code nothing | **Accept** | build agent | Grep: no numeric limit literals in the Xero client |
| 11b | 429 handling honours `Retry-After` | **Mitigate before F3** | build agent | Client waits rather than hot-retrying |
| 11c | **App-wide 10,000/min ceiling as cross-tenant noisy neighbour** | **Mitigate before F3** | build agent | 429 without `Retry-After` handled; `X-AppMinLimit-Remaining` monitored |
| 11d | Per-company push ceiling | **Mitigate before F3** | build agent | Row 9d's test discharges both |
| 11e | 1,000-vs-5,000 daily disagreement | **Accept as external ambiguity** | build agent | Header-reading test |
| 12a | `logSanitization` + `serverLogger` | **Accept** | Jay | Simulated token payload logs `[REDACTED]` |
| 12b | Audit redaction (`auditLog.ts:18-40`, `:90`, `:142`) | **Accept** | Jay | Assert on the **stored row**, not the argument |
| 12c | Audit sanitiser matches keys, not values | **Mitigate before F3** | build agent | Xero error text is not persisted verbatim |
| 12d | **No `beforeBreadcrumb`; `scrubSentryEvent` skips `event.breadcrumbs`** | **Block until a breadcrumb scrubber exists** | build agent | **AT-F3-SENTRY-BREADCRUMB**, failing if the hook is removed |
| 12e | Frontend Sentry has no `beforeSend` | **Mitigate before F3** | build agent | Breadcrumb URL query strings stripped; test |
| 12f | `XERO_CLIENT_SECRET` env-only + production assert | **Mitigate before F3** | build agent | Boot fails without it; grep that no `Basic ` header value is logged |
| 13a | Connect/disconnect/push audited **in transaction** | **Mitigate before F3** | build agent | Forced audit-write failure rolls the push back |
| 13b | Push attribution exists only in the CIVOS audit log | **Accept** | Jay | This sentence + 13a's rollback test |
| 13c | New audit keys must not escape the trap | **Mitigate before F3** | build agent | Grep + stored-row assertion per key |
| 14a | Fixed compiled hosts | **Accept** | Jay | Host-constant test; grep for no data-derived URL |
| 14b | **Attachment filename in the path** | **Mitigate before F3** | build agent | Project named `../../evil` → filename has no `/`, `\`, `..` |
| 15a | Create-only; read-only after DRAFT; never read amounts back | **Accept** | Jay | Non-DRAFT re-push refused; divergence sentence **verbatim** |
| 15b | `disputeNotes` untouched | **Mitigate before F3** | build agent | Grep over F3's diff |
| 15c | **Two-part push status (invoice / attachment)** | **Mitigate before F3** | build agent | Attach-failed claim offers attach retry only; re-push refused |
| 15d | Invariant-failure remediation | **Mitigate before F3** | build agent | Runbook sentence, linked from the PR body |
| 16a | **No destruction path for the stored token** | **Block until an operator-reachable deletion exists** | build agent | **AT-F3-RETENTION** |
| 16b | Disconnect must revoke before forgetting | **Mitigate before F3** | build agent | Row 5a's test discharges both |
| 16c | The cascade is unreachable and must not be mistaken for a control | **Mitigate before F3** | build agent | PR-body sentence + AT-F3-RETENTION |
| 16d | **No company-grain offboarding anywhere** | **PROPOSED-ACCEPT as a recorded pre-existing condition** | **Jay** | Jay's sentence. Mitigate before any company-grain privacy commitment |
| 16e | Privacy policy's deletion sentence | **Mitigate before F3** | build agent | Amended with row 17a, or the PR body says why not |
| 17a | **Xero disclosed in BOTH the pack and the privacy policy** | **Mitigate before F3** | build agent | Both files updated; the accuracy note at `:276-278` still reads true |
| 17b | Subprocessor vs customer-directed-disclosure framing | **PROPOSED-ACCEPT the subprocessor default** | **Jay** | Jay's sentence. No legal conclusion in any CIVOS document |
| 17c | Retention inside Xero is the customer's | **Accept** | Jay | Connect-time disclosure states it; frontend test |
| 18a | Exact-match redirect-URI allowlist | **Mitigate before F3** | build agent | Non-constant redirect refused; grep for no wildcard |
| 18b | Callback single-use / replay-closed | **Accept** | Jay | Replayed callback creates no connection |
| 18c | **Xero webhooks do not exist in CIVOS and F3 must not create them** | **Block the successor increment until it returns here** | successor build agent | Mechanical check: no inbound Xero route but the callback; no `x-xero-signature` |
| 18d | No Payment webhook category at Xero | **Accept** (external) | build agent | This sentence — D3/F4 needs a poller |
| 19a | **F1 is not gated by this threat model** | **Accept** | Jay | F1 PR body carries the ruling; no new gate, no egress |
| 19b | **F2 is not gated by this threat model** | **Accept** | Jay | F2 PR body carries the ruling |
| 19c | The `canViewCommercial` hardcode — do NOT change it | **Mitigate before F1 — by not changing it** | build agent | 403 for non-commercial; non-zero budget total for commercial |
| 19d | D8 sequencing against F2's byte-identical gate | **Mitigate before F2** | build agent | F2 PR body states D8's status |
| 20 | Blast radius per increment | **Accept** (per row, with named dependencies) | Jay | Each PR body carries its own row; F3's carries the real-push evidence |

### Counts

**82 dispositioned rows across the 20 items.**

| Disposition | Count | Rows |
|---|---|---|
| **Accept** | 17 | 4a, 7h, 9c, 10e, 11a, 11e, 12a, 12b, 13b, 14a, 15a, 17c, 18b, 18d, 19a, 19b, 20 |
| **Accept, split (encryption yes / lifecycle no)** | 1 | 1b |
| **PROPOSED-ACCEPT — needs Jay** | 13 | 1a, 2b, 3a, 3d, 6c, 7a, 7c, 7e, 9b, 9e, 10c, 16d, 17b |
| **Mitigate before F3** | 38 | 2c, 3c, 3e, 4b, 4c, 4d, 5a, 5b, 5c, 6b, 7b, 7f, 7i, 7j, 8c, 8d, 8e, 9a, 9d, 10b, 10d, 11b, 11c, 11d, 12c, 12e, 12f, 13a, 13c, 14b, 15b, 15c, 15d, 16b, 16c, 16e, 17a, 18a |
| **Mitigate before F1 / F2** | 2 | 19c (F1), 19d (F2) |
| **Block until** | 10 | **2a**, **3b**, **6a**, **7d**, **7g** (pointer to 8a/8b), **8a**, **8b**, **10a**, **12d**, **16a** |
| **Block the successor increment** | 1 | 18c |

Of the 38 `Mitigate before F3` rows, **one is `F.0a`** (8c — §21) and the rest
land inside F3's own PRs. Row 7g is a pointer into item 8 rather than an
independent cause, so the **nine distinct blocking causes for F3** are 2a, 3b,
6a, 7d, 8a, 8b, 10a, 12d and 16a.

**Blocking summary:**

- **F1 is buildable now.** Nothing in this artifact gates it. Row 19c is a
  do-not-change instruction inside F1's own PR.
- **F2 is buildable now.** Rows 10b and 19d belong inside F2's PR.
- **F3 is NOT buildable.** Nine `Block until` rows gate it: **2a** (connect-time
  binding), **3b** (plaintext-on-read), **6a** (tenant selection), **7d**
  (D8 — Jay), **8a** and **8b** (the attachment does not exist), **10a** (the
  six-minute window), **12d** (Sentry breadcrumbs), **16a** (no destruction
  path). Four of the nine — 2a, 6a, 8a, 10a — require a **spec Rev 2 design
  section** before any code, not just a test.
- **F4 / webhooks are BLOCKED** on row 18c and must return to this artifact.

---

## 23. NOT FOUND — stated so nobody re-searches

Verified absent at `4bce1fda`, each by grep or by reading the file:

- **Any Xero code, dependency, model or env var.** No `xero` in
  `backend/package.json`; no `XERO_*` in `backend/.env.example`; zero hits for
  `xero|refresh_token|refreshToken|accessToken` in
  `backend/prisma/schema.prisma`.
- **Any PKCE support.** `code_verifier|code_challenge|pkce|PKCE` across
  `backend/src` → zero hits.
- **Any actor binding on the OAuth state store.** `OauthState`
  (`schema.prisma:262-272`) carries `stateHash`, `redirectUri`, `expiresAt` —
  no `userId`, no `companyId`. `verifyOAuthState` (`stateStore.ts:24-48`)
  returns `{ valid, redirectUri }` only.
- **Any writer or reader of `ProgressClaim.evidencePackageUrl`** in
  `backend/src`. The column (`schema.prisma:1538`) is dead; every grep hit is
  `HoldPoint.evidencePackageUrl` (`:791`).
- **Any server-side claim evidence PDF renderer.** The only generator is
  `frontend/src/lib/pdf/claimEvidencePackagePdf.ts:41`, ending in a browser
  download at `:930`.
- **Any embedded photograph in the claim evidence PDF.** `:750-778` renders an
  `EVIDENCE MANIFEST` of names and ids; `:189` and `:630` render **counts**.
- **Any `beforeBreadcrumb` anywhere in the repo** — zero hits across
  `backend/src` and `frontend/src`. `scrubSentryEvent`
  (`backend/src/lib/sentry.ts:35-67`) has no breadcrumb branch.
- **Any `beforeSend` on the frontend** — `frontend/src/lib/sentry.ts:13-20` has
  `sendDefaultPii: false` and nothing else.
- **Any `integrations` override in either `Sentry.init`** — so the default
  integration set, including HTTP auto-instrumentation, is active.
- **Any company-deletion or tenant-offboarding path.** No `company.delete`,
  `deleteCompany`, or DELETE route on the company router
  (`backend/src/server.ts:175`). The only company DELETEs are member removal
  (`memberRoutes.ts:627`) and API-key revocation
  (`apiKeyInventoryRoutes.ts:70`).
- **Any company-grain DSR or data-export surface.** `DELETE /api/auth/delete-account`
  (`accountDeletionRoutes.ts:41-42`) is **user**-scoped and blocks company owners
  at `:88-92`.
- **Any retention policy that would sweep a company-scoped credential.**
  `RETENTION_POLICIES` (`dataRetention.ts:16-50`) has ten entries; three drive a
  deletion; the sweep's client type (`:93-103`) enumerates eight delegates
  (`:95-102`) and a Xero model is not among them.
- **Any uniqueness constraint on `Project.name`** (`schema.prisma:371`). The
  model's only unique key is `@@unique([companyId, projectNumber])` (`:434`).
- **Any existing stored third-party OAuth credential.** The only reversible
  secrets in the schema are `WebhookConfig.secret` (`:189`) and
  `User.twoFactorSecret` (`:51`).
- **Any outbound OAuth2 client that stores a token.** `oauth.ts` exchanges a
  code (`:263`), reads userinfo (`:288`) and keeps nothing.

---

## 24. For Jay — what needs you, and nothing else does

**Thirteen rows in §22 are `PROPOSED-ACCEPT`.** Each needs one sentence from you
in a PR body — the reasoning is already written in the item, and none of them is
a research question. They are rows **1a, 2b, 3a, 3d, 6c, 7a, 7c, 7e, 9b, 9e,
10c, 16d, 17b**.

**Three of those thirteen are not routine and you should read the item before
signing:**

- **Row 9b — push authority.** D7's argument was *"it is not a new capability,
  only a lower-friction one."* §9.2 shows that is half wrong: what F3 removes is
  the **second-person control** — today someone with Xero credentials opens
  Xero, sees a preview, and confirms. After F3 nobody does. Accept it knowing
  that is the trade.
- **Row 16d — no company offboarding exists.** F3 is the first feature to put a
  live third-party credential into that gap. You are not accepting a bug you
  created; you are accepting that the gap now costs more.
- **Row 17b — how Xero is characterised in the register.** §17.2 recommends the
  subprocessor framing because over-disclosure is the recoverable error. If you
  want the customer-directed-disclosure framing, that is a conversation with
  counsel, not with an agent.

**Two things need you to actually decide something:**

1. **D8 — the SOPA `*DueDate` (row 7d). This blocks F3's payload work.** CIVOS
   already writes a CIVOS-computed statutory payment date into a customer's
   accounting system, via the shipped CSV
   (`frontend/src/pages/claims/ClaimsPage.tsx:532` →
   `backend/src/routes/claims/xeroExport.ts:148`). Your own §0.3 boundary
   excludes *"SOPA validity"* from CIVOS's outputs, unparking **"Never"**. F3
   turns a value a human reviews on an import screen into a direct API write.
   **Two options:** accept it with stated reasoning, or fall back to
   `invoiceDate + 30` (`xeroExport.ts:74`) for the API path. **A decision either
   way unblocks the row; silence does not.**
2. **D4 — the evidence-pack attachment (row 8a). This may reshape the wave.**
   The PDF D4 calls *"the reason to build F3 at all"* **does not exist
   server-side** — it is generated in the browser and never saved (§8.2). The
   two ways to build it are (A) the browser uploads it, which creates a
   client-supplied-file boundary the spec explicitly says F3 does not add, or
   (B) build a server-side renderer, which is unscoped work in a
   do-not-refactor area. **If neither is acceptable this wave, D4 has to be
   re-decided — and by D4's own reasoning an F3 without the attachment is "a
   worse CSV with an OAuth liability."**

**Three things you should know that are not decisions:**

- **F3 is not buildable today.** Nine rows block it (§22). Four of them — 2a,
  6a, 8a, 10a — need a **spec Rev 2 design section**, not just a test, so the
  Rev 2 agent's work is on F3's critical path.
- **F1 and F2 are buildable now.** This artifact does not gate either, and §19
  records why. F2 should also carry the invoice-number fix (row 10b).
- **Two spec citations are materially wrong** (§0.3): `oauth.ts:384` is inbound
  Google ID-token validation, not outbound-client precedent, and
  `runtimeConfig.ts:486-487` is the Resend assertion, not the encryption one.
  The second correction is good news — it means the production plaintext-storage
  scenario §3.2 row 2 fears is **already impossible** (`runtimeConfig.ts:446`,
  `:460-461`). The staging risk stands.

---

## 25. Verification notes

Every `file:line` above was opened in this worktree at
`4bce1fda4073d6163847452741730ea3302b8a9d`. The claims most likely to be
doubted, and how each was established:

1. **`ProgressClaim.evidencePackageUrl` is dead.** Grepped `evidencePackageUrl`
   across `backend/src`, then classified every hit. All are `HoldPoint`
   (`schema.prisma:791`) or hold-point email fields. The one ambiguous hit,
   `backend/src/routes/folio/assemble.ts:185`, was read in context: `:178-184`
   selects `pointType`, `status`, `releasedAt`, `releasedByName`,
   `releasedByOrg`, `releaseMethod`, `releaseSignatureUrl` — a HoldPoint select.
2. **The claim evidence PDF is browser-generated and never persisted.** Read
   `frontend/src/pages/claims/ClaimsPage.tsx:573-579` (fetch JSON, dynamic
   import, generate) and `frontend/src/lib/pdf/claimEvidencePackagePdf.ts:41`
   (entry) and `:930` (`savePdf`). Then grepped `backend/src` for any claim PDF
   renderer — none.
3. **The PDF prints emails when `fullName` is null.** Read the backend payload
   at `backend/src/routes/claims/evidenceRoutes.ts:317-320`
   (`name: c.completedBy.fullName || c.completedBy.email`), `:325-328`,
   `:376-379`; then the render at `claimEvidencePackagePdf.ts:444-454`, which
   prints `completion.completedBy.name`.
4. **Photos are counts, not images.** Read `:189`, `:630` and the manifest block
   at `:750-778`, including its own explanatory line about retrieving
   *"controlled originals"* by document id.
5. **`decrypt()`'s passthrough is unconditional.** Read
   `backend/src/lib/encryption.ts:80-96` in full. The `isEncrypted` test at
   `:84` and its `return encryptedValue` at `:86` sit **before** the key-null
   branch at `:90`, so no environment gate applies. `isEncrypted` itself
   (`:129-136`) is a pure regex test against `:10`.
6. **Production plaintext storage is already impossible.** Read
   `runtimeConfig.ts:446` (`assertProductionHexKey('ENCRYPTION_KEY', …, 32)`)
   and `:460-461` (the `ALLOW_PLAINTEXT_SECRET_STORAGE` fatal), then
   `encryption.ts:12-18` to confirm both arms of
   `isPlaintextSecretStorageAllowed()` are unreachable in production.
7. **The state store binds no actor.** Read
   `backend/src/routes/oauth/stateStore.ts:10-22` (create) and `:24-48`
   (verify), and the `OauthState` model at `schema.prisma:262-272`.
8. **`oauth.ts:384` is inbound, not outbound.** Read `:371` (`expectedClientId`
   from `GOOGLE_CLIENT_ID`) and `:386` (`Invalid Google token issuer`) in the
   ID-token verification helper, and confirmed the outbound token exchange is a
   separate function at `:263`.
9. **Sentry never scrubs breadcrumbs.** Read `backend/src/lib/sentry.ts:35-67`
   line by line — `message` (`:36-37`), `extra` (`:46-48`), `request` (`:50-63`)
   — with no `breadcrumbs` branch; then `:81-89` for the absent
   `beforeBreadcrumb` and `integrations`; then grepped both `backend/src` and
   `frontend/src` for `beforeBreadcrumb` — zero hits. Frontend init read in full
   at `frontend/src/lib/sentry.ts:13-20`.
10. **No company deletion.** Grepped `company.delete|companies.delete|
    deleteCompany|prisma.company.delete` across `backend/src`, classified all
    four non-test hits (a logo delete and two benchmark teardowns), then read
    the company router's mount at `backend/src/server.ts:175` and enumerated its
    DELETE handlers.
11. **The cascade is unreachable.** Read the `Company` model
    (`schema.prisma:17-34`) and every child's `onDelete`: `User` `SetNull`
    (`:64`), **`Project` `Restrict` (`:400`)**, `WebhookConfig` `Cascade`
    (`:196`), `GlobalSubcontractor` `Cascade` (`:1280`),
    `ImportMappingProfile` `Cascade` (`:2150`).
12. **`Project.name` is not unique.** Read the `Project` model
    (`schema.prisma:368`), its `name` at `:371` and `projectNumber` at `:372`,
    and the only unique key at `:434`.
13. **Variation lines exist in the shipped mapper.** Read
    `backend/src/routes/claims/xeroExport.ts:171-181` (the rows), `:290-294`
    (the source mapping), and the invariant at `:184-194` that makes dropping
    them fatal, cross-checked against
    `backend/src/routes/claims/inclusionDecision.ts:281`, `:284`, `:292`.
14. **The SOPA due date reaches `*DueDate`.** Read
    `frontend/src/pages/claims/ClaimsPage.tsx:531-534` (compute and append),
    `backend/src/routes/claims/xeroExport.ts:244` (parse), `:148` (apply), and
    the header column at `:27`, plus the provenance comment at `:241-243`.
15. **Seventeen reason codes.** Read
    `backend/src/lib/readiness/requirements/claimMember.v1.ts:33-51` and counted
    the entries at `:34-50`.
16. **Subprocessor lists match at nine.** Read
    `docs/ops/customer-operations-pack.md:259-279` (the table at `:264-274`, the
    cross-check sentence at `:261-262`, the accuracy note at `:276-278`) and
    `frontend/src/pages/legal/PrivacyPolicyPage.tsx:161-174`.
17. **Xero external facts.** `WebFetch` on `developer.xero.com` times out
    (reproduced three times, 60s each) and `curl` returns a JavaScript shell,
    because the content is client-rendered from Contentful. Eleven primary pages
    were rendered with local headless Playwright and read from the rendered
    text. Every fact tagged `[FETCHED]` in this document comes from one of those
    renders; the URL is given inline. The two facts where **Xero's own pages
    disagree with each other** are flagged in place: the daily limit (§11.1) and
    the attachment size (§8.5).
