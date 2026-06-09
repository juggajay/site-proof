# SiteProof — Change Requests / Backlog

_A living list of changes Jayson wants. Started 2026-06-09 during a live walkthrough of the lot → ITP → conform → progress-claim flow._

**Guiding principle:** SiteProof is a **single-sided, contractor-side tool**. The client / Principal / superintendent is an **external** party — served by outputs (PDF, exports, audit trail), **not** by in-app logins. Keep the QA + claims flow simple and contractor-side. **Simplify wherever the workflow has more ceremony than a mid-market contractor will tolerate.**

---

## Claims

### C1. Simplify progress claims — remove the in-app "superintendent certifies" assumption
**Type:** Change &nbsp;·&nbsp; **Status:** To do &nbsp;·&nbsp; **Priority:** High

**What:** Stop modelling the claim as if an external superintendent certifies it *inside* the app. Make the claim flow **direction-aware** and simpler.

**Why:** The superintendent / Principal is external and won't adopt the contractor's software. Under SOPA the client side responds with a **payment schedule** the contractor *receives* — not something a guest superintendent issues from inside SiteProof.

**Direction-aware model:**
- **Subcontractor → Head Contractor:** the HC **is** the certifier → keep "certify" in-app.
- **Head Contractor → Principal:** replace "Certify Claim" with **"Record certification received"** — capture certified amount (can be < claimed), date, reasons/notes (SOPA), attached certificate/payment-schedule PDF, who certified.
- **No** client/superintendent login.
- **(Optional, later)** a tokenised superintendent review/sign link (like hold-point release) for independent attribution — external, not core.

### C2. Claim a percentage of a lot's total (partial claiming)
**Type:** Feature &nbsp;·&nbsp; **Status:** To do &nbsp;·&nbsp; **Priority:** High

**What:** Allow claiming a **% (or $ portion) of a lot's total**, not just 100%.

**Why:** Progress claims are incremental (30% now, 50% next…). Backend already supports cumulative claiming; the current modal only claims the full lot value (observed live).

**Detail:** per-lot % (or $) input; show previously-claimed / this-claim / cumulative; enforce cumulative ≤ 100%; lot flips to `claimed` only at 100%.

---

## ITP & sign-off

### I1. Superintendent / witness & hold-point sign-off in ITPs — one source of truth
**Type:** Change &nbsp;·&nbsp; **Status:** To do (needs research) &nbsp;·&nbsp; **Priority:** Medium-High

**The problem (observed live):** the same superintendent sign-off can be satisfied **two competing ways**, which undermines the evidence:
1. The proper external mechanism — the **tokenised email "release" link** (superintendent clicks & signs, no login, captures who/method/date).
2. …but the ITP checklist also lets the **contractor just tick "Complete Anyway"** on a superintendent-tagged item, with no attribution.

**Jayson's gut / current lean:** it's **the contractor (our user) who completes the ITP** — including recording the superintendent's sign-offs — rather than the client logging in. **But validate with research** (R1-A) on how other systems generally handle this before committing.

**Likely direction:** keep it contractor-driven, but ensure superintendent/witness/hold-point sign-offs **carry the external party's identity** (name/date/method/evidence or the tokenised link), and reconcile the ITP item and the hold-point record into **one source of truth** rather than two.

---

## Tests

### T1. Make the test requirement for conformance conditional (derive from the ITP)
**Type:** Change &nbsp;·&nbsp; **Status:** To do (needs research) &nbsp;·&nbsp; **Priority:** High

**Problem (confirmed in code):** `backend/src/lib/conformancePrerequisites.ts` **blanket-requires ≥1 passing verified test on EVERY lot** to conform:
```js
hasPassingTest = testResults.some(t => t.passFail === 'pass' && t.status === 'verified');
canConform = itpAssigned && itpCompleted && hasPassingTest && noOpenNcrs;
```
So a lot whose ITP has **no test points** can't conform without inventing a test. **Not every ITP has a test** — tests apply to specific points (e.g. concrete strength before/around pours, compaction density, etc.).

**Fix direction:** derive the test requirement **from the ITP**. The model already supports it — `ITPChecklistItem.testType` / `evidenceRequired`, and `TestResult.itpChecklistItemId`. Only require a passing verified test for items that actually call for one; if the ITP defines no test points, don't block conformance on tests at all.

**Research (R1-B):** when are tests actually mandatory in civil QA, and how do other systems decide/enforce it.

### T2. Simplify submitting a test (too much ceremony)
**Type:** Change &nbsp;·&nbsp; **Status:** To do &nbsp;·&nbsp; **Priority:** High

**Full lifecycle walked live (manual path), with findings:**
1. **Add Test Result** — a large modal (~17 fields). Result value + pass/fail are entered *here* if known.  → status `Requested`
2. **Mark as At Lab** — 1 click, captures **no data**.  → `At Lab`
3. **Mark Results Received** — 1 click, captures **no data**.  → `Results Received`
4. **Enter Results** — **misnomer: opens NO form, captures NO data**, just flips status.  → `Entered`
5. **Verify** — **blocked**: "A test certificate must be uploaded before the test result can be verified."

**Problems found:**
- **3 status-shuffle clicks** (At Lab / Results Received / Enter Results) capture nothing — pure ceremony.
- **"Enter Results" captures no result.** A test reaches `Entered` / becomes verifiable with a **blank result and `pending` pass/fail** (observed — the Dry Density Ratio test had no value yet sat at `Entered`).
- **Dead-end at Verify** — see **B2**. Verify needs a cert, but there's no way to attach one to an existing test.

**Fix direction:** collapse toward *create test → attach cert → record pass/fail → (QM verify)*. Drop or make optional the "At Lab / Results Received / Enter Results" status shuffle. Require an actual result before a test can be `Entered`/verified. Inform with research (R1-B).

---

## NCRs

### N1. NCRs must be assignable to a subcontractor (or a person)
**Type:** Feature / Bug &nbsp;·&nbsp; **Status:** To do &nbsp;·&nbsp; **Priority:** High

**What:** An NCR needs to be assignable to a responsible party — most importantly the **subcontractor company** that did the non-conforming work (they must rectify), and/or an internal **user/person**. Observed live: the Raise NCR form creates every NCR as **Responsible: Unassigned**, with no assignee picker, and no obvious assign action on the list/respond.

**Confirmed in code:**
- **Assign to a person (user):** the create route **already accepts & validates `responsibleUserId`** (`ncrs/ncrCore.ts` — checks the user is active on the project) — but the **Raise NCR form doesn't expose the field**. → UI-only gap on create (also add an assign/reassign action on the NCR detail).
- **Assign to a subcontractor:** **not implemented on the write side at all.** `responsibleSubcontractorId` is *read* everywhere (`ncrAccess.ts` access control, `ncrListRoute.ts` so a subbie sees their NCRs, `ncrAnalytics.ts`) but the only place it's *written* sets it to `null` (`subcontractors/adminRoutes.ts` on subcontractor removal). So a subcontractor's "NCRs assigned to me" view is **always empty**. → needs backend (wire it into create + an assign endpoint) **and** UI.

**Fix direction:** add a **responsible-party picker (subcontractor *or* user)** to the Raise NCR form + an **Assign / reassign** action on the NCR detail; wire `responsibleSubcontractorId` on the write side; notify the assignee. (The rest of the NCR flow — raise, auto-number, lot→`ncr_raised` side-effect, lifecycle states — is solid.)

---

## Bugs

### B1. Evidence Package generator crash
**Type:** Bug &nbsp;·&nbsp; **Status:** To do &nbsp;·&nbsp; **Priority:** High

**What:** "Generate Evidence Package" crashes and produces no PDF:
> `Evidence package failed — Cannot read properties of undefined (reading 'filter')`

This is the document the contractor hands a client to back a claim — currently completely broken. Likely an `undefined` array (photos/NCRs/hold points) on a lot that has none, with `.filter` called on it. Add null-safety; test with a lot that has no photos/NCRs.

### B2. Can't attach a certificate to an existing test → tests can never be verified via the UI
**Type:** Bug &nbsp;·&nbsp; **Status:** To do &nbsp;·&nbsp; **Priority:** High (breaks the conformance gate)

**What (confirmed live):** Verifying a test requires a certificate, but there is **no UI to attach a certificate to an existing test**. The test row's only actions are **Print / Verify / Reject**; clicking the test opens no detail page. The only certificate-upload entry points are the page-header **"Upload Certificate"** (AI extraction — creates a *brand-new* test) and **"Batch Upload"**.

**Impact:** A manually-created test can **never reach `verified`** through the normal UI. Since conformance requires a "passing **verified** test result" (see T1), the conformance gate is effectively **unsatisfiable without Force-Conform** (or unless every test is created via the AI cert-upload path). Both our walkthrough tests (Compaction, Dry Density Ratio) are stuck at `Entered`.

**Fix direction:** add a per-test **"Attach / Upload certificate"** action (row action or test detail) that sets `certificateDocId` on the existing test, unblocking Verify. Pairs with T2.

---

## Research needed

### R1. How the QA + claim lifecycle actually works in other systems / the real world
**Type:** Research &nbsp;·&nbsp; **Status:** ✅ Done (first pass) — see [research-findings-qa-claims.md](research-findings-qa-claims.md) &nbsp;·&nbsp; **Priority:** High (informs C1, I1, T1, T2)

**Key validated findings:** (1) Regulation = "contractor submits → Principal authorises hold point *in writing*" → I1's contractor-records-with-attribution is correct; reconcile to one source of truth; avoid client login. (2) Testing is tied to ITP points + frequencies, **never blanket per lot**, NATA-endorsed cert submitted with the lot conformance report → validates **T1** (derive test requirement from ITP) and **B2** (must attach cert to existing test). (3) SOPA = certification is the *respondent's* payment schedule (scheduled amount + reasons) that the contractor *receives* → validates **C1** (record certification received, don't have superintendent certify in-app); real output = SOPA payment-claim PDF + schedule + supporting statement (NSW) + evidence pack, not the thin CSV.

A single brief, three pillars — all answering "where does the **client/superintendent** plug in, and how heavy is each step?":

- **A. ITP completion & superintendent/client sign-off** — In civil-QA software (CivilPro, Procore Quality, Dashpivot/Sitemate, Visibuild, CONQA, FTQ360, HammerTech, ConX, etc.) who completes ITP items, and how do hold/witness-point sign-offs by the superintendent get captured — client login, email/sign-link, or contractor-records-it? (Feeds **I1**.)
- **B. Tests** — When are lab tests actually required in civil QA (which ITP points / activities)? How do other systems model test request → result → verification, and is a full lab lifecycle normal or over-built for SMB contractors? How are NATA certs handled? (Feeds **T1, T2**.)
- **C. Progress claim output & closing the loop** — What document does a head contractor serve on the Principal/superintendent (SOPA payment claim format, schedule of lots, this-claim vs previous vs total, retention, GST, stat dec)? How is it served, how is the response (payment schedule/certificate) and payment tracked, and what's the minimum viable, defensible, client-ready output? (Feeds **C1** and the claim-output design.)

---

_Add new items below as they come up._
