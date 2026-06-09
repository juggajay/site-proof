# Research findings — QA sign-off, tests & progress claims (AU civil)

_Synthesised 2026-06-09 from the deep-research run (`wf_9264cd33-499`). The run completed all searches + fetched 22 sources, and adversarially confirmed 10 claims (3-0 votes) before hitting a token limit; the remaining ~15 claims are **sourced to primary documents but were not independently re-verified** (the verifiers abstained when tokens ran out — they were not refuted). Confidence is labelled per finding._

**Legend:** ✅ = adversarially confirmed (3-0/2-0). 📄 = sourced to a primary/vendor doc, not re-verified.

---

## Pillar A — ITP completion & superintendent / hold-point sign-off

### How it works in practice (regulatory)
- ✅ **Hold Point = work must not proceed without the Principal's/Administrator's express *written* authorisation.** The contractor **submits evidence** that work is complete/tested/inspected; the Principal **considers it and authorises release**. (TfNSW G2-C2: *"a point beyond which a work process must not proceed without the Principal's express written authorisation"*; *"The Principal will consider the documents prior to authorising the release of the Hold Point."* — transport.nsw.gov.au. TMR MRTS50: *"written authorisation from the Administrator… allow at least one working day for a response."* NATSPEC NTN GEN 009.)
- ✅ **Witness Point = give prior notice (≥1 working day); the contractor may proceed once notice expires whether or not the Principal attends.** (MRTS50; NATSPEC; TfNSW G2-C2.) So witness points are *not* hard blockers like hold points.
- 📄 TfNSW R83 framing: hold/witness points sit in a formal schedule; release commonly required "within two working days of receipt of results."

**The key structural insight:** the standard model is **"contractor submits → Principal authorises in writing,"** *not* "Principal works inside the contractor's system." The authorisation is a discrete written act attributed to the Principal.

### What competitors do
- ✅ **CONQA** — sign-off requests & approvals are processed **via email, or via in-app checkpoints for remote sign-off**; the requestee gets an email notification. (conqa.com/sign-offs) → a no/low-login, request-based model.
- 📄 **CivilPro** — leans **client-login**: the client can be given an "Associate seat" with role **'Client'** and approves ITPs/inspections **themselves inside CivilPro** (also offers a PDF-offline path where the contractor records the approval). Inspection approval is an in-app "Request Approval" workflow addressed to an approver.
- 📄 **Dashpivot / Sitemate** — supports **"sign on glass" / Sign Manually** (external party signs in person on the contractor's device, no account) **and** a "Dashpivot Visitors" external user type for routed sign-off.

So the market is **split** — CivilPro = client login; CONQA/Dashpivot = email request / sign-on-glass. There is **no single industry norm**, which means a single-sided model is defensible.

### Recommendation for SiteProof (→ backlog I1)
Your gut (the **contractor completes/records the ITP**) is **consistent with the regulation** — the spec model is literally "contractor submits, Principal authorises." Keep it contractor-driven, **but the hold-point/witness sign-off must be a documented act attributed to the Principal**, because the authorisation is contractually a *written* Principal act. Concretely:
- Make the **tokenised email release-link** (which you already have) the canonical way to capture the Principal's authorisation — this mirrors CONQA's email model and Dashpivot's external path, and produces real attribution **without a client login**.
- **Reconcile the two competing paths into one source of truth** (the contractor "tick complete" vs the tokenised release) so a superintendent hold point can't be silently self-signed by the contractor with no attribution.
- **Avoid the full client-login/portal** (CivilPro's path) — it fights the single-sided thesis, and the market proves email/sign-link is a legitimate alternative.

---

## Pillar B — Tests

### How it works in practice (regulatory)
- ✅ **Testing is tied to lots and ITP points — NOT blanket per lot.** ITPs define the inspection/test points, **frequencies** and **acceptance criteria**; a **Conformance Report is prepared per lot** containing the completed inspection + test records plus analysis demonstrating compliance. (MRTS50.)
- ✅ **Compliance testing must be by NATA-accredited labs** (TMR: CMT Suppliers level 2); **NATA-endorsed reports are submitted with the lot's conformance report**, and results go to **contractor and Administrator simultaneously**. (MRTS50.)
- 📄 Frequencies are **volumetric/load-based on sub-lots**, not one-per-lot. (TfNSW R83: a sub-lot = a continuous pour ≤50 m³ slipform / 30 m³ fixed-form; escalating test frequencies, e.g. air content one per load → one per 50 m³ → one per 200 m³.) NATA-endorsed results required (fallback ISO 9001/JAS-ANZ lab only where NATA unavailable).

### What competitors do
- 📄 **CivilPro** — **derives the required testing from the ITP / lot type** (its tool "determines the appropriate testing for individual Lot Types" and calculates the number of tests), runs a **Test Request Register** linking tests to lots, with testing by third-party/NATA labs.

### Recommendation for SiteProof (→ backlog T1, T2, B2)
- **T1 is validated and important.** Conformance must **derive the test requirement from the ITP** (which items/activities need tests + at what frequency), *not* the current blanket "≥1 passing verified test on every lot." A lot whose ITP has no test points should conform without a test.
- **T2: the heavy status chain is not industry practice.** The real-world flow is: *test required by ITP → NATA cert from the lab → result checked against acceptance criteria → QM verifies.* Collapse `requested → at lab → results received → entered → verified` toward **attach NATA cert + record pass/fail (vs acceptance criteria) + QM verify**. Capture **NATA status** on the certificate.
- **B2 is on the critical path** — you must be able to **attach a certificate to an existing test** (the cert is *the* artifact, submitted with the conformance report). Without it, no test can be verified and conformance is unreachable.
- Note: CivilPro's **per-lot Conformance Report** (inspection + test records + compliance analysis) is essentially your **Evidence Package** — align the two concepts.

---

## Pillar C — Progress claim output & closing the loop (SOPA)

### How it works in practice (regulatory — NSW lens)
- 📄 **Payment claim** (NSW SOP Act s13): served on/from the last day of the named month work was first done, and each subsequent month (monthly **reference dates**) unless the contract sets earlier. Must identify the work and the claimed amount.
- 📄 **Head contractors must attach a "supporting statement"** (a declaration that subcontractors have been paid) — NSW-specific; serving a claim without it is an offence. (Piper Alderman; NSW Gov "making a payment claim".)
- 📄 **Payment schedule** (s14) = the **respondent's reply** stating the **scheduled (certified) amount** and, if less than claimed, **the reasons for withholding**. Must be served **within 10 business days** (or the contract's time); if the respondent serves none, they become **liable for the full claimed amount** on the due date.
- **State variation:** NSW = SOP Act 1999 (supporting statement). QLD = BIF Act 2017 (different mechanics). VIC reforms in train. Flag for state-specific handling later.

### What the loop looks like
Contractor **serves** claim → respondent (Principal, via superintendent) **certifies via a payment schedule** (scheduled amount + reasons) → **pays** by the due date → **adjudication** if disputed. The certifying party is always the **paying side** — never the claimant.

### Recommendation for SiteProof (→ backlog C1, C2, B1)
- **C1 is validated.** SOPA confirms the certification is the **respondent's** act (the payment schedule the contractor *receives*). So SiteProof should let the contractor **record the certification received** (scheduled amount + reasons + date), **not** have a superintendent certify in-app. For subbie→HC claims, the HC *is* the respondent → certify in-app is correct there.
- **The output artifact** the contractor needs is **not the thin CSV** — it's a **SOPA-compliant payment claim PDF**: claim/reference number, period/reference date, contract reference, a **schedule of lots/works with this-claim / previously-claimed / total**, retention, GST, the required endorsement, **+ the head-contractor supporting statement (NSW)** — bundled with the **evidence pack** (the per-lot conformance reports). Fix **B1** so that pack generates.
- **Track the SOPA clock:** service date (starts it), payment-schedule-due (10 business days NSW), payment-due. (The app already surfaces cert-due / payment-due — keep that.)
- **C2 (% claiming)** fits the monthly-progressive reality — claims are incremental against reference dates.

---

## Sources (quality per the run)
Primary: TMR MRTS50; NATSPEC NTN GEN 009; TfNSW G2-C2 & R83 QA specs; NSW SOP Act 1999 (legislation.nsw.gov.au); CONQA, CivilPro, Sitemate vendor docs; NSW Gov "making a payment claim"; Payapps. Secondary: Piper Alderman, Holding Redlich, Mastt, Compliance Council, CQA.

_Gaps to firm up if needed (resume the run after the limit reset, or targeted fetch): QLD BIF Act claim-content specifics; exact CivilPro/Dashpivot mechanics (vendor help-centres 403 direct fetches); VicRoads testing-frequency specifics._
