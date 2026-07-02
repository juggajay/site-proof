# SOPA-compliant progress-claim output — implementation spec

**Status:** implementation-ready synthesis. Hand to a dev.
**Scope:** the client-ready progress-claim PDF SiteProof should generate, the NSW head-contractor supporting statement, recording the payment schedule received back, state-aware handling (NSW / QLD / VIC), and a pragmatic build sequence for a mid-market AU civil contractor.
**Context:** SiteProof is single-sided. The contractor is the **claimant**; the Principal/superintendent is **external** (no login). Certification is the **respondent's act** — SiteProof *generates the claim* and *records the schedule/certificate it receives back*. Today's output is a single-row summary CSV (`Claim #, Period, Status, Lots, Claimed/Certified/Paid amount, dates` — `frontend/src/pages/claims/components/ClaimsTable.tsx:80`), which is **not** a valid statutory payment claim and not client-ready.

**Confidence legend:** `[V]` = verified across primary + multiple sources in the facet briefs; `[S]` = sourced but not re-verified against primary legislation in this pass (AustLII / legislation.\*.gov.au returned HTTP 403 to the automated fetch tool — verbatim statutory strings should get a final human eyeball in a normal browser before being hard-coded). Every non-obvious claim carries a source URL.

---

## 1. The payment-claim PDF

Replace the summary CSV with a structured PDF modelled on the international **AIA G702 (summary/certification page) + G703 (continuation / schedule-of-values sheet)** convention, which Procore AU explicitly maps onto the AU market. `[V]` Sources: https://www.procore.com/en-au/library/progress-claims · https://www.procore.com/en-au/library/schedule-of-values · https://help.aiacontracts.com/hc/en-us/articles/1500009308302-Instructions-G703-1992-Continuation-Sheet

The document is **two parts**: a header/identification + schedule-of-values table (the G703-style continuation), then a summary "amount now due" waterfall (the G702-style certification block). In NSW the head-contractor case also bundles a **separate** supporting-statement attachment (§2).

### 1.1 Section list (in render order)

1. **Document title / statutory endorsement block** (§1.3)
2. **Header / identification block** (§1.2)
3. **Schedule-of-lots / schedule-of-values table** (§1.4)
4. **Variations section** (§1.5)
5. **Materials on site (unfixed materials)** — optional line (§1.6)
6. **Summary / "amount now due" waterfall** (§1.7)
7. **Signature / claimant declaration block** (claimant name, position, date)
8. *(NSW HC only)* attached **supporting statement** as a separate artifact (§2)

### 1.2 Header / identification block — every field

| Field | Notes | Have today? |
|---|---|---|
| Claimant legal name + **ABN/ACN** | must match the contract's legal entity, not a trading name (SOPA validity gate) `[V]` | `Company.name` yes; `Company.abn` yes |
| Respondent (Principal/HC) legal name + **ABN/ACN** | the entity actually contracted with `[V]` | net-new (only `Project.clientName` free-text today) |
| Project name / site address | | `Project.name` yes; address net-new |
| Contract reference / number | | net-new |
| **Claim number** (sequential) | | `ProgressClaim.claimNumber` yes |
| **Claim period** (from–to) | the "named month" in NSW/VIC post-reform | `claimPeriodStart` / `claimPeriodEnd` yes |
| **Claim date / date served** | starts the schedule + payment clocks; record service date separately | `submittedAt` partial |
| **Payment due date** | computed, state-aware cap (§4) | computed in FE `calculatePaymentDueDate` today; move server-side |
| Original contract value / contract sum | | `Project.contractValue` yes |

Source (header set): https://www.procore.com/en-au/library/progress-claims · https://www.payapps.com/blogs/your-guide-to-construction-progress-claims/ `[V]`

### 1.3 The statutory endorsement (state-aware, highest-value single addition)

Hard-print an endorsement line driven off `Project.state`. **For NSW post-2019 this is mandatory** — without it the document is just an invoice and does not enliven the Act (no right to a payment schedule, no adjudication). `[S — corroborated 5+ sources, sub-paragraph label s13(2)(c) not re-verified against primary text]`

- **NSW** (contracts on/after 21 Oct 2019): exact words *"This is a payment claim made under the Building and Construction Industry Security of Payment Act 1999 (NSW)"* (or words clearly to that effect). The 2013 amendments had removed it; the **2019 amendments reinstated it** as s13(2)(c). This is the single most important compliance trap. Source: https://www.nsw.gov.au/housing-and-construction/compliance-and-regulation/security-of-payment/making-a-payment-claim · https://www.corrs.com.au/insights/amendments-to-the-nsw-security-of-payment-regime-what-you-need-to-know `[S]`
- **QLD** (BIF Act): the Act does **not** require citing the Act on the face of the claim, but the claim must clearly **"request payment"** — phrasing like "amount due this claim" has been held insufficient. Putting the word **"Invoice" / "Tax Invoice"** on the document is the cheapest validity insurance (a document bearing "invoice" is taken to satisfy the request requirement). Source: https://www.qbcc.qld.gov.au/running-business/getting-paid/request-payment · https://www.holdingredlich.com/security-of-payment-qld `[V]`
- **VIC** (SOP Act 2002): commonly *"This is a payment claim made under the Building and Construction Industry Security of Payment Act 2002 (Vic)."* VIC courts have historically treated the endorsement **leniently**, but include it by default. Source: https://www.turtons.com/security-of-payment-act-vic-everything-you-need-to-know `[S]`

**Build rule:** store the endorsement string (and the "label as Tax Invoice" flag for QLD) in a **per-jurisdiction state-rules config**, not hard-coded inline, so it stays correct as states are added and as statutes are amended.

### 1.4 Schedule-of-lots table design (the core)

One row per lot/activity (SiteProof's `Project → Lot → ClaimedLot` spine maps directly). This is the canonical AU column set (AIA G703 A–I, echoed by Procore AU SOV and the Mastt template). `[V]` Source: https://help.aiacontracts.com/hc/en-us/articles/1500009308302-Instructions-G703-1992-Continuation-Sheet · https://www.procore.com/en-au/library/schedule-of-values

| Column | Meaning | Derivation | Have today? |
|---|---|---|---|
| Item / lot no. | lot or activity id | `Lot.lotNumber` | yes |
| Description | scope line | `Lot` description | yes |
| **Scheduled value / contract value** | budgeted $ for the line (incl. approved variations) | per-lot contract value | net-new (per-lot value not modelled; only `quantity/unit/rate` on `ClaimedLot`) |
| % complete to date | cumulative completion | `ClaimedLot.percentageComplete` | yes |
| Total completed & stored to date | cumulative $ earned (incl. materials on site) | cumulative sum across claims | derivable (needs cumulative state) |
| **Previously claimed** | prior claims' cumulative | sum of prior `ClaimedLot.amountClaimed` for the lot | derivable |
| **This claim** | `total-to-date − previously-claimed` | computed | computed |
| % (of contract value) | `this-claim` or `total-to-date ÷ contract value` | computed | computed |
| Balance to complete | `contract value − total-to-date` | computed | computed |
| Retention (per-line, if variable) | optional per-line retainage | config | net-new |

**Design note on reconciliation:** `this claim` should be derived against **previously *certified*** to-date where a prior payment schedule has been recorded (§3), falling back to previously *claimed* only if no schedule was recorded. The "less previously certified" line is what ties claim N+1 to the last schedule received — this is why §3 (recording the schedule) is structurally required, not optional. Source: https://www.mastt.com/guide/progress-claim · https://www.payapps.com/blogs/your-guide-to-construction-progress-claims/ `[V]`

### 1.5 Variations section

A **separate block** below the base-contract works, each variation line referencing its **written approval / change-order number**, with the same three-column treatment (approved-to-date / previously claimed / this claim). Show **pending (unapproved) variations** separately for the client's reference. **VIC post-15-Apr-2026:** delay/disruption costs, latent-condition costs, and non-written ("unagreed") variations are now claimable under the Act — the claim builder must **not** block unapproved-variation lines for VIC (see §4). Source: https://www.procore.com/en-au/library/progress-claims · https://varicon.com.au/feature/progress-claims-variations/ `[V]`

### 1.6 Materials on site (optional)

Value of materials delivered/stored but not yet installed, with **location and ownership** stated; counts toward "completed & stored to date." Source: https://www.procore.com/en-au/library/progress-claims `[V]`

### 1.7 Summary / "amount now due" waterfall + GST

Compute these — do not ask the user. Canonical AU order:

```
  Contract works completed & stored to date (cumulative, ex-GST)
+ Approved variations to date
= Total earned to date (ex-GST)
− Retention held to date
= Net earned to date after retention
− Amount previously certified  (fallback: previously claimed)
= Net amount this claim (ex-GST)
+ GST (10%, on the net-of-retention amount)
= AMOUNT NOW DUE / PAYABLE (this claim, inc-GST)
```

Source: https://www.mastt.com/guide/progress-claim · https://www.procore.com/en-au/library/progress-claims · https://www.payapps.com/blogs/your-guide-to-construction-progress-claims/ `[V]`

**Statutory amount requirement:** the claimed amount must be stated **GST-inclusive** (e.g. "$11,000 including GST", not "$10,000 + GST"), and arithmetically coherent on its face. GST must be its own itemised line. Source (NSW s13(2)(b) coherence + GST-inclusive): https://www.adjudicate.com.au/nsw/start/claimant-preparing-the-payment-claim `[V]`

**Retention × GST trap (get this right):** GST on the **retained** portion is not payable until the retention is actually released. The defensible (ATO/HIA-aligned) convention computes GST on the **net-of-retention** amount and carries the retained money's GST forward to be invoiced on release. HIA worked example: work $20,000 → retention 5% = $1,000 → net $19,000 → GST $1,900 → invoiced $20,900; the held $1,000 + its $100 GST are invoiced separately on release. Source: https://hia.com.au/resources-and-advice/managing-your-business/dealing-with-contracts/articles/gst-on-retention-money · https://muli.com.au/introduction-to-australian-construction-accounting/2024/gst-and-progress-claims-explained-for-the-construction-industry-in-australia/ `[V]`
A simpler "GST on gross, then deduct retention" convention also exists and produces a **different amount-now-due and different BAS timing** — implement net-of-retention by default but make the convention **configurable**, because real subbie invoices vary. `[V — flagged: two conventions]`

**Retention model (first-class, not an afterthought):** retention % (commonly 5% or 10%), retention this claim, retention held-to-date (cumulative), retention released (half at practical completion, remainder at end of defects-liability period). Source: https://www.mastt.com/resources/progress-claim-template · https://www.mastt.com/blogs/progress-payments-construction `[V]`

**Out of scope v1 but note:** NSW projects > $20M require retention held in an ADI trust account with a ledger retained ≥3 years. Only relevant if SiteProof ever reports retention balances. Source: https://www.nsw.gov.au/housing-and-construction/compliance-and-regulation/security-of-payment/retention-money `[V]`

### 1.8 Endorsement / required statutory content summary (NSW s13(2))

A NSW payment claim must, by construction: **(a)** identify the construction work the payment relates to with enough particularity for the respondent to assess it and prepare a schedule (basis = lump sum / schedule of rates / % complete); **(b)** indicate the claimed amount (GST-inclusive); **(c)** state it is made under the Act (the §1.3 endorsement). Source: https://legislation.nsw.gov.au/view/whole/html/inforce/current/act-1999-046 · https://www.bartier.com.au/insights/articles/checklist-for-claimants-payment-claims `[S — substance verified, sub-paragraph labels not re-verified]`

**Validity guards SiteProof should warn on (NSW):** one claim per named month (warn on a second claim in the same month); 12-month longstop — work last performed > 12 months ago (s13(4)); post-termination final-claim right (claim may be served on/from the date of termination). Source: https://www.nsw.gov.au/housing-and-construction/compliance-and-regulation/security-of-payment/making-a-payment-claim · https://www.turtons.com/security-of-payment-act-nsw-everything-you-need-to-know `[S]`

---

## 2. The NSW head-contractor supporting statement (state-conditional attachment)

### 2.1 When it is mandatory

A **head contractor** (whose contract is with the **principal** and who has directly engaged **subcontractors**) **must not serve a payment claim on the principal unless** it is accompanied by a supporting statement that indicates it relates to that payment claim (s13(7)). It does **not** apply to subcontractor-up-the-chain claims, and **not** where the principal engaged all subcontractors directly. The declaration covers **only directly-engaged subcontractors**, not the whole subcontract chain. Source (verbatim s13(7)–(9)): https://classic.austlii.edu.au/au/legis/nsw/consol_act/bacisopa1999606/s13.html · https://piperalderman.com.au/insight/head-contractors-and-supporting-statements-under-the-building-and-construction-industry-security-of-payment-act-1999-nsw/ `[V]`

**Gate:** `Project.state == 'NSW'` **AND** claiming party = head contractor (contract with principal) **AND** ≥1 directly-engaged subcontractor. Plus an **owner-occupier branch** to pick the correct of the two approved forms.

### 2.2 The offence for omission / falsity (penalty notices — print verbatim on the form)

- **s13(7)** failure to attach: max **1,000 penalty units (corporation) / 200 penalty units (individual)** → on-form dollar values **$110,000 (corp) / $22,000 (individual)**. `[V]`
- **s13(8)** attaching a statement **knowing it is false or misleading in a material particular**: max **1,000 penalty units (corp) / 200 penalty units OR 3 months imprisonment, or both (individual)** → **$110,000 / $22,000 or 3 months imprisonment (or both)**. `[V]`

Source: https://classic.austlii.edu.au/au/legis/nsw/consol_act/bacisopa1999606/s13.html · https://piperalderman.com.au/insight/head-contractors-and-supporting-statements-under-the-building-and-construction-industry-security-of-payment-act-1999-nsw/

**Case-law nuance — do NOT hard-block, do warn loudly:** a missing or even defective supporting statement is a **criminal/penalty exposure** for the HC but does **not** invalidate the payment claim for adjudication purposes (*Central Projects v Davidson* [2018] NSWSC 523; *TFM Epping Land v Decon Australia* [2020] NSWCA 93, departing from earlier *Kitchen Xchange* / *Kyle Bay*). UX = strong required-by-default warning gate ("NSW head-contractor claims must attach a supporting statement — penalty up to $110,000"), **not** a hard technical block that would stop a user who legitimately doesn't need one. Source: https://www.holdingredlich.com/blog/what-should-the-supporting-statement-contain `[V]`

### 2.3 Two Secretary-approved forms (pick by contract type)

| Form | When | Version |
|---|---|---|
| **Supporting Statement – Construction Contracts** | default; any non-owner-occupier contract | v6, updated 16 Jul 2025 (footer still reads "April 2021") |
| **Supporting Statement – Owner Occupier Construction Contracts** | where the contract is an owner-occupier construction contract | (fields not separately extracted — pull before building this branch) |

Source: https://www.nsw.gov.au/housing-and-construction/compliance-and-regulation/security-of-payment/making-a-payment-claim/supporting-statement-for-construction-contracts · official PDF (v6): https://www.nsw.gov.au/sites/default/files/noindex/2025-07/supporting-statement_constructions_contract_updated-v6.pdf `[V]`

### 2.4 Exact form fields (Construction Contracts form, 3 pages — reproduce exactly)

**Page 1 — identity & scope**
- `Head contractor` — business name (text)
- One of two mutually-exclusive options:
  - **Option 1 (single subcontractor):** business name of subcontractor · ABN of subcontractor · contract number/identifier
  - **Option 2:** "has entered into a contract with the subcontractors listed in Schedule 1" (checkbox)
- Period covered, one of: "This statement applies to work between **(start)** and **(end)**", **or** "...work completed in Stage **(number)** of the construction contract"
- `Subject of the payment claim dated` **(date)** — links the statement to the specific payment claim (this is the literal s13(7) "indicates that it relates to that payment claim" requirement)

**Page 2 — declaration (reproduce wording verbatim, do not paraphrase):**
> "I, **(full name)** being the head contractor, a director of the head contractor or a person authorised by the head contractor on whose behalf this declaration is made, hereby declare that to the best of my knowledge and belief **all subcontractors, if any, have been paid all amounts that have become due and payable in relation to the construction work that is the subject of this payment claim.** These subcontractors and the amounts paid to them are identified in Schedule 1 on page 3."

Then the two statutory-offence notices (the §2.2 penalty text, verbatim), then the **signature block**: `Full Name of Individual` · `Position/Title` · `Signature` · `Date`. **Who signs:** the head contractor, a **director** of the HC, or a **person authorised** by the HC. **No witness/JP required** — this is the point of the supporting statement, which replaced the old witnessed statutory declaration.

**Page 3 — Schedule 1 table.** Heading: *"List all subcontractors that have been paid all amounts that have become due and payable in relation to the construction work that is the subject of the payment claim which this supporting statement accompanies."* Columns:
- `Name of subcontractor`
- `ABN`
- `Contract number/identifier`
- `Date of works (period or stage)`
- `Date of subcontractor's payment claim`

Footer: *"Approved form under Building and Construction Industry Security of Payment Act 1999 - Section 13(9)."*

**Critical data-model nuance:** despite the p2 prose ("the amounts paid to them are identified in Schedule 1"), the approved table has **NO dollar-amount column**. Mirror the approved columns exactly — **do not invent an amount column.** Source (full field extraction): https://www.nsw.gov.au/sites/default/files/noindex/2025-07/supporting-statement_constructions_contract_updated-v6.pdf `[V]`

### 2.5 Pre-fill + build notes

- It is an **attachment**, a separate artifact, not part of the claim PDF — it must "accompany" the claim and reference the **payment claim date**.
- Schedule 1 maps cleanly onto existing models: `GlobalSubcontractor` (name + ABN) → `SubcontractorCompany`/per-project subcontract (contract number/identifier) → docket/period data (date of works). SiteProof already holds the subbie register + payment history, so this is a natural auto-fill.
- The "all subbies paid" declaration is the HC's **legal sign-off** — gate it behind an explicit user attestation (capture signatory name + position/title + date; offer the three capacities). **Do not auto-tick.**
- Store the form **template as versioned/configurable** (v6 is dated Jul 2025; it changes) and source the penalty dollar figures from the **state-rules config** (penalty-unit value can change).

---

## 3. Recording the payment schedule RECEIVED (C1 — "record certification received")

When the contractor receives the payment schedule back, SiteProof records it (never generates it). One record per claim, state-aware.

### 3.1 What a valid payment schedule contains (NSW s14, QLD s69, VIC equivalent — the same three things)

1. **Identify the payment claim** it responds to.
2. **Scheduled amount** — the amount (if any) the respondent proposes to pay (the defined term "scheduled amount"). **Can be $0.**
3. **Reasons** — only required if scheduled < claimed: why it is less and the respondent's reasons for withholding.

Source (NSW s14): https://classic.austlii.edu.au/au/legis/nsw/consol_act/bacisopa1999606/s14.html · (QLD s69): https://www.holdingredlich.com/security-of-payment-qld · (VIC): https://www.turtons.com/security-of-payment-act-vic-everything-you-need-to-know `[S — substance verified, NSW/QLD section numbers not re-verified against primary]`

**Why the reasons matter (reasons lock-in):** in all three states the respondent **cannot raise in adjudication any reason for withholding that was not in the payment schedule** (NSW s20(2B); QLD and VIC equivalents). VIC post-15-Apr-2026 the abolition of "excluded amounts" widens this materially. So the recorded reasons are legally the **complete defence set** — capture them fully. Source: https://www.contractsspecialist.com.au/payment-schedule-reasons-withholding-nsw/ · https://www.minterellison.com/articles/changes-to-victorias-security-of-payment-regime-have-now-commenced `[S]`

**Validity gate:** a schedule that states a lesser amount but gives **no reasons** is invalid/challengeable. Source: https://constructionlawmadeeasy.com/security-of-payment/a-payment-schedule-that-does-not-provide-reasons-for-withholding-is-invalid/ `[S]`

### 3.2 Data-model fields (entity `PaymentScheduleRecord`, 1:1 with `ProgressClaim`)

| Field | Maps to | Notes | Have today? |
|---|---|---|---|
| `claimId` | `ProgressClaim` | FK, 1:1 | — |
| `claimedAmount` | claim total | from SiteProof's own claim | `totalClaimedAmount` yes |
| `scheduledAmount` | s14(2) | the certified / proposed-to-pay amount; **allow $0** | `ProgressClaim.certifiedAmount` exists (no $0 vs null distinction today) |
| `variance` (computed) | `claimed − scheduled` | drives the "reasons required?" rule | net-new (compute) |
| `reasonsForWithholding` | s14(3) | **required + prominent whenever scheduled < claimed**; store as canonical "what the principal can argue later" set | net-new |
| `lineAdjustments[]` (optional) | per-line claimed vs certified | so next claim's "less previously certified" is correct | net-new |
| `dateClaimServed` | starts the clock | | partial (`submittedAt`) |
| `dateScheduleReceived` | drives the response-window check | | `certifiedAt` partial |
| `certifiedBy` / `respondentName` | who issued the schedule (superintendent/principal contact) | | net-new |
| `paymentDueDate` | the certified payment due date | state-aware (§4) | partial |
| `attachedSchedulePdf` | the actual PDF the principal sent | store in Supabase `documents` bucket (durable surface) | net-new |
| `scheduleStatus` (enum) | see below | | net-new |

`scheduleStatus` enum: `awaiting_schedule` → `received_full` (scheduled == claimed) / `received_short` (scheduled < claimed, reasons present) / `received_invalid` (short but no reasons) / `no_schedule_overdue` (response window elapsed, none received).

### 3.3 Timers & rules to encode (state-aware — see §4 for the day-counts)

- **Response-window timer** from `dateClaimServed`, business-day aware. NSW = 10 BD, QLD = 15 BD, VIC = 10 BD (or earlier per contract; a contract clause cannot lawfully extend beyond the statutory window). Source (NSW): https://www.nsw.gov.au/housing-and-construction/compliance-and-regulation/security-of-payment/responding-to-a-payment-claim `[S]`
- **No schedule in time → respondent liable for the FULL claimed amount** on the due date; respondent cannot bring a cross-claim or raise contract-based defences in recovery; a "second-chance" notice then gives a further window (NSW 5 BD under s17(2); VIC 5 BD post-reform). Surface a countdown + an "overdue → you may be entitled to the full claimed amount" flag. Source: https://classic.austlii.edu.au/au/legis/nsw/consol_act/bacisopa1999606/s14.html · https://www.holdingredlich.com/sopa `[S]`
- **Validity check:** `scheduledAmount < claimedAmount` and `reasonsForWithholding` empty → mark `received_invalid` and warn (challengeable; reasons-lock-in).
- **Downstream timers (high value, optional):** due-date for payment, and the adjudication windows (NSW: lesser-amount schedule → 10 BD of receiving it; schedule-but-unpaid → 20 BD after due date; no schedule → after the 5-BD notice). These turn the feature from a passive log into a "you have N business days to act" prompt. Source: https://www.holdingredlich.com/sopa `[S]`
- **Keep all day-counts table-driven per jurisdiction** — never hard-code 10/15. Business-day calendars must exclude weekends, the state's public holidays, and the **22 Dec – 10 Jan** shutdown (NSW always; VIC from 15 Apr 2026; QLD has its own BIF-defined shutdown — verify the exact range). Source: https://constructionlawyersydney.com/articles/security-of-payment-nsw-how-to-draft-a-payment-schedule-2 · https://www.holdingredlich.com/victoria-s-far-reaching-security-of-payment-reforms-have-now-commenced `[S]`

---

## 4. State-aware handling — NSW vs QLD (BIF) vs VIC

The same claim engine, parameterised by `Project.state`. Differences to encode:

| Dimension | NSW (SOP Act 1999) | QLD (BIF Act 2017) | VIC (SOP Act 2002, post 15 Apr 2026) |
|---|---|---|---|
| **Endorsement on claim** | **Mandatory** (s13(2)(c), reinstated 2019) — exact NSW string | Not required to cite the Act; label **"Invoice / Tax Invoice"** to satisfy the "request payment" element | Required by statute but courts lenient; include VIC string by default |
| **Reference date** | **Abolished** (2018/2019) → one claim per **named month** | **Retained** (s67) — claim only on/after a reference date; if silent = last day of the month | **Abolished** (15 Apr 2026) → one claim per **named calendar month** |
| **Supporting statement** | **Yes — s13(7)**, HC→principal, every claim; $110k/$22k + jail risk; two approved forms | **Yes — s75**, HC→principal, **non-residential** only, every claim; max **100 penalty units** (~$16k+) | **No** — NSW-style supporting statement does **not** exist in VIC |
| **Payment-schedule response window** | **10 business days** (or earlier contract) | **15 business days** (or earlier contract) | **10 business days** (or earlier contract) |
| **Due date for payment (default / caps)** | 10 BD (HC→sub); principal→HC cap 15 BD | 10 BD default; caps **15 BD** (principal→HC), **25 BD** (HC→sub); "pay when paid" void | **20-business-day max** payment term; any contract term paying later is void to that extent |
| **Claim time bar** | **12 months** after last work (s13(4)) | **6 months** after last work (s70); final = +28 days post-DLP | **6 months** post-completion (post-reform) |
| **Christmas shutdown excluded from BD** | Yes (22 Dec – 10 Jan) | BIF-defined shutdown (verify exact range) | Yes from 15 Apr 2026 (22 Dec – 10 Jan inclusive) |
| **Unwritten / delay / latent variations claimable under Act** | per general principles | per general principles | **Yes** — excluded-amounts regime (ss 10A/10B) abolished 15 Apr 2026; claim builder must not block these for VIC |

Sources: NSW — https://www.nsw.gov.au/housing-and-construction/compliance-and-regulation/security-of-payment/making-a-payment-claim ; QLD — https://www.qbcc.qld.gov.au/running-business/getting-paid/request-payment · https://www.qbcc.qld.gov.au/running-your-business/getting-paid/request-payment/supporting-statement · https://classic.austlii.edu.au/au/legis/qld/consol_act/bifopa2017514/s75.html ; VIC — https://www.minterellison.com/articles/changes-to-victorias-security-of-payment-regime-have-now-commenced · https://www.holdingredlich.com/victoria-s-far-reaching-security-of-payment-reforms-have-now-commenced · https://kcllaw.com.au/victorian-sop-update-critical-changes-commencing-15-april-2026/ `[V for QLD/VIC supporting-statement + windows + VIC reform date; S for exact NSW/QLD section numbers]`

**Two corrections to prior repo assumptions, both load-bearing:**
1. **QLD DOES have a supporting statement** (s75, since 1 Oct 2020) — analogue to NSW s13, scoped to non-residential HC→principal. The prior "QLD has none" note is **wrong**. Treat the supporting statement as a **cross-state** requirement (NSW + QLD), not NSW-only. Source: https://www.qbcc.qld.gov.au/running-your-business/getting-paid/request-payment/supporting-statement `[V]`
2. **VIC's 2026 reform is LIVE, not pending** — commenced **15 April 2026** (brought forward by proclamation from the Bill's 1 Sept 2026; many firm articles still cite 1 Sept — stale). Applies to all payment claims made on/after 15 Apr 2026 regardless of contract date. Source: https://www.whitecase.com/insight-alert/victorias-security-payment-regime-major-reforms-now-effect · https://www.bakermckenzie.com/en/insight/publications/2026/04/australia-victorias-security-of-payment-regime-overhauled `[V]`

**Config shape:** one `JurisdictionRules` record per state holding: endorsement string + "label as tax invoice" flag, supporting-statement {required, scope, form refs, penalty $}, scheduleResponseWindowBusinessDays, paymentTermCapBusinessDays {up-chain, down-chain}, claimTimeBarMonths, businessDayCalendar {public-holiday set, shutdown range}, allowUnwrittenVariations flag. Penalty dollar figures and penalty-unit values are config, **not constants** (they change).

---

## 5. SiteProof build recommendation

### 5.1 What we already have vs net-new

**Already in the data model** (`backend/prisma/schema.prisma`):
- `ProgressClaim`: `claimNumber`, `claimPeriodStart/End`, `status`, `submittedAt`, `submittedTo`, `totalClaimedAmount`, **`certifiedAmount`/`certifiedAt`** (a thin start on §3), `paidAmount`/`paidAt`, `evidencePackageUrl`, `sopaStatementGenerated` (a flag with no generator behind it yet), `disputedAt`/`disputeNotes`.
- `ClaimedLot`: `quantity`, `unit`, `rate`, **`amountClaimed`**, **`percentageComplete`**, `evidencePackageUrl`, `notes`.
- `Project.state` (drives jurisdiction), `Project.contractValue`, `Project.name`.
- `Company.abn`, `GlobalSubcontractor.abn` + `companyName` (supporting-statement pre-fill).

**Net-new needed:**
- Per-lot **scheduled/contract value** (today only `quantity/unit/rate` exist on `ClaimedLot` — no per-line contract value to compute %/balance against).
- **Retention** model (% + held-to-date + released-at-PC/DLP) and **variations** as first-class claim lines with written-approval references.
- **Cumulative "previously certified" state** per lot (depends on §3 recording).
- **Respondent legal entity** + ABN + contract reference + site address (today only `Project.clientName` free-text).
- **Service date** distinct from `submittedAt`.
- **`PaymentScheduleRecord`** entity (§3.2) — `scheduledAmount` allowing $0, `reasonsForWithholding`, `certifiedBy`, `attachedSchedulePdf`, `scheduleStatus`, line adjustments. (`certifiedAmount`/`certifiedAt` on `ProgressClaim` are a partial start; promote to the richer record.)
- **`JurisdictionRules`** config (§4) + business-day calculator.
- The **claim PDF generator** (the existing `frontend/src/lib/pdf/*` harness is the home; there is `claimEvidencePackagePdf.ts` already, so add a `progressClaimPdf.ts` sibling) and the **supporting-statement PDF generator**.

### 5.2 Minimal viable client-ready output (ship first)

Pragmatic for a mid-market civil contractor. Cut to the smallest thing a superintendent will accept and that enlivens the Act:

1. **Structured claim PDF** = header block (§1.2) + schedule-of-lots table (§1.4, driven by existing `ClaimedLot` rows) + summary waterfall (§1.7) + GST line. Use existing `amountClaimed`/`percentageComplete`; derive `this-claim`/`total-to-date`/`balance` from cumulative `ClaimedLot` history. This alone replaces the not-client-ready CSV.
2. **State-aware endorsement line** (§1.3) off `Project.state` — the single highest-value compliance addition (NSW string / QLD "Tax Invoice" label / VIC string).
3. **GST net-of-retention** done correctly (§1.7) with a simple whole-of-contract retention % (defer per-line retention).
4. **NSW + QLD supporting-statement attachment** (§2 / §4) gated on state + HC + (QLD: non-residential) + has-subbies, pre-filled from the subbie register, behind an explicit attestation. Warn-don't-block.
5. **Record-payment-schedule screen** (§3.2 core fields: `scheduledAmount` incl. $0, `reasonsForWithholding`, `dateScheduleReceived`, `certifiedBy`, `attachedSchedulePdf`, computed `scheduleStatus`) — so claim N+1 reconciles against **certified-to-date**, not claimed-to-date.

### 5.3 Later (defer)

- Per-line retention column, materials-on-site line, full variations section with pending/unapproved split, VIC unwritten-variation lines.
- Business-day response-window countdown + adjudication-window prompts (§3.3 downstream timers).
- Owner-occupier supporting-statement form branch; NSW >$20M retention trust ledger; AS 4000 / AS 2124 certificate-recording variants (clause-37 / clause-42 fields) for contracts that use a superintendent's certificate rather than a SOPA schedule.

### 5.4 How it bundles with the per-lot evidence pack (B1)

The evidence pack already exists (`frontend/src/lib/pdf/claimEvidencePackagePdf.ts`; `ClaimedLot.evidencePackageUrl` / `ProgressClaim.evidencePackageUrl`). The progress-claim PDF is the **commercial cover**; the evidence pack is the **per-lot quality substantiation** that backs each schedule-of-lots line. Bundle them as the claim submission set: **[claim PDF] + [supporting statement, if NSW/QLD HC] + [per-lot evidence pack]**. The schedule-of-lots line items (§1.4) and the evidence pack are keyed on the same `ClaimedLot`/`Lot`, so a row in the claim table links 1:1 to its evidence — this is the natural cross-sell of SiteProof's quality spine into the commercial output: the claim isn't just a number, it ships with the ITP/holdpoint/test proof the superintendent needs to certify it. This is exactly why a QA platform is well-placed to own the progress claim: it already holds the substantiation.

---

## 6. Verification flags (carry into implementation)

- **AustLII + legislation.\*.gov.au returned HTTP 403 to the automated fetch tool** across NSW/QLD/VIC. Substance is corroborated by NSW/QLD Gov + 5+ law-firm sources, but **exact statutory sub-paragraph labels** (NSW s13(2)(c), s14 subsection split; QLD s67–s76 post-BIFOLA renumbering) were not re-verified verbatim. **Eyeball the consolidated Acts in a normal browser before hard-coding any endorsement string, declaration text, or section citation.**
- **Two GST-on-retention conventions exist** (§1.7) — implement net-of-retention by default, make configurable.
- **Penalty-unit dollar values are config, not constants** (NSW $110k/$22k as at the form's publication; QLD ~$161/unit in 2025–26 — periodic lookup, not hardcode).
- **Owner-occupier supporting-statement form fields not separately extracted** — pull before building that branch.
- **VIC reform date = 15 Apr 2026 (live).** Discard any source citing 1 Sept 2026.
- **QLD business-day / shutdown range** — verify the exact BIF-defined excluded range before coding the 15-BD / 25-BD / 6-month calculators.
