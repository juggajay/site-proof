# SiteProof Regulatory & Compliance Landscape

## Australian Construction Quality Management -- Regulatory Research Report

**Prepared:** February 2026
**Scope:** State and federal regulatory requirements, upcoming changes, data sovereignty, and insurance implications for SiteProof as a quality management platform targeting Australian civil contractors.

---

## Executive Summary (1-Page)

The Australian civil construction sector is undergoing a significant regulatory shift toward mandatory digital documentation, modernised quality assurance frameworks, and stricter data governance. SiteProof is positioned at the intersection of several converging trends that create both urgency and opportunity.

**Key findings:**

1. **Digital mandates are accelerating.** NSW (TfNSW) already requires digital quality records and digital submission via the Principal's electronic document management tools under Q6. Queensland has passed legislation (November 2025) explicitly removing legislative impediments to digital service delivery in construction. Victoria's Building Productivity reforms (commencing December 2026) will require digital building manuals. These are not future aspirations -- they are enacted or imminent law.

2. **National Prequalification links quality systems to contract eligibility.** The Austroads National Prequalification System (2025 Edition) requires contractors at all levels to demonstrate certified quality management systems (AS/NZS ISO 9001). SiteProof's ITP, hold point, and NCR workflows directly support these requirements, making the platform a competitive advantage for contractors seeking or maintaining prequalification.

3. **SOPA reforms across multiple states are reshaping claims management.** Victoria's Fairer Payments Bill (effective September 2026) removes the "excluded amounts" regime and eliminates reference dates, fundamentally changing how payment claims work. WA's draft SOPA amendments (under consultation) introduce construction trusts. SiteProof's docket and progress claim features need to align with these state-specific changes.

4. **Data sovereignty requirements are real but manageable.** The Australian Government's Hosting Certification Framework and Protective Security Policy Framework (PSPF) require sensitive government data to be hosted by certified providers on Australian soil. While SiteProof primarily serves private contractors (not government entities directly), many of those contractors work on government projects. Hosting on Australian-region infrastructure (Supabase/AWS Sydney) and pursuing ISO 27001 certification are the practical priorities.

5. **Insurance is an untapped selling point.** Professional indemnity insurers are applying stricter scrutiny to quality assurance processes and risk management documentation. Premium rates have stabilised, with carriers offering reduced pricing for firms with strong claims records. Digital quality evidence trails (timestamped ITPs, hold point sign-offs, photo records) provide precisely the kind of documentation insurers value for claims defence.

**Bottom line:** SiteProof does not merely "help with compliance" -- it is becoming a near-essential tool as state authorities move toward digital-first quality management. The next 18 months represent a window to establish market position before competitors recognise the same regulatory tailwinds.

---

## 1. State-by-State Compliance Requirements

### Summary Table

| State/Territory | Authority | Key Specification | Quality System Standard | Digital Requirements | ITP/Hold Point Requirements | Record Retention | Prequalification |
|---|---|---|---|---|---|---|---|
| **NSW** | TfNSW | Q6 (Quality Management System Type 6) | AS/NZS ISO 9001:2016 | Digital submission via Principal's EDMS; digital engineering framework mandatory on major projects | ITPs required per Q6; hold points and witness points with 24hr notice | 5 years post-completion (project records) | R1-R5 levels via National Prequalification System |
| **QLD** | TMR | MRTS01 (Introduction), MRTS50 (Specific Quality System Requirements) | AS/NZS ISO 9001 | QBCC digital licence rollout; legislation passed Nov 2025 removing barriers to digital service delivery | ITPs required per MRTS50; quality planning in project-specific quality plan | Per state archives requirements | National Prequalification System |
| **VIC** | DTP (formerly VicRoads) | Section 175 (Referenced Documents for Standard Specifications) | AS/NZS ISO 9001 | Building manuals (digital) for apartment buildings from Dec 2026; eCert portal for trade certificates | Hold points and witness points per VicRoads Specification; 24hr notice to Superintendent | Per state archives requirements | National Prequalification System |
| **WA** | MRWA | Digital Ground Survey Standard 67-08-43; Record Keeping Code of Practice | AS/NZS ISO 9001 | Digital ground survey standard; data lodgement per OpenRoads Design Standards | Per MRWA quality controlled procedures | Contract records owned by State; disposal per DA 2014-016 schedule | National Prequalification System |
| **SA** | DIT (formerly DPTI) | Division G (General) Master Specifications | AS/NZS ISO 9001 | Quality assurance requirements assessed per project risk profile | Per Division G specifications | Per state Code of Practice | State-specific assessment |
| **TAS** | State Growth | Quality Assurance Manual for Contractors | AS/NZS ISO 9001 | Competence criteria for each function affecting project quality | Per QA Manual requirements | Per state archives requirements | National Prequalification System |
| **NT** | DLI | Master Specifications for Major Building Works | AS/NZS ISO 9001 | Specifications password-protected; accessed via project manager | Per master specification requirements | Per state archives requirements | CAL accreditation required for projects >$100k |

### Detailed State Analysis

#### New South Wales (TfNSW)

**Current State:**
- TfNSW Q6 specification governs quality management for all major works contracts. Written to align with AS/NZS ISO 9001:2016.
- Contractors must submit quality documents via the Principal's electronic document management tool -- this is effectively a digital submission mandate.
- The Digital Engineering Framework (established 2018) is now "business as usual" on most road and rail projects, requiring delivery of IFC design files with custom TfNSW attributes.
- The Registration Scheme for Construction Industry Contractors (Edition 5, Revision 22, November 2025) classifies contractors into R1-R5 levels based on technical/managerial expertise, financial capacity, and quality systems.
- Heavy Vehicle Compliance standard (effective 26 August 2025) requires digital records for inductions, arrivals, and safety checks.

**Upcoming:**
- Building Productivity Reforms Bill to be introduced to Parliament in Q1 2026, including digital modernisation through digitised certificates and a fully digital approvals pathway.
- BCNSW eCert portal mandatory for specialist trades from March 2026.
- Greater engagement with Modern Methods of Construction (MMC) and associated quality-assurance requirements.

**SiteProof Relevance:** HIGH. Q6 alignment is a direct selling point. ITP workflows, hold point management, and digital record keeping map directly to TfNSW requirements. Digital submission readiness is a differentiator.

**Sources:**
- [TfNSW Q6 Quality Management System (Type 6)](https://standards.transport.nsw.gov.au/_entity/annotation/ddc19f14-b035-ed11-9db2-000d3ae019e0)
- [TfNSW Registration Scheme for Contractors (Nov 2025)](https://www.transport.nsw.gov.au/system/files/media/documents/2025/Registration-Scheme-for-Construction%20Industry-Contractors-Guidelines-and-Conditions.pdf)
- [TfNSW Digital Engineering Standard](https://www.transport.nsw.gov.au/news-and-events/reports-and-publications/digital-engineering-standard-part-2-requirements)
- [NSW Building Productivity Reforms](https://www.nsw.gov.au/departments-and-agencies/building-commission/industry-changes/building-productivity-reforms)

#### Queensland (TMR / QBCC)

**Current State:**
- TMR MRTS framework governs technical specifications. MRTS50 sets specific quality system requirements aligned with AS/NZS ISO 9001. MRTS01 provides overarching introduction.
- Specifications update schedule shifting from tri-annual to bi-annual (May and November) from 2026.
- QBCC digital licence rollout began September 2025 (pilot for Site Supervisors and Pool Safety Inspectors), now available to 105,000+ licensees.
- Queensland Building and Construction Commission and Other Legislation Amendment Act 2025 passed November 2025 -- explicitly removes legislative impediments to digital service delivery.

**Upcoming:**
- Tranche 3 amendments commencing early 2026 (Governor-in-Council approval pending).
- Tranche 4 proposed for introduction to Parliament early 2026: updating licensing thresholds, modernising home warranty insurance, improving dispute resolution.
- Single point of truth for safety incident reporting through Office of Industrial Relations with QBCC receiving data through secure data-sharing.
- Increased penalties for failure to report serious incidents (80 to 100 penalty units).

**SiteProof Relevance:** HIGH. The legislative push to remove barriers to digital service delivery creates a tailwind. TMR MRTS50 quality plan requirements align with SiteProof's project quality management features.

**Sources:**
- [TMR Overarching Specifications](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/1-overarching-specifications)
- [TMR Specifications Index](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/specifications-index)
- [QBCC Digital Licences](https://www.qbcc.qld.gov.au/licences/digital-licence)
- [QLD Building and Construction Amendment Act 2025](https://statements.qld.gov.au/statements/103987)

#### Victoria (DTP / VicRoads)

**Current State:**
- DTP (Department of Transport and Planning) is the home for technical and asset management standards previously published by VicRoads.
- Section 175 references documents for standard specifications for roadworks and bridgeworks (latest version June 2023).
- Hold points and witness points are required per VicRoads specification, with 24-hour notice to the Superintendent.
- DTP Prequalification Scheme covers Maintenance and General Works with eligibility criteria.

**Upcoming:**
- Domestic Building Contracts Amendment Act 2025 (passed September 2025) reforms commencing 1 December 2026. New short contract content requirements (4 instead of 21).
- Building manuals for apartment buildings will keep permits and documents in one place.
- Building Legislation Amendment (Fairer Payments on Jobsites) Bill 2025 with SOPA changes effective 1 September 2026.
- Rectification orders to direct builders/developers to fix poor work, including after occupancy.

**SiteProof Relevance:** MEDIUM-HIGH. The requirement for building manuals (centralised digital documentation) aligns with SiteProof's document management. SOPA changes require claims management features to be updated.

**Sources:**
- [DTP Technical Publications](https://www.vic.gov.au/dtp-technical-publications)
- [VicRoads Section 175](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/0F8304C820BD7D76CA257E4B0017ECFB/$File/Sec175(full).doc)
- [Victoria Domestic Building Contracts Amendment Act 2025](https://www.consumer.vic.gov.au/latest-news/new-domestic-building-contract-laws-passed-in-victoria)
- [Victoria SOPA Reforms](https://constructionlegal.com.au/dont-get-caught-out-the-vic-sopa-reforms-you-must-know-in-2026/)

#### Western Australia (MRWA)

**Current State:**
- Digital Ground Survey Standard (67-08-43) defines standard requirements and outputs for Digital Ground Survey with strict accuracy tolerances.
- Record Keeping Code of Practice for management of contract records specifies that contract records are owned by the State.
- Data lodgement must comply with MRWA online OpenRoads Design Standards.
- Contractor RecordKeeping Plan must specify audit trails to track specified records provided to Main Roads.

**Upcoming:**
- WA training framework scheduled by March 2026 for standardised practices.
- Draft Building and Construction Industry (Security of Payment) Amendment Bill 2025 (released October 2025 for consultation): introduces construction trust scheme to replace Project Bank Accounts; removes time restrictions for serving adjudication documents.

**SiteProof Relevance:** MEDIUM. Record-keeping audit trails and state ownership of records are key requirements. SiteProof's data export and records management capabilities need to support MRWA's strict record-keeping code.

**Sources:**
- [MRWA Digital Ground Survey Standard](https://www.mainroads.wa.gov.au/globalassets/technical-commercial/technical-library/surveying-and-geospatial-services/engineering-surveys-guidelines/digital-ground-survey-standard.pdf)
- [MRWA Record Keeping Code of Practice](https://www.mainroads.wa.gov.au/49e7a4/globalassets/technical-commercial/contracting-to-main-roads/record-keeping-code-of-practice-for-the-management-of-contract-records.pdf?v=4a1bf4)
- [WA SOPA Draft Amendments](https://www.lavan.com.au/advice/construction_infrastructure/sopa_under_review)

#### South Australia (DIT/DPTI)

**Current State:**
- Division G (General) Master Specifications cover quality, safety, and environmental management system requirements.
- Quality assurance requirements assessed per project risk profile -- DPTI determines appropriate QA level based on risk.
- Code of Practice for the South Australian Construction Industry applies to DPTI construction tenders.
- Master specifications available through DIT contractor documents portal.

**SiteProof Relevance:** MEDIUM. Risk-based QA approach means SiteProof needs to be flexible enough to handle varying levels of quality assurance stringency.

**Sources:**
- [DIT Division G Specifications](https://www.dpti.sa.gov.au/contractor_documents/specifications_-_division_1)
- [DIT Master Specifications](https://www.dpti.sa.gov.au/contractor_documents/master-specifications)

#### Tasmania

**Current State:**
- Quality Assurance Manual for Contractors (Procurement, Risk and Contract Management Branch) requires QMS with established competence criteria for each function affecting project quality.
- Senior management must establish, implement, and maintain a Quality Policy as the driver for the contractor organisation.
- Part of the National Prequalification System through Transport Services.

**SiteProof Relevance:** LOW-MEDIUM. Smaller market but participates in the national prequalification framework.

**Sources:**
- [Tasmania Quality Assurance Manual](https://www.purchasing.tas.gov.au/Documents/Quality-Assurance-Manual-for-Contractors.pdf)
- [Tasmania National Prequalification](https://www.transport.tas.gov.au/roadworks/contractor_and_industry_information/national_prequalification_system)

#### Northern Territory

**Current State:**
- CAL accreditation is the recognised and preferred pre-qualification for contractors seeking NT Government work above $100,000.
- Master specifications for Major Building Works provided by DLI.
- Standard specifications for Small Building Works are password-protected and project-specific.

**SiteProof Relevance:** LOW. Smallest market; CAL accreditation is the gatekeeper.

**Sources:**
- [NT Building Design Standards and Construction Specifications](https://dli.nt.gov.au/industry/technical-standards-guidelines-and-specifications/buildings)

---

## 2. Regulatory Forecast (Next 24 Months: 2026-2027)

### National Level

| Timeline | Change | Impact on SiteProof |
|---|---|---|
| 1 May 2026 | NCC 2025 formal adoption (state-dependent) | New waterproofing, energy, and fire safety provisions increase documentation requirements |
| 27 Feb 2026 | NCC modernisation consultation closes | Potential digitisation of the Code as a decision-support tool; opportunity for platform integration |
| 10 Dec 2026 | Privacy Act automated decision transparency obligations commence | SiteProof must disclose any automated decision-making in privacy policy |
| Ongoing | Austroads National Prequalification System (2025 Edition) | Quality system certification remains gatekeeper for state road/bridge contracts |
| 4 Mar 2026 | Mandatory cybersecurity regulations for connected devices | Potential implications for IoT-connected construction equipment integrated with quality platforms |

### State Level

| Timeline | State | Change | Impact on SiteProof |
|---|---|---|---|
| Q1 2026 | NSW | Building Productivity Reforms Bill introduced to Parliament | Digital approvals pathway; MMC quality assurance requirements |
| Mar 2026 | NSW | BCNSW eCert portal mandatory for specialist trades | Digital certificate submission becomes norm; integration opportunity |
| Early 2026 | QLD | Tranche 3 QBCC amendments commence | Digital service delivery barriers removed; digital licence expansion |
| Early 2026 | QLD | Tranche 4 introduced to Parliament | Licensing thresholds, warranty insurance, dispute resolution modernisation |
| 1 Sep 2026 | VIC | SOPA reforms (Fairer Payments Bill) take effect | Excluded amounts regime removed; reference dates eliminated; 6-month post-completion claim window |
| 1 Dec 2026 | VIC | Domestic Building Contracts reforms commence | New contract content requirements; building manuals; rectification orders |
| Mar 2026 | WA | Training framework scheduled | Standardised best practices across construction |
| TBD 2026 | WA | SOPA Amendment Bill (post-consultation) | Construction trusts replacing PBAs; adjudication document timing changes |

### Trend Analysis

**Strong signals (high confidence):**
- Every major state is moving toward digital-first documentation. This is not a question of "if" but "when" paper-based quality records become unacceptable.
- SOPA harmonisation across states is accelerating. Victoria's removal of the "excluded amounts" regime brings it closer to NSW, QLD, and WA models.
- Quality system certification (ISO 9001) remains the universal baseline. No state is moving away from this.

**Moderate signals (medium confidence):**
- State road authorities may begin requiring specific digital platforms or data formats for quality record submission within the next 2-3 years.
- The NCC modernisation agenda could introduce digital compliance tools that either complement or compete with SiteProof.
- QBCC's digital licence success may prompt other state regulators to accelerate digital transformation.

**Weak signals (low confidence, high impact if they materialise):**
- A state authority mandating a specific quality management platform (threat scenario). No evidence of this yet, but TfNSW's requirement to use "the Principal's electronic document management tool" shows the pattern.
- Federal-level digital quality record standards for infrastructure projects (would be a massive opportunity if SiteProof were an approved platform).

---

## 3. Data Requirements Checklist

### Data Residency & Sovereignty

| Requirement | Status | Priority | Notes |
|---|---|---|---|
| Host data in Australian data centres | REQUIRED | Critical | Supabase (underlying infrastructure) must use AU-region servers. Verify Sydney region deployment. |
| Ensure no data replication to offshore locations | REQUIRED | Critical | Check Supabase backup and CDN configurations for AU-only data residency. |
| Comply with Australian Privacy Principles (APPs) | REQUIRED | Critical | Privacy Act 1988 obligations apply to all personal information. Updated penalties: up to $50M or 30% of adjusted turnover. |
| Privacy policy disclosing data practices | REQUIRED | Critical | Must include: types of info collected, purposes, overseas disclosure details, APP 1 compliance. |
| Automated decision-making transparency | REQUIRED by Dec 2026 | High | New Privacy Act requirement: disclose when decisions use automated processes. |
| Right to erasure support | REQUIRED | High | New Privacy Act provision: users can request deletion of personal data. |
| Hosting Certification Framework compliance | CONDITIONAL | Medium | Required only if hosting data classified as PROTECTED or for Whole-of-Government systems. Unlikely for SiteProof initially, but may become relevant for large government contracts. |
| IRAP assessment | CONDITIONAL | Medium | Required for PROTECTED-level government data. Major cloud providers (AWS, Azure, GCP) already have IRAP assessments. SiteProof benefits from hosting on IRAP-assessed infrastructure. |
| PSPF alignment | CONDITIONAL | Low-Medium | Protective Security Policy Framework applies to government entities. Relevant if SiteProof handles sensitive government project data. |

### Security Certifications

| Certification | Relevance | Timeline Recommendation | Cost Estimate |
|---|---|---|---|
| **ISO 27001** | HIGH -- international gold standard for ISMS; preferred for AU/Asia/government market | Begin preparation now; target certification within 12-18 months | $30,000-$80,000 (implementation + audit) |
| **SOC 2 Type II** | MEDIUM-HIGH -- required by US-based clients; overlaps 40% with ISO 27001 | Pursue after ISO 27001 (shared controls reduce effort) | $20,000-$60,000 (incremental after ISO 27001) |
| **IRAP Assessment** | MEDIUM -- required for government PROTECTED-level data | Pursue only if targeting government contracts directly | $50,000-$150,000+ |
| **Hosting Certification Framework (Strategic)** | LOW -- applies to hosting providers, not application vendors | Not required for SiteProof; ensure hosting provider is certified | N/A (hosting provider responsibility) |

### Record Retention Requirements

| Jurisdiction | Minimum Retention Period | Key Requirements |
|---|---|---|
| TfNSW (NSW) | 5 years post-completion | Project records must be retained as objective evidence of QMS compliance |
| MRWA (WA) | Per DA 2014-016 schedule | Contract records owned by State; contractor cannot retain on completion; audit trail required |
| General industry guidance | 7-10 years post-completion | Allows for potential disputes, warranty claims, and statutory limitation periods |
| Tax records (ATO) | 5 years | Financial records including dockets and claims |
| Privacy Act | Until no longer needed | Must destroy or de-identify personal information no longer needed for any lawful purpose |

**SiteProof Implementation:**
- Default record retention: 10 years post-project-completion (covers all state requirements and statutory limitation periods)
- Configurable per-project retention policies to accommodate specific contract requirements
- Automated retention alerts and archival workflows
- Data export capability for state-owned records (critical for MRWA compliance)
- Secure deletion/de-identification processes for Privacy Act compliance

---

## 4. Insurance Opportunity Analysis

### Market Context

The Australian construction professional indemnity (PI) insurance market has stabilised after a period of hardening. Premium rates have returned to levels considered sustainable by insurers, leading to increased capacity and greater willingness to write or expand construction PI portfolios. Critically, **carriers are now offering reduced pricing for firms with strong claims records and measured growth plans**.

### How SiteProof Reduces Insurance Risk

| Risk Factor | How SiteProof Addresses It | Insurance Value |
|---|---|---|
| **Defect claims** | Timestamped ITPs with photo evidence prove work was inspected and approved at each hold point | Stronger claims defence; reduced litigation costs |
| **Quality system failures** | Structured ITP workflows enforce consistent quality processes across projects | Demonstrates proactive risk management to underwriters |
| **Documentation gaps** | Centralised digital records with audit trails prevent lost or incomplete documentation | Eliminates "he said/she said" disputes; clear evidence chain |
| **Subcontractor disputes** | Hold point sign-offs create accountability records for all parties | Reduces cross-claim complexity and management costs |
| **Compliance failures** | Platform enforces regulatory requirements (NCR processes, hold point releases) | Reduces exposure to regulatory penalties |
| **Payment claim disputes** | Docket management and progress claims with supporting evidence | Reduces SOPA adjudication costs; stronger position in disputes |

### Insurance-Related Selling Points for SiteProof

1. **Claims Defence Evidence Package:** SiteProof can generate a complete quality evidence trail for any lot or project, including all ITP completions, hold point releases, test results, NCR resolutions, and photographic evidence -- all timestamped and attributed. This is precisely what PI insurers need to mount an effective defence.

2. **Underwriter Risk Assessment Support:** Contractors using SiteProof can present their quality management processes to insurers with data-backed evidence of compliance rates, NCR resolution times, and hold point completion metrics. This data supports requests for premium reductions.

3. **Reduced Claims Frequency:** By preventing quality failures through enforced inspection processes, SiteProof reduces the likelihood of defect claims occurring in the first place. This directly improves the contractor's claims history over time.

4. **SOPA Payment Dispute Protection:** With Victoria removing "excluded amounts" and extending post-completion claim windows to 6 months (effective September 2026), the volume and complexity of payment disputes may increase. SiteProof's docket and claims documentation provides evidentiary support.

5. **Regulatory Compliance Audit Trail:** As regulators scrutinise quality assurance more closely, having a digital audit trail reduces the risk of regulatory enforcement action -- a growing concern for PI insurers.

### Potential Partnership Opportunities

- **Insurance broker partnerships:** Partner with construction-focused brokers (e.g., Gallagher, Marsh, WTW) to offer SiteProof as a risk mitigation tool that supports premium negotiation.
- **Insurer data partnerships:** Explore providing anonymised, aggregated quality metrics to insurers for risk modelling (with appropriate consent).
- **"SiteProof Certified" discount programs:** Work with insurers to create premium discount programs for contractors who maintain active SiteProof usage with defined quality metrics.

---

## 5. SOPA (Security of Payment) Impact Analysis

### State-by-State SOPA Changes

| State | Key Changes | Effective Date | SiteProof Impact |
|---|---|---|---|
| **VIC** | Removal of "excluded amounts" regime; elimination of reference dates; 6-month post-completion claim window; performance security release within 20 business days; respondents cannot add new reasons in adjudication response | 1 Sep 2026 | Claims module needs updating: remove reference date logic for VIC projects; extend claim submission window; add performance security tracking |
| **WA** | Construction trust scheme replacing Project Bank Accounts; removal of time restrictions for adjudication documents | TBD 2026 (post-consultation) | Add construction trust tracking; update adjudication workflow |
| **NSW** | Existing framework relatively stable | N/A | Maintain current compliance |
| **QLD** | Existing framework relatively stable | N/A | Maintain current compliance |

### SiteProof Claims Module Requirements

Based on SOPA changes, the progress claims feature should support:
1. **State-specific claim rules:** Different reference date logic (or none) per state
2. **Extended claim windows:** Configurable post-completion claim periods (up to 6 months for VIC)
3. **Payment schedule tracking:** Track response deadlines and reasons (critical for VIC's new prohibition on adding reasons in adjudication)
4. **Performance security management:** Track security amounts, release triggers, and 20-business-day release deadlines
5. **Evidence packaging for adjudication:** Generate complete claim evidence packages with supporting documentation

---

## 6. Action Items

### Immediate (0-3 months)

- [ ] **Verify Australian data residency.** Confirm Supabase deployment is on Sydney-region infrastructure with no offshore data replication. Document the data residency architecture for sales and compliance purposes.
- [ ] **Update privacy policy.** Ensure compliance with Privacy Act 2024 amendments, including right to erasure provisions and data collection disclosures. Begin preparing for automated decision-making transparency (required by December 2026).
- [ ] **Create TfNSW Q6 compliance mapping.** Produce a feature-by-feature mapping document showing how SiteProof addresses each Q6 requirement. Use this as a sales asset for NSW contractors.
- [ ] **Audit record retention capabilities.** Ensure the platform supports configurable retention periods (minimum 10 years) and data export for state-owned records (MRWA requirement).

### Short-Term (3-6 months)

- [ ] **Begin ISO 27001 preparation.** Engage a consultant to perform gap analysis and begin ISMS implementation. This is the single most impactful certification for the AU government contractor market.
- [ ] **Create state-specific compliance guides.** Produce per-state guides showing how SiteProof maps to TfNSW Q6, TMR MRTS50, VicRoads Section 175, and MRWA requirements. Package as downloadable sales collateral.
- [ ] **Assess SOPA claims module updates.** Scope development work needed to support Victoria's September 2026 SOPA changes (removal of reference dates, extended claim windows, performance security tracking).
- [ ] **Develop insurance partnership pitch.** Create materials for construction insurance brokers demonstrating SiteProof's risk reduction value proposition. Target Gallagher, Marsh, and WTW initially.

### Medium-Term (6-12 months)

- [ ] **Achieve ISO 27001 certification.** Complete implementation and certification audit.
- [ ] **Implement state-specific claims rules.** Update progress claims module to handle VIC SOPA changes before September 2026 effective date. Monitor WA SOPA amendment progress.
- [ ] **Pursue SOC 2 Type II.** Leverage ISO 27001 controls for efficient SOC 2 Type II audit.
- [ ] **Monitor NCC modernisation outcomes.** The consultation closes February 2026; outcomes will signal whether the NCC moves toward digital compliance tools. Position SiteProof as a potential integration partner.
- [ ] **Explore BCNSW eCert portal integration.** The NSW mandatory digital certificate submission (March 2026) creates an API integration opportunity.

### Long-Term (12-24 months)

- [ ] **Evaluate IRAP assessment.** If targeting direct government contracts, pursue IRAP assessment for PROTECTED-level data handling.
- [ ] **Build state authority API integrations.** As state authorities develop digital submission systems, build integrations to enable direct quality record submission from SiteProof.
- [ ] **Establish insurance partnerships.** Formalise arrangements with insurance brokers/underwriters for "SiteProof Certified" premium discount programs.
- [ ] **Prepare for potential platform mandates.** Monitor whether any state authority moves toward mandating specific quality management platforms. Position SiteProof to be on any approved vendor list.

---

## 7. Sources

### State Authority Specifications and Standards

- [TfNSW Q6 Quality Management System (Type 6)](https://standards.transport.nsw.gov.au/_entity/annotation/ddc19f14-b035-ed11-9db2-000d3ae019e0)
- [TfNSW Quality Management (Major Works) - QA](https://standards.transport.nsw.gov.au/_entity/annotation/d7d76f7e-d6c3-ee11-9079-000d3ad2920b)
- [TfNSW Registration Scheme for Contractors (Ed 5, Rev 22, Nov 2025)](https://www.transport.nsw.gov.au/system/files/media/documents/2025/Registration-Scheme-for-Construction%20Industry-Contractors-Guidelines-and-Conditions.pdf)
- [TfNSW Digital Engineering Standard - Part 2: Requirements](https://www.transport.nsw.gov.au/news-and-events/reports-and-publications/digital-engineering-standard-part-2-requirements)
- [TfNSW Digital Engineering Survey Requirements Guide](https://www.transport.nsw.gov.au/system/files/media/documents/2024/DMS-SD-142_Digital-Engineering-Survey-Requirements-Guide.pdf)
- [TMR Category 1 - Overarching Specifications (MRTS01, MRTS50)](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/1-overarching-specifications)
- [TMR Specifications Index](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/specifications-index)
- [DTP Technical Publications (VicRoads)](https://www.vic.gov.au/dtp-technical-publications)
- [VicRoads Section 175](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/0F8304C820BD7D76CA257E4B0017ECFB/$File/Sec175(full).doc)
- [MRWA Digital Ground Survey Standard](https://www.mainroads.wa.gov.au/globalassets/technical-commercial/technical-library/surveying-and-geospatial-services/engineering-surveys-guidelines/digital-ground-survey-standard.pdf)
- [MRWA Record Keeping Code of Practice](https://www.mainroads.wa.gov.au/49e7a4/globalassets/technical-commercial/contracting-to-main-roads/record-keeping-code-of-practice-for-the-management-of-contract-records.pdf?v=4a1bf4)
- [DIT (SA) Division G Specifications](https://www.dpti.sa.gov.au/contractor_documents/specifications_-_division_1)
- [DIT (SA) Master Specifications](https://www.dpti.sa.gov.au/contractor_documents/master-specifications)
- [Tasmania Quality Assurance Manual for Contractors](https://www.purchasing.tas.gov.au/Documents/Quality-Assurance-Manual-for-Contractors.pdf)
- [NT Building Design Standards and Construction Specifications](https://dli.nt.gov.au/industry/technical-standards-guidelines-and-specifications/buildings)

### National Prequalification

- [Austroads National Prequalification System](https://austroads.gov.au/infrastructure/national-prequalification)
- [Austroads Prequalification Requirements](https://austroads.gov.au/infrastructure/national-prequalification/prequalification-requirements)
- [Austroads Categories and Levels](https://austroads.gov.au/infrastructure/national-prequalification/categories-and-levels)
- [TfNSW National Prequalification System Guidelines (Ed 2, Rev 8)](https://www.transport.nsw.gov.au/system/files/media/documents/2024/TfNSW-National-Prequalification-System-for-Civil-Road-and-Bridge-Construction-Guidelines-Ed-2-Rev-8.pdf)

### Legislative Reforms

- [Construction Law Reform in Australia: What to Expect in 2026 (LexisNexis)](https://www.lexisnexis.com/blogs/en-au/insights/construction-law-reform-in-australia-what-to-expect-in-2026)
- [Australia's Construction Law Landscape: FY26 Legislative Reforms (Landers)](https://www.landers.com.au/legal-insights-news/australias-construction-law-landscape-fy25-fy26-legislativer-reforms)
- [NSW Building Productivity Reforms](https://www.nsw.gov.au/departments-and-agencies/building-commission/industry-changes/building-productivity-reforms)
- [Victoria Fairer Payments Bill - SOPA Changes (MinterEllison)](https://www.minterellison.com/articles/changes-to-victorias-security-of-payment)
- [Victoria SOPA Reforms 2026 (Construction Legal)](https://constructionlegal.com.au/dont-get-caught-out-the-vic-sopa-reforms-you-must-know-in-2026/)
- [Victoria Domestic Building Contracts Amendment Act 2025 (Norton Rose Fulbright)](https://www.nortonrosefulbright.com/en/knowledge/publications/aed79307/welcome-domestic-building-reforms-for-victoria)
- [Victoria Domestic Building Contracts Act Changes (Consumer Affairs Victoria)](https://www.consumer.vic.gov.au/latest-news/new-domestic-building-contract-laws-passed-in-victoria)
- [WA SOPA Draft Amendment Bill (Lavan)](https://www.lavan.com.au/advice/construction_infrastructure/sopa_under_review)
- [QBCC and Other Legislation Amendment Act 2025 (QLD Government)](https://statements.qld.gov.au/statements/103987)
- [QBCC Digital Licences](https://www.qbcc.qld.gov.au/licences/digital-licence)
- [Security of Payment Australia Overview (DLA Piper)](https://www.dlapiper.com/en/insights/publications/global-construction-bulletin/2025/september-2025/security-of-payment-australia)
- [Security of Payment Act by State (Mastt)](https://www.mastt.com/blogs/security-of-payment-act)

### National Construction Code

- [NCC 2025 (HIA)](https://hia.com.au/national-construction-code-2025)
- [NCC 2025 Preview and Modernisation Agenda (The Good Builder)](https://thegoodbuilder.com.au/ncc-2025-preview-and-modernisation-agenda-signal-a-pivotal-year-for-australian-construction/)
- [Streamlining the NCC (The Good Builder)](https://thegoodbuilder.com.au/streamlining-the-national-construction-code-why-the-rules-that-shape-every-building-are-under-review/)
- [National Construction Code (ABCB)](https://ncc.abcb.gov.au/)

### Data Sovereignty & Privacy

- [Australian Privacy Principles Guidelines (OAIC)](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines)
- [APP 11: Security of Personal Information (OAIC)](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information)
- [Data Sovereignty in Australia (Swift Digital)](https://swiftdigital.com.au/data-sovereignty-australia/)
- [Australian Data Centre Sovereignty Guide (Macquarie)](https://www.macquariedatacentres.com/blog/a-guide-to-australian-data-centre-sovereignty/)
- [Privacy Act Reforms 2024-2025 (MinterEllison)](https://www.minterellison.com/articles/privacy-and-other-legislation-amendment-act-2024-now-in-effect)
- [Privacy Act Reform Overview (Norton Rose Fulbright)](https://www.nortonrosefulbright.com/en/knowledge/publications/be98b0ff/australian-privacy-alert-parliament-passes-major-and-meaningful-privacy-law-reform)
- [Privacy Act Reforms Deep Dive (Ashurst)](https://www.ashurst.com/en/insights/australias-first-tranche-of-privacy-reforms-a-deep-dive-and-why-they-matter/)

### Hosting & Security Certifications

- [Hosting Certification Framework (Australian Government)](https://www.hostingcertification.gov.au/framework)
- [Hosting Certification Framework - Service Providers](https://www.hostingcertification.gov.au/service-providers)
- [IRAP Compliance (AWS)](https://aws.amazon.com/compliance/irap/)
- [IRAP Assessment (Microsoft Azure)](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-australia-irap)
- [ISO 27001 Compliance in Australia (KMTech)](https://kmtech.com.au/information-centre/iso-27001-compliance-in-australia/)
- [SOC 2 Compliance in Australia (CyberSapiens)](https://cybersapiens.com.au/soc-2-compliance-in-australia/)
- [ISO 27001 for SaaS (Drata)](https://drata.com/grc-central/iso-27001/for-saas)

### Insurance

- [Gallagher: Legal Changes Affecting PI for Builders (Insurance Business)](https://www.insurancebusinessmag.com/au/news/construction/gallagher-highlights-legal-changes-affecting-professional-indemnity-for-builders-561664.aspx)
- [Construction Insurance (Chubb Australia)](https://www.chubb.com/au-en/business/construction.html)
- [Construction Risk Management (Marsh)](https://www.marsh.com/en/industries/construction.html)
- [2025 Construction Insurance Law Review (Kennedys)](https://www.kennedyslaw.com/en/thought-leadership/article/2025/2025-construction-insurance-law-a-year-in-review/)
- [Construction Insurance in Australia (Mastt)](https://www.mastt.com/blogs/construction-insurance)

### Infrastructure & Industry

- [Infrastructure Australia 2025 Market Capacity Report](https://www.infrastructureaustralia.gov.au/reports/2025-infrastructure-market-capacity-report)
- [What Will Shape Australia's Infrastructure Landscape in 2026 (WSP)](https://www.wsp.com/en-au/insights/what-will-shape-australias-infrastructure-landscape-in-2026)
- [Digital Transformation of Construction Sector (Veyor)](https://www.veyordigital.com/news/rebuilding-confidence-in-australian-construction-sector-with-digital-transformation)
- [Construction Industry Trends 2025 (Altus Group)](https://www.altusgroup.com/insights/trends-australia-construction-industry-in-2025/)
