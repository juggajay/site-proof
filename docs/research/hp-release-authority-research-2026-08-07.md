# Hold-point release authority — who may release, conditionally release, or reject

> **Provenance.** Produced **2026-08-07** at the orchestrator's direction to
> replace a guess in `docs/plans/hp-decision-design-2026-08-07.md` (Rev 2),
> which currently models in-app rejection as "QM + superintendent-mapped
> roles" on no cited evidence. Method: a sweep of the repo's existing research
> corpus first, then three parallel primary-source research agents covering
> NSW+contracts, QLD+WA, and VIC+ISO+practice. Eleven specifications and two
> standard-form contracts were downloaded as PDFs and text-extracted; every
> quote below is from an extracted document unless graded **B** or **C**.

**Researcher:** subagent trio `hp-nsw` / `hp-qld-wa` / `hp-vic-iso`, synthesised
**Date:** 2026-08-07
**Scope:** who may authorise passage past a hold point in AU civil practice, and how a QA platform should model that authority.
**Grades:** **A** = exact quote from the primary spec/contract text. **B** = reputable secondary (government guidance, law-firm commentary, published tender pack quoting the clause). **C** = inference, vendor/blog tier, or anecdote.

---

## Verdict up front

1. **Release authority is unanimous and it is not a role in our system.** Every one of the eight Australian specifications examined vests hold-point release in the *principal's* side of the contract — "the Principal", "the Administrator", "the Superintendent", "the Authorised Person", "the contract administrator". **Not one permits the contractor's quality representative to release a specification hold point.** Grade A across the board (§1).
2. **Two classes of hold point exist, and both QLD and WA say so in near-identical words.** Specification hold points (authority releases) and *contractor-designated* hold points (the contractor nominates its own releaser in its Quality Plan). A single `releasedBy` field without a class discriminator misrepresents both. Grade A (§2).
3. **"Conditional release" is very nearly not a thing.** Zero occurrences across TfNSW Q6/D&C Q6/G2-C2/R44, TMR MRTS50/MRTS01, MRWA Spec 201/100, VicRoads §160, Austroads ATS 1120, and NATSPEC GEN 009. **One** genuine hit exists, in ACT MITS 00B. ISO has the properly-defined analogues (`concession`, `deviation permit`). Grade A negative (§3).
4. **Rejection splits the corpus down the middle.** The state road authorities (TfNSW, TMR, MRWA, VicRoads) do *not* formalise refusal — it is the absence of release. The national and guidance layer (Austroads ATS 1120, NATSPEC, ACT MITS 00B) *does*, and ATS 1120 makes giving reasons a **duty** of the releasing authority with a default 10-working-day clock. Grade A (§4).
5. **Two premises in the brief are wrong and need correcting in the design doc.** VicRoads Section 168 is Occupational Health and Safety Management, not QA. And **ISO 9001 does not define "hold point"** — the term appears nowhere in the 229 terms of the ISO/TC 176 vocabulary. Grade A (§5).

---

## 1. Who releases — the unanimous answer

| Source | Edition | Named releasing role | Written required? | Grade |
|---|---|---|---|---|
| **TfNSW Q6** Quality Management (Major Works) | Ed 2 Rev 0, Feb 2024 | **"the Principal"** | Yes — in the definition | A |
| **TfNSW D&C Q6** | Ed 2 Rev 0, Feb 2024 | **"the Principal"** (was "RMS Representative" pre-2020) | Yes | A |
| **TfNSW G2-C2** (TS 01566) General Requirements | Ed 5 Rev 26 | **"the Principal"** | Yes — "**express** written" | A |
| **TMR MRTS50** Specific Quality System Requirements | March 2025 | **"the Administrator"** | Yes | A |
| **TMR MRTS01** Introduction to Technical Specifications | March 2025 | **"the Administrator"** | Silent (MRTS50 governs — see below) | A |
| **MRWA Specification 201** Quality Management | issued 13/10/2025 | **"the Superintendent"** | Yes — in the definition | A |
| **VicRoads Section 160** Construction – General | © June 2017 | **"the Superintendent"** | **Not stated** | A |
| **Austroads ATS 1120** Quality Management Requirements | Ed 1.0, May 2021 | **"the Principal's authorised person"** — a *person* | Not stated; recording required | A |
| **ACT MITS 00B** Quality (Construction) | Ed 1 Rev 1, July 2025 | **"the Authorised Person"** | Yes — "signed authorisation to proceed" | A |
| **NATSPEC TECHnote GEN 009** | April 2019 | **"the contract administrator"** | Not stated | A |
| **AS 4000-1997** | incl. Amdt 1–3 | **No hold point concept exists** | cl 30.2 covering-up needs "prior written direction" | A |
| **GC21** Edition 2 | © NSW Govt 2020 | **No hold point concept exists** | cl 11.2 — writing, or oral confirmed in 3 Business Days | A |
| **ISO 9001:2015** cl 8.6 | 2015 | "a **relevant authority**" | Documented info incl. "traceability to the person(s) authorizing the release" | B |

### The definitions, verbatim

**TfNSW Q6 Ed 2, cl 1.3.1** —
> "**Hold Point** — A point beyond which a work process must not proceed without the Principal's written authorisation."

and cl 1.2.3 —
> "Do not proceed beyond a HOLD POINT until the Principal has released that HOLD POINT. Make suitable arrangements to notify the Principal when a HOLD POINT will be reached."

The superseded Q6 Ed 1 Rev 12 (cl 1.4) and the current G2-C2 Ed 5 Rev 26 (cl 1.2.8) both say "**express** written authorisation". Q6 Ed 2 dropped "express" in 2024; G2-C2 retains it. **Both are current documents — that is a live inconsistency in the TfNSW suite**, worth not over-reading either way.

**TMR MRTS50 cl 8.3.2** —
> "Hold Point means an identified point in a process beyond which the Contractor shall not proceed without written authorisation from the Administrator authorising release of the Hold Point."

**MRWA Specification 201 cl 201.03** —
> "**Hold Point** — That stage in the process of delivering work under the Contract, beyond which the Contractor must not proceed to the next activity **without the written approval of the Superintendent**."

**VicRoads Section 160 cl 160.A2** —
> "**Hold Point** means those points beyond which the stated activity must not proceed without the Superintendent's approval to proceed. The Superintendent's approval to proceed beyond the Hold Point does not relieve the Contractor of responsibility for satisfactory execution or performance of the work."

**Austroads ATS 1120** — the only spec that spells out delegation to an individual —
> "**The Principal will authorise a person to release a Hold Point.**"

with every subsequent obligation attaching to "the Principal's authorised person".

**ACT MITS 00B cl 1.1.5.2** — the only source that enumerates the equivalent titles —
> "**Authorised Person:** The Authorised Person is the person or body responsible for administering the Works Contract and has the same meaning as **Contract Administrator, Principal's representative, Principal's Authorised Person (PAP), Superintendent or equivalent**."

### The contractor's quality representative never releases

This is worth stating flatly because it is the single most load-bearing finding for the design.

- **TfNSW Q6 cl 3.1.1** gives the Project Quality Representative authority "to stop work over quality related issues" — a *stop* power, never a release power. Grade A.
- **MRWA Spec 201** defines the Quality Management Representative (cl 201.03) as "accountable for ensuring that the requirements of this specification are fulfilled" and gives it **no release authority anywhere in the spec**. Grade A.
- **VicRoads cl 160.A3** — the QMR "shall … manage and administer the Contractor's Quality Management System". No release authority. Grade A.
- **Austroads ATS 1120** — "The Quality Management Representative must be satisfied that the Contractor's work fully complies with the requirements of the Contract **before seeking release** of the Hold Point." The contractor's rep gates the *request*, never the release. Grade A.
- **ACT MITS 00B Annexure B** — the NCR proforma is a four-signature state machine and the order is fixed: *Principal: Approved ☐ Rejected ☐* → *Disposition completed (Contractor)* → **Release of Hold point (Authorised Person)** → *Close out of NCR (Contractor's QMR)*. The contractor's QMR signs only the close-out, after release. Grade A.
- **AS 4000 cl 29.2** states the point at contract level: "Any such quality system shall be used only as an aid to achieving compliance with the Contract and to document such compliance. Such system shall not discharge the Contractor's other obligations under the Contract." Grade A.

### Witness points are not released at all

The corpus is consistent and it matters, because modelling a witness point as "released by the contractor's QA rep" would be wrong.

**TMR MRTS50 cl 8.3.3** —
> "the Contractor shall give the Administrator notice of at least one working day of an approaching Witness Point but may proceed with the activity when the period of notice has expired **whether or not the Administrator elects to witness the activity**."

**Austroads ATS 1120** —
> "**The Contractor may proceed with the activity when the period of notice has expired, regardless of whether or not the authorised person elects to witness the activity.**"

**NATSPEC GEN 009** — "The contractor is required to notify the contract administrator who may or may not take the opportunity. **The subsequent activity however, may proceed.**"

A witness point is released by **the expiry of a notice period**, not by a party. There is no release event and no releaser. (Note: **VicRoads Section 160 has no witness point concept at all** — zero occurrences. Grade A negative.)

---

## 2. Contractor-designated hold points — the second class

Both QLD and WA carve out an explicit second class in near-identical wording, and this is the *only* route by which anyone on the contractor's side legitimately releases anything.

**TMR MRTS50 cl 8.3.2, final paragraph** —
> "**Hold Points specified in the Contract are those required by the Principal. The Contractor may designate additional Hold Points in the Contractor's Quality Plan and nominate a person responsible for authorisation of continuation past those points.**"

**MRWA Specification 201 cl 201.06.03(2)** —
> "**The Specifications identify a number of Hold Points required by the Principal. The Contractor may designate additional hold points in the QMP and nominate a person responsible for authorisation of continuation past those points.**"

Grade A both. The nominated releaser is named in the Quality Plan — again an *identified person*, not a role.

**Delegation on the authority's side is likewise person-shaped, and must be notified.** TMR's Contract Administration System Manual, procedure **CAP001M** (September 2025), is explicit:

> "**The responsibility for the release of the mandatory hold points is usually delegated to site staff** during the development of the Administrator's Surveillance Plan (CAF001M)."
> "**The delegated authority for the release of hold points shall be notified to the Contractor** by Summary of Release Letters for Standard Specification Hold Points (**CAF014M**) and **Notice of Appointment of Inspector (CAL022M)**."

Grade A. So in QLD a release signed by a person whose delegation was never notified to the contractor is contractually defective. **AS 4000 cl 21** imposes the same discipline at contract level — delegation requires "written notice of… the appointment, including the Superintendent's Representative's name and delegated functions", and the Contractor may reasonably object. Grade A.

**GC21 cl 2.3 is the sharpest role-model statement in the corpus** and cuts the other way on impartiality —
> "**The Principal's Authorised Person does not act as an independent certifier, assessor or Valuer. The Principal's Authorised Person acts only as an agent of the Principal.**"

GC21 (which pairs with TfNSW G2-C2/Q6) deliberately abolishes the AS 4000/AS 2124 impartial-Superintendent construct. Grade A. So "the Principal" who releases a TfNSW hold point is operationally the PAP acting as the Principal's agent, with no impartiality duty attached.

---

## 3. Conditional release — one hit in eleven specifications

### The negative finding

**Zero occurrences** of "conditional release", "conditionally release", "release with conditions", "qualified release", or "approval subject to" in:

- TfNSW Q6 Ed 2, D&C Q6 Ed 2, Q6 Ed 1 Rev 12, G2-C2 Ed 5 Rev 26, R44 Ed 3 Rev 15
- TMR MRTS50 (Mar 2025), MRTS01 (Mar 2025), CAP001M (Sep 2025)
- MRWA Specification 201 (13/10/2025), Specification 100 (9/11/2023)
- VicRoads Section 160 (Jun 2017) — also zero for "concession", "deviation", "conditional"
- Austroads ATS 1120 Ed 1.0 — also zero for "concession", "deviation permit"
- NATSPEC TECHnote GEN 009

Grade A negative, verified by full-text search of extracted documents in all three research streams independently.

### The one hit

**ACT MITS 00B cl 1.2.7.1** —
> "**Witness point:** If the Hold point has resulted from an NCR or NNC, **the Authorised Person's approval may be conditional on a Witness point being included.**"

Grade A. It is not a defined term and has no form field, but it is an express contemplation of approval granted subject to a condition — and note *what* the condition is: a **downgrade of the released hold point into a witness point on the follow-on work**. That is a specific, mechanical condition, not free text.

### The properly-defined international analogues

ISO 9000:2015 defines the two concepts the road specs lack, and splits them cleanly by timing. Grade A for the definition text (ISO/TC 176 official committee terms listing, V1, 29 Sep 2022), A/B for clause numbers.

> **concession — 3.12.5:** "permission to use or release a product or service that does not conform to specified requirements. Note 1 to entry: A concession is generally limited to the delivery of products and services that have nonconforming characteristics within specified limits and is generally given for a limited quantity of products and services or period of time, and for a specific use."

> **deviation permit — 3.12.6:** "permission to depart from the originally specified requirements of a product or service **prior to its realization**."

> **release — 3.12.7:** "permission to proceed to the next stage of a process or the next process."

ISO 9000's `release` is *literally* the hold-point release, in ISO words. The conditional flavours are:

| | Timing | ISO term |
|---|---|---|
| Permission before the work is done, to depart from spec | pre-realization | **deviation permit** (3.12.6) |
| Permission after nonconforming work exists, to use/release it anyway | post-realization | **concession** (3.12.5) |

Both carry the same scoping note — "a limited quantity … or period of time, and for a specific use". That bounded-scope discipline is exactly what an in-app conditional release should inherit.

**ISO 9001:2015 cl 8.7.1(d)** puts conditional acceptance in the nonconformance clause, not the release clause: "obtaining authorization for acceptance under concession". And **cl 8.7.2** requires retained information that "describes any concessions obtained" and "identifies the authority deciding the action in respect of the nonconformity". Grade B (paywalled full text, reproduced from reputable secondary).

### The standard-form contracts know how to say it, and pointedly don't say it about quality

**AS 4000-1997** uses conditional approval freely — cl 9.2 ("Approval may be conditional upon the subcontract including…"), cl 32 ("may approve the suspension and may impose conditions of approval"), cl 36.3 ("The direction shall be written and may be conditional"). It says nothing of the kind in cl 29 (defective work) or cl 30 (examination and testing). Grade A. That absence reads as a drafting choice, not an oversight.

**GC21 cl 46 "Acceptance with Defects not made good"** is the nearest GC21 analogue and it is **bilateral**, not a unilateral conditional release —
> ".1 The Principal, in its absolute discretion, may agree that specific Defects need not be made good.
> .2 Before the Principal does so, the Principal may propose deductions from the Contract Price and any terms it requires. …
> .5 **If the parties do not agree in writing on the Principal's proposed terms, the Contractor must make good the specified Defects.**"

Grade A. The Principal proposes terms and a price deduction; the Contractor must agree; it becomes a written agreement; failure to agree snaps back to full rectification.

### The nearest true spec analogue: TMR Indicative Conformance

**TMR MRTS50 cl 10.1.2** is the closest thing in any Australian road spec to "proceed now, conformance pending", and it is directly relevant to the design's claim (c) —

> "The Administrator may approve the use of Indicative Conformance procedures for testing and/or analysis. An Indicative Conformance report for the construction lot may be submitted before the listed testing and/or analysis is carried out."
> "The purpose of Indicative Conformance is to allow work to progress prior to the minimum timeframes required for testing and/or analysis to demonstrate conformance."
> Each report shall contain "a) a statement acknowledging that test results are not yet available for confirmation of conformance, and b) **a statement accepting risk of rework upon conformance reporting**."
> "Notwithstanding Indicative Conformance being achieved, the lot shall still be subject to rework should it subsequently fail to comply with the specified requirements."

Grade A. Note the bounds: it is scoped to six named test types (road roughness, degree of saturation, general earthworks moisture, concrete slump/spread/strength, stabilised pavement strength, asphalt in-situ air voids), it requires an explicit contractor acknowledgement that conformance is unconfirmed, and it carries an explicit acceptance of rework risk.

### Market precedent — CivilPro ships it

Per the repo's own teardown (`docs/research/civilpro-teardown-2026-08-06/itp-holdpoints-tests.md:220-232`, `:642`), CivilPro's approver action set on a hold-point approval is **Approve / Conditionally Approve / Rejected / Request NCR**, where:

> "| Conditionally Approve | work continues pending closeout (e.g. 28-day test); reveals `Days to Complete Next Step`; **comments mandatory, minimum 25 characters** |"

Grade A (repo research, already graded). Their conditional approve is *exactly* the Indicative Conformance shape — work continues, a named condition closes later, and a due-date field is revealed. The 25-character minimum comment on Conditional and Reject is called out in the teardown as "a small, sharp anti-lazy-rejection control".

---

## 4. Rejection — formalised in half the corpus

### Not formalised (refusal = absence of release)

- **TfNSW.** No rejection notice, no refusal instrument anywhere in Q6 / D&C Q6 / G2-C2 / R44. What *is* formalised runs the other way — the Principal's power to *create* a hold point via a **Nonconforming Product Notification** (cl 3.12.3) or a **Corrective Action Request** (cl 3.15.1, "may apply a Hold Point on the relevant process"). The only true rejection power found is over a *Lot*: cl 5.4, "The Principal may reject a Lot that is non-homogeneous…". Grade A.
- **TMR.** No rejection notice, no refusal procedure in MRTS50. "Rejection of work" appears only as a *purpose of lotting* (cl 7.1(d)). Grade A.
- **MRWA.** The words "reject" and "refuse" do not appear in Specification 201 at all. Grade A.
- **VicRoads §160.** Zero occurrences of "reject"/"rejection". Refusal is purely absence of approval — the activity "must not proceed". Grade A.

### Formalised — and note that the duty sits on the releaser

**Austroads ATS 1120** is the strongest and most product-relevant statement in the entire corpus:

> "The timeframe for the Contractor to notify the Principal that a Hold Point will be reached is specified in each Austroads Technical Specification. This timeframe commences when all information demonstrating compliance with the Hold Point release requirements has been provided in an appropriate format to the Principal's authorised person. **Within that timeframe, the Principal's authorised person must either: release the Hold Point; or provide reasons why the Hold Point will not be released, including details of any non-conformance.**"
> "**If a time to assess and release a Hold Point has not been specified in the Contract, the time is deemed to be 10 working days.**"

Grade A. Refusal-with-reasons is a **duty of the same person who releases**, discharged within the same clock. There is no separate, narrower rejecting party.

ATS 1120 also states what happens if the contractor jumps the gate:
> "**No Waiver** — If the Contractor continues the work prior to the release of an applicable Hold Point: any such work is entirely at the Contractor's risk and does not constitute a waiver of the right not to release the Hold Point; and at the Contractor's expense … the Principal may require the removal of any part of the Works for the purpose of testing, inspection or measurement."

**ACT MITS 00B** formalises it as a form field — Annexure B carries "Principal: Approved ☐ Rejected ☐ / Comment: / Principal signature: / Date:" — and distinguishes two instruments by consequence (cl 1.2.9.3):
> "**CAR (corrective action request):** Issued by the Authorised Person for non-conformance to the Contractor's quality system or methods. **Unless specifically stated, this will not create a Hold point.**"
> "**NNC:** Issued by the Authorised Person for product non-conformance. **This will immediately create a Hold point** and the Contractor is required to submit an NCR."

Grade A.

**NATSPEC GEN 009** names the direction of each instrument, which is the cleanest modelling distinction available:
> "**Non-conformance report (NCR):** A mandatory (standard format) submission by the contractor…"
> "**Notice of non-conformance (NNC):** Formal instruction to the contractor of product non-conformance… **It automatically creates a Hold Point** and requires a non-conformance report (NCR) from the contractor."
> "**Corrective action request (CAR):** A formal advice/instruction to the contractor requesting action to eliminate the cause of a detected nonconformity."

Grade A. **NCR flows contractor → authority. NNC and CAR flow authority → contractor.** The authority's rejection artefact is an NNC, not an NCR.

**AS 4000** makes rejection a species of contractual act by definition (cl 1): *direction* "includes agreement, approval, assessment, authorisation, certificate, decision, demand, determination, explanation, instruction, notice, order, permission, **rejection**, request or requirement". So a refusal inherits the direction machinery, including written confirmation (cl 20) and the dispute right at cl 42.1(a). Grade A.

**GC21** formalises it as a **Defect Notice** (cl 45.2) with a specified rectification time and a step-in remedy. Grade A.

### Nonconformance creates hold points — universally

Every source that addresses it says the same thing, and it is the single most consistent structural rule in the corpus:

| Source | Clause | Effect |
|---|---|---|
| TfNSW Q6 | 3.15.1 | Principal "may apply a Hold Point on the relevant process" with a CAR |
| TMR MRTS50 | 8.3.2(b)(c), 10.2 | Hold points apply "on issue of a Nonconformance Report, or on issue of a corrective action request" |
| MRWA Spec 201 | 201.10(2) | "**All detected non-conformance must constitute a Hold Point**… reported within 24 hours" |
| VicRoads §160 | 160.A6 | "**a Hold Point is automatically created** and the activity shall not proceed without the Superintendent's approval" |
| Austroads ATS 1120 | — | "The identification of a product related Nonconformity and the subsequent issue of a Non-conformance Report or Corrective Action Request **constitutes a Hold Point**" |
| NATSPEC GEN 009 | — | "The issue of a Non-conformance report or a Notice of non-conformance **automatically creates a Hold point**" |
| ACT MITS 00B | 1.1.5.2, 1.2.9.2 | NNC "automatically creates a Hold point"; NCR "Generates an automatic Hold point until conformance has been achieved" |

Grade A, seven independent sources.

**And release of an NCR-derived hold point is gated on accepting the disposition.** ATS 1120: "**Release of the Hold Point is subject to the Principal's acceptance of the Contractor's proposed disposition.**" TMR MRTS50 cl 8.3.2 adds that for NCR-derived hold points the Contractor "shall demonstrate amendments to its Quality System to prevent recurrence". MRWA 201.06.03(4)(d) says the same. Grade A.

---

## 5. Two corrections to premises in the design brief

### 5.1 VicRoads "Section 160/168" — 168 is not QA

**Section 168 is "Occupational Health and Safety Management"** (© Department of Transport, July 2022; cl 168.02 General, 168.03 Health and Safety Co-ordination Plan, 168.04 Risk/Hazard Assessments). It contains no hold-point provisions. Grade A.

The QA content lives in **Section 160 "Construction – General", Part A – Management Systems (cl 160.A1–A9)** — note the section is *not* titled "Quality Assurance", and no section in the VicRoads 160–177 range is. The testing sections are 170 and 173. Grade A (verified against the official `IndexStandardSections.doc`).

**Operational warning:** the live host `webapps.vicroads.vic.gov.au` **no longer resolves in DNS**. Every VicRoads specification link returned by search engines is dead; the Wayback Machine is currently the only working route. Any VicRoads citation the product ships needs an archived URL or a fresh source from the DTP portal (https://www.vic.gov.au/dtp-technical-publications). Grade A.

### 5.2 "ISO 9001 hold-point definitions" — there are none

**"Hold point" appears zero times in the ISO quality-management vocabulary.** Verified against *The Terms and Definitions of ISO/TC 176 Standards* (ISO/TC 176/SC 1, V1, 29 Sep 2022), which reproduces the ISO Online Browsing Platform entries for ISO 9000:2015 plus the post-2015 revisions of ISO 10005, 10007, 10001–10008, 10014–10015 — **229 terms, zero hits** for "hold point" and zero for "witness point". The single occurrence of "witness" is unrelated (inside the definition of *observer*). Grade A.

ISO 10005:2018 (Quality plans) — the standard most likely to carry the term — defines only two terms of its own (3.1 documented information, 3.2 quality plan) and neither is a hold point. Grade A for the terms clause; the body of clauses 6–7 is paywalled and **unverified** for incidental prose mentions.

**The correct linkage is the one Austroads itself makes.** ATS 1120 heads its Hold Point clause "(refer AS/NZS ISO 9001 Clause 8.6)" and its Non-Conformance clause "(Refer AS/NZS ISO 9001 Clause 8.7)". So: hold points *implement* ISO 9001 cl 8.6 (release of products and services); hold-point nonconformities implement cl 8.7 (control of nonconforming outputs). ISO 9001 cl 8.6 reads, in relevant part (Grade B, paywalled — reproduced from reputable secondary):

> "The release of products and services to the customer shall not proceed until the planned arrangements have been satisfactorily completed, **unless otherwise approved by a relevant authority** and, as applicable, by the customer. The organization shall retain documented information on the release … including: a) evidence of conformity with the acceptance criteria; b) **traceability to the person(s) authorizing the release**."

Never write "ISO 9001 defines a hold point as…" in product copy or spec text. It does not.

---

## 6. Notice periods — per-hold-point, never global

This was not the brief's question but it falls out of the same clauses and contradicts any global-setting design.

| Source | Hold point | Witness point |
|---|---|---|
| TfNSW Q6 | None fixed — pushed to the ITP (cl 3.8.2(c): "the time constraints for submission to the Principal for their release") | Same |
| TfNSW G2-C2 / R44 | Per-clause, inside the *Submission Details* field — e.g. "at least seven (7) days prior" (G2-C2 cl 14.2); "**at least 3 working days** before the work is programmed to be covered up" (R44 cl 7.4.2) | "at least 3 working days prior" (R44 cl 7.3); "**at least 1 working day's notice**" (R44 cl 7.4.1) |
| TMR MRTS50 | Contractor allows **≥1 working day** for the Administrator's response after full submission (cl 8.3.2) | **≥1 working day** (cl 8.3.3) |
| MRWA Spec 201 | Contractor requests **≥24 hours** ahead of the next activity (cl 201.06.03(5)) — "or such other period detailed in the relevant Specification" | **24 hours** (definition) |
| VicRoads §160 | **24 hours** notice of testing/inspection (cl 160.E5(c)) | n/a — no witness points |
| ACT MITS 00B | **24 hours**, "unless some alternative arrangements have been agreed" (cl 1.2.7.1(d)) | "after notification of the requirement" |
| Austroads ATS 1120 | Per-specification; **default 10 working days** for the authority to assess and release | ≥1 working day if unspecified |
| AS 4000 / GC21 | n/a | "reasonable notice", no number |

MRWA's own drafting guideline for spec authors says it outright: "**Unless otherwise stated, a minimum of 24 hours' notice is usually required** for the release of a Hold Point by the Superintendent" — and MRWA Spec 100's revision register records a 21/09/2020 change specifically to per-clause "Notice Period for the release of Hold Points". Grade A. **Store the notice period on the hold point, not as a global constant.** CIVOS already does this correctly per the Wave E spec (`hpMinimumNoticeDays ?? holdPointMinimumNoticeDays ?? 1`, `validation.ts:81-83`) — that is a per-project default with a per-hold-point path, which matches.

### The three-field TfNSW block

Verbatim-consistent across Q6, D&C Q6, G2-C2 and R44, and worth mirroring in the data model:

```
HOLD POINT
  Process Held:          <what stops>
  Submission Details:    <what the contractor must submit + the notice period>
  Release of Hold Point: <what the Principal will do before authorising>
```

Witness points use `Process Witnessed:` + `Submission Details:` and have **no third field** — because there is nothing to release. Grade A.

---

## 7. Answers to the four product questions

### (a) Per-project designated authority (named users/emails) vs role-based sets — **designated authority, and the question contains a category error**

**Answer: designated authority, keyed on identity, per project. Role-based sets cannot model this at all.**

The releasing party is *external to the contractor*. CIVOS's user roles (`owner`, `admin`, `project_manager`, `quality_manager`, …) all describe people inside the contractor's company. **No mapping from a CIVOS role to "the Superintendent" can ever be correct**, because the Superintendent is not our customer's employee — they are the principal's representative on the other side of the contract. Grade A, from the unanimity in §1.

The evidence for identity-keyed designation is direct:

- **Austroads ATS 1120** (Grade A): "The Principal will authorise **a person** to release a Hold Point."
- **TMR CAP001M** (Grade A): delegation "shall be notified to the Contractor" by CAF014M + CAL022M — the delegation is only valid once the *contractor has been told which named person holds it*.
- **AS 4000 cl 21** (Grade A): delegation requires written notice of "the Superintendent's Representative's **name** and delegated functions", and the Contractor may reasonably object to the appointment.
- **ISO 9001 cl 8.6** (Grade B): retained documented information must include "traceability to the **person(s)** authorizing the release".

**This vindicates the shape CIVOS already ships.** `HoldPointReleaseToken` carries `recipientEmail` / `recipientName`, the release is signed, and the audit actor is `{ kind: 'external_token', tokenId, label: recipientName }` with IP and user-agent (per `docs/plans/wave-e-approvals-spec-2026-07-28.md:225-228`). That is an identity-keyed external authority with traceability — exactly what ATS 1120 and ISO 8.6 ask for. The no-account link is also the market-adopted pattern (CivilPro, holdpoint.co — Grade B, `CIVOS-Research-Appendix-2026-07-24.md` §D).

**But the model needs a second class, and CIVOS does not have one.** TMR MRTS50 cl 8.3.2 and MRWA cl 201.06.03(2) both allow the contractor to designate *additional* hold points and nominate its own internal releaser. For that class — and only that class — an internal CIVOS user releasing is correct and spec-backed. Grade A.

**Recommended shape:**

| Class | Who releases | How modelled |
|---|---|---|
| **Specification / Principal hold point** (the default) | The authority's designated person | Per-project designated authority: name + email, optionally with the delegation reference (CAF014M-equivalent). Released via external token, as today. |
| **Contractor-designated hold point** | The person nominated in the contractor's Quality Plan | An internal CIVOS user, nominated per project. Role gates *eligibility to be nominated*; the nomination is the authority. |

A single `releasedBy` with no class discriminator misrepresents both — it either implies the contractor released a principal hold point (contractually false) or forces an external token onto a purely internal gate (friction for no reason). Recording the class is also what makes the release record defensible: TMR CAP001M expressly permits a contractor-system release form provided "all the requirements of the hold point listed in the applicable standard specification are clearly addressed and recorded on the form before granting authorisation to proceed" (Grade A) — a completeness bar that is a product feature, not a legal obstacle.

### (b) Should in-app reject be narrower than in-app release — **no. Same set. The design's guess is unsupported.**

**Answer: reject must be the same authority set as release, not narrower.** The design's current "QM + superintendent-mapped roles" is wrong on both halves.

- **Not narrower.** In the only spec that formalises refusal as an act, refusal is a **duty of the releaser**, discharged in the same clock: ATS 1120 — "the Principal's authorised person must either: release the Hold Point; or provide reasons why the Hold Point will not be released". Grade A. No source in the corpus gives rejection to a narrower party than release. Making reject harder than release inverts the spec: it would make the *lenient* action easier than the *strict* one.
- **Not the QM.** The contractor's quality manager cannot reject a principal hold point any more than they can release one — same category error as (a). Grade A from §1.
- **"Superintendent-mapped roles" is the category error again.** There is no CIVOS role that maps to the superintendent. Grade A.

What the contractor's QM legitimately *can* do is a different action that the design should name separately: **withdraw or recall the release request**. ATS 1120 puts this squarely on the contractor side — "The Quality Management Representative must be satisfied that the Contractor's work fully complies with the requirements of the Contract **before seeking release**" — and MRWA cl 201.06.03(6) makes the request itself the contractor's **"Certificate of Compliance"** (Grade A). If the internal QM realises the certification was premature, the correct act is to pull the request back, not to reject it. That is an internal, role-gated action; rejection is not.

**Two further constraints on the reject artefact:**

1. **Reasons are mandatory, not optional.** ATS 1120: "including details of any non-conformance". ACT MITS 00B's form has a Comment field beside the Rejected checkbox. CivilPro enforces a 25-character minimum on reject (Grade A, repo teardown). A free-text-optional reject would be weaker than both the spec and the incumbent.
2. **Rejected should not be a terminal hold-point state.** Seven independent sources say a nonconformance *creates* a hold point (§4). The spec-accurate model is: **the hold point stays unreleased, an NCR/NNC opens, and closure of that nonconformance is a precondition of the eventual release.** A terminal `rejected` status contradicts every one of them. This also lines up with the existing product: CivilPro's approver can "Request NCR from inside the approval" (Grade A), and CIVOS already has an NCR module to route into.

### (c) Does any spec support "conditional release withholds verification/conformance until conditions close"? — **partially, and the framing needs correcting**

**Answer: the underlying instinct is right and there is one good spec analogue, but the stated premise is subtly wrong, because release never conferred conformance in the first place.**

**The framing error.** Every source that addresses it says release ≠ conformance:

- **VicRoads cl 160.A2** (Grade A): "The Superintendent's approval to proceed beyond the Hold Point **does not relieve the Contractor of responsibility for satisfactory execution or performance of the work**."
- **Austroads ATS 1120** (Grade A): "Release of a Hold Point entitles the Contractor to proceed to the next stage of a process, **but does not relieve the Contractor of any of its obligations under this Contract**."
- **ISO 9000:2015 3.12.7** (Grade A): release is "permission to proceed to the next stage of a process" — nothing about conformity.

So a design that says *conditional* release withholds conformance implies that *unconditional* release grants it. It does not, and shipping that implication would be a real correctness bug in the evidence chain. Conformance is established by the conformance report against the lot, on its own track. **Restate the rule as: no release of any kind establishes conformance; a conditional release additionally blocks the lot from advancing until its conditions close.**

**The supporting analogue — strong.** TMR MRTS50 cl 10.1.2 Indicative Conformance is the same semantics in spec language (Grade A, quoted in §3): work progresses before the test results exist, the report must carry "a statement acknowledging that test results are not yet available for confirmation of conformance", the contractor accepts rework risk, and "the lot shall still be subject to rework should it subsequently fail". That is precisely *proceed now, conformance pending, condition closes later* — and it is bounded to six named test types rather than free-form.

**The other analogue — different mechanism.** ACT MITS 00B cl 1.2.7.1's conditional approval imposes a **witness point on the follow-on work**. It adds a future gate rather than withholding a present determination. Worth knowing, but it does not support the design's claim directly.

**The contradictions — two, and both are real.**

1. **MRWA blocks it structurally.** Spec 201 cl 201.06.03(4)(a)–(b) (Grade A) requires that the contractor submit conformance reports for "any underlying Lot(s) or any adjacent Lot(s) affected", and that all such lots "**must be conforming**", before release. In WA you cannot release with conformance outstanding on the prerequisite graph — the conformance determination precedes release rather than following it. Note this is also a graph dependency (underlying *and adjacent affected* lots), which QLD has no equivalent of.
2. **MRWA hard-codes no-concession for some lots.** Spec 201 cl 201.10(4) (Grade A): "Any earthworks or pavement Lot with non-conforming in situ density **shall be fully reworked**, except where the Contract otherwise requires the Lot to be removed." There is no accept-at-a-discount path at all for that case.

**Verdict on (c):** build it, but label it honestly. Conditional release is a **CIVOS product convention**, not a spec-mandated state — the phrase appears in zero of eleven specifications. It is defensible because (i) TMR's Indicative Conformance is the same shape in spec language, (ii) ISO gives it properly-defined bounds via `concession` and `deviation permit`, and (iii) CivilPro ships it, so the market recognises the control. Inherit ISO's discipline: a conditional release should be scoped — a stated condition, a closure date (CivilPro's `Days to Complete Next Step`), and a mandatory reason. Do not present the phrase as spec-derived language in product copy or ITP output.

### (d) Grades

Every claim above carries its grade in place. Summary of the load-bearing ones:

| Claim | Grade | Basis |
|---|---|---|
| Release authority is the principal's side in all 8 AU specs examined | **A** | Exact definition quotes, 8 primary documents |
| Contractor's quality rep may never release a specification hold point | **A** | Q6 3.1.1, MRWA 201.03, VicRoads 160.A3, ATS 1120, MITS 00B Annexure B, AS 4000 29.2 |
| Contractor may designate additional hold points with its own nominated releaser | **A** | MRTS50 8.3.2, MRWA 201.06.03(2) — near-identical wording |
| Release authority is delegated to a *named person*, and delegation must be notified | **A** | ATS 1120; TMR CAP001M (CAF014M + CAL022M); AS 4000 cl 21 |
| "Conditional release" is absent from all 11 specs checked | **A** (negative) | Full-text search of extracted PDFs, three independent research streams |
| ACT MITS 00B 1.2.7.1 is the sole conditional-approval clause found | **A** | Exact quote |
| ISO defines `concession` (3.12.5) and `deviation permit` (3.12.6) | **A** | ISO/TC 176 official terms listing |
| ISO 9001/9000/10005 do not define "hold point" | **A** (negative) | 229-term ISO/TC 176 listing, zero hits |
| Rejection not formalised in TfNSW / TMR / MRWA / VicRoads | **A** (negative) | Zero occurrences of reject/refuse instruments |
| Rejection formalised in ATS 1120 / MITS 00B / NATSPEC / AS 4000 / GC21 | **A** | Exact quotes, incl. ATS 1120's must-give-reasons duty and 10-working-day default |
| Nonconformance creates a hold point | **A** | 7 independent sources |
| Release does not confer conformance | **A** | VicRoads 160.A2, ATS 1120, ISO 9000 3.12.7 |
| TMR Indicative Conformance is the nearest spec analogue to conditional release | **A** | MRTS50 10.1.2, exact quote |
| VicRoads §168 is OH&S, not QA | **A** | Section text + official index |
| CivilPro ships Approve / Conditionally Approve / Reject / Request NCR | **A** | Repo teardown, already graded |
| ISO 9001 cl 8.6 / 8.7 text | **B** | Paywalled standard; reproduced from three corroborating secondary sources |
| AS 2124-1992 clause 23 content | **B** | Primary text NOT FOUND; law-firm commentary only, and sources disagree on whether limb (a) reads "impartially" or "fairly" — **do not rely on the exact wording** |
| AS 2124 has no hold-point concept | **C** | Structural inference from AS 4000 only. **Unverified — do not rely on.** |
| Signature-authority matrix at mobilisation is common practice | **C** | Vendor/blog tier only |
| Good-faith duty constrains arbitrary hold-point refusal | **C** | Inference from *Thiess v MCC Mining* (NSWCA 2011) superintendent-duty line; **no authority found applying it to hold points specifically** |

---

## 8. Explicit "not found" statements

Recorded so they are not re-researched.

- **No published MRWA hold-point release proforma.** Spec 201 names the artefact — a written "Hold Point Release" request, quotation marks in the original — but publishes no numbered form. Searched: MRWA site, technical library, tender-preparation templates. Under cl 201.06.03(3) the release *methodology* is whatever the contractor details in its QMP, so in WA the release form is contractor-supplied **by design**.
- **No release proforma in TfNSW Q6 either.** Q6 cl 3.8.1(f) instead requires the Project Quality Plan to state the "method of arranging for release of HOLD POINTS by the Principal (including that for work carried out by subcontractors)".
- **TMR's CAS standard-forms index page returns HTTP 403** to automated fetch (WebFetch and curl with browser UA). Form numbers/titles are quoted from CAP001M itself so they remain Grade A, but the CAF014M form's field layout was not retrieved. Needs a manual browser fetch if the layout matters.
- **AS 2124-1992 primary text NOT FOUND.** Standards Australia paywalls it; four targeted searches for full-text copies returned only a TOC preview. Its hold-point / conditional-release / rejection content is **unverified**.
- **ISO 10005:2018 clauses 6–7 body text unverified.** The free ISO sample terminates at page 4. Verified at Grade A: hold point is not a *defined term* anywhere in it.
- **No Australian case law or legal commentary found on a superintendent refusing to release a hold point specifically.** General AS 4000 superintendent-duty commentary exists; nothing applies it to hold points.
- **"Conditional release" as an Australian ITP practice term: NOT FOUND.** Targeted searches surfaced only vendor/blog content and unrelated NSW criminal-law Conditional Release Orders.
- **QLD "concession provisions for below standard work"** is named as a lotting purpose (MRTS50 cl 7.1(e)) but **is not defined anywhere in MRTS50** — it lives in the contract/measurement specifications, which were not pulled. That is the thread to follow if the product ever models accept-at-reduced-payment.
- **VicRoads live specification host is dead** (`webapps.vicroads.vic.gov.au` does not resolve). All citations here use Wayback archives.

---

## 9. Sources

**Primary specifications**

- TfNSW QA Specification Q6 — Quality Management (Major Works), Ed 2 Rev 0, Feb 2024 (TS 01572.1) — https://standards.transport.nsw.gov.au/_entity/annotation/d7d76f7e-d6c3-ee11-9079-000d3ad2920b
- TfNSW Specification D&C Q6 — Quality Management (Major Works), Ed 2 Rev 0, Feb 2024 (TS 01572.2) — https://standards.transport.nsw.gov.au/_entity/annotation/af4f56e6-e0c3-ee11-9079-000d3ad2920b
- TfNSW QA Specification Q6 — Quality Management System (Type 6), Ed 1 Rev 12, SUPERSEDED — https://standards.transport.nsw.gov.au/_entity/annotation/ddc19f14-b035-ed11-9db2-000d3ae019e0
- TfNSW QA Specification TS 01566 (G2-C2) — General Requirements (Major Contracts), Ed 5 Rev 26 — https://standards.transport.nsw.gov.au/_entity/annotation/fa962848-ec68-ef11-a670-000d3acad690
- RMS QA Specification R44 — Earthworks, Ed 3 Rev 15 (ACT City Services mirror of the RMS document) — https://www.cityservices.act.gov.au/__data/assets/pdf_file/0006/398481/R044_E3_R15.pdf
- TMR MRTS50 — Specific Quality System Requirements, March 2025 — https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/1-Overarching-Specifications/MRTS50.pdf?la=en
- TMR MRTS01 — Introduction to Technical Specifications, March 2025 — https://www.tmr.qld.gov.au/~/media/busind/techstdpubs/Specifications%20and%20drawings/Specifications/1%20Overarching%20Specifications/MRTS01.pdf
- TMR Contract Administration System Manual, Procedure CAP001M Guidance, September 2025 — https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Contract/Contract-administration-system/TIC-Procedures/CAP001M.pdf?la=en
- MRWA Specification 201 — Quality Management, issued 13/10/2025 — https://www.mainroads.wa.gov.au/4a91a3/globalassets/technical-commercial/technical-library/specifications/200-series-management-requirements/specification-201-quality-management.pdf
- MRWA Specification 100 — General Requirements, issued 9/11/2023 — https://www.mainroads.wa.gov.au/49c99f/globalassets/technical-commercial/technical-library/specifications/100-series-general-requirements/specification-100-general-requirements.pdf
- MRWA Guidelines: Specification Development for Custodians, 03/03/2020 — https://www.mainroads.wa.gov.au/4ada30/globalassets/technical-commercial/technical-library/specifications/specification-development-guidelines.pdf
- VicRoads Standard Specification Section 160 — Construction – General, © June 2017 (archived) — https://web.archive.org/web/20180205003431/http://webapps.vicroads.vic.gov.au:80/VRNE/csdspeci.nsf/webscdocs/BE6FEA6D1F89AB25CA25813E000BE4A6/$File/Sec160.doc
- VicRoads Standard Specification Section 168 — Occupational Health and Safety Management, © July 2022 (archived) — https://web.archive.org/web/20230320130006/http://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/C55AB791AF4C393BCA25814E000AD171/$File/Sec168.docx
- VicRoads standard sections index (archived) — https://web.archive.org/web/20191104203746id_/http://webapps.vicroads.vic.gov.au:80/VRNE/csdspeci.nsf/webscdocs/0954A4FFFA955EA2CA25742E00190292/$File/IndexStandardSections.doc
- Austroads Technical Specification ATS 1120-21 — Quality Management Requirements, Ed 1.0, May 2021 (archived DOCX; now superseded on the Austroads site) — https://web.archive.org/web/20250905113639id_/https://austroads.gov.au/__data/assets/word_doc/0036/673839/ATS-1120-21_Quality_Management_Requirements.docx
- ACT MITS 00B — Quality (Construction), Ed 1 Rev 1, July 2025 — https://www.cityservices.act.gov.au/__data/assets/pdf_file/0005/1387094/MITS-00B-Quality-Construction-1-1.pdf
- NATSPEC TECHnote GEN 009 — Hold points and Witness points, April 2019 — https://natspec.com.au/images/PDF/NTN_GEN_009_Hold_points_and_Witness_points.pdf

**Contracts**

- AS 4000-1997 General Conditions of Contract, incl. Amdt 1–3 (licensed SAI Global copy hosted publicly — provenance flagged) — https://www.bostongrp.com.au/documents/e-tools/79-head-contract-as4000-1997.pdf
- Amended AS 4000-1997, Tomago tender pack (cross-check) — https://www.tomago.com.au/wp-content/uploads/2021/11/General-Conditions-of-Contract-AS4000-Construction.pdf
- GC21 (Edition 2) General Conditions of Contract, © NSW Government 2020 — Cabonne Council tender pack — https://www.cabonne.nsw.gov.au/files/sharedassets/public/v/1/council/tenders-requests-for-quotes-and-expressions-of-interest/2024/cabonne-pools-upgrade/vp410601_cabonne-pools_contract-1674466_general-conditions-of-contract.pdf
- GC21 Edition 2 – ACT Modified Version, Rev Nov 2025 (clause 2 cross-check) — https://www.act.gov.au/__data/assets/pdf_file/0011/1942706/GC21-Ed2-General-Conditions-of-Contract.pdf
- GC21 official landing page — https://www.info.buy.nsw.gov.au/resources/gc21
- AS 2124/2125/2127-1992 preview (TOC only — full text NOT FOUND) — https://www.elecenghub.com/NewSamples/AS/143364916/AS-2124-2125-2127-1992-1.pdf

**Standards**

- The Terms and Definitions of ISO/TC 176 Standards, ISO/TC 176/SC 1, V1, 29 Sep 2022 — https://committee.iso.org/files/live/sites/tc176sc1/files/Terms%20in%20TC%20176%20Standards%20Alphabetical%20Listing%20V1%202022%2009%2029.pdf
- ISO 10005:2018 official sample (pp. 1–4) — https://cdn.standards.iteh.ai/samples/70398/9f268a26d7e546a78add3ad542a674f5/ISO-10005-2018.pdf · paywalled full text https://www.iso.org/standard/70398.html
- ISO 9001:2015 cl 8.6 (Grade B secondary) — https://preteshbiswas.com/2023/09/04/iso-90012015-clause-8-6-release-of-products-and-services/ · https://www.isms.online/iso-9001/clause-8-6-release-of-products-and-services/ · https://www.thecoresolution.com/clause-8-6-iso-90012015-explained
- ISO 9001:2015 cl 8.7 (Grade B secondary) — https://preteshbiswas.com/2023/09/04/iso-90012015-clause-8-7-control-of-nonconforming-outputs/

**Secondary / supporting**

- Victorian Infrastructure Design Manual v5.4 (council-side releasing authority) — https://www.designmanual.com.au/assets/files/documents/IDM/IDM_Version_5.4_.pdf
- LC Lawyers — Superintendents in Building Contracts (AS 2124 cl 23) — https://lclawyers.com.au/superintendents-building-contracts-duties-responsibilities/
- Mondaq — Role of the superintendent in construction projects — https://www.mondaq.com/australia/construction-planning/442880/role-of-the-superintendent-in-construction-projects
- S3ntec / Turtons — AS 4000 superintendent duty, *Thiess v MCC Mining* line — https://www.s3ntec.com.au/insights-superintendent-as4000 · https://www.turtons.com/blog/10-things-you-should-know-about-as-4000
- Current Victorian DTP technical publications portal (for re-sourcing dead VicRoads links) — https://www.vic.gov.au/dtp-technical-publications

**Repo corpus consulted first (not re-researched)**

- `docs/research/civilpro-teardown-2026-08-06/itp-holdpoints-tests.md` — CivilPro approver action set, conditional-approve semantics, 25-char minimum comment (`:220-232`, `:403-408`, `:520-522`, `:642`)
- `docs/plans/wave-e-approvals-spec-2026-07-28.md` — existing external-token release model, audit actor shape, per-project notice-days setting, and the explicit parking of reject (`:194`)
- `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §D — prior TfNSW Q6 claim graded A with editions unpinned and flagged "pin editions/clauses at E execution-spec time". **This document discharges that action.**
