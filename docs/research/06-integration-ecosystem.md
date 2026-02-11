# SiteProof Integration Ecosystem Research

## Executive Summary

Australian civil contractors operate an average of 6.9 software tools per firm (up from 5.0 in 2023), and each additional integrated tool adds an estimated $1.14M in revenue for firms with $100M+ turnover. The integration opportunity for SiteProof is significant: fragmented technology stacks are the number-one barrier to digital adoption in AU construction, and a quality management platform that reduces double-entry across accounting, project management, and scheduling systems becomes a compelling sell.

**Top 3 Phase 1 integration recommendations:**

1. **Procore** -- The dominant project management platform in AU with 313+ customers and an open REST API with 500+ marketplace apps. Being listed in the Procore App Marketplace is a "checkbox" item for enterprise sales and provides immediate distribution to 1.4 million users. Australia is the second-largest partner country (7.58% of marketplace partners).

2. **Xero** -- Commands approximately 60% of Australia's online accounting market. A well-documented REST API with webhooks, OAuth 2.0, and SDKs in Node.js makes this the fastest path to reducing double-entry for progress claims and docket financials. Even construction firms using MYOB for payroll frequently use Xero for project-level accounting.

3. **Excel/CSV Import & PDF Export** -- Not glamorous, but critical. Every contractor manages lot lists, ITP templates, and hold-point registers in Excel. Robust Excel/CSV import for lot registers and ITP templates, plus PDF export that matches state-authority formats (AUSSPEC, ARTC, TMR, VicRoads standards), eliminates the largest adoption barrier: "we already have all our data in spreadsheets."

**Phase 2 recommendations** (months 4-8): Microsoft 365/SharePoint, SafetyCulture (iAuditor), Employment Hero / KeyPay payroll.

**Phase 3 recommendations** (months 9-12): Primavera P6 / Powerproject scheduling, Trimble Connect surveying, and ERP connectors (COINS/Viewpoint Vista) for tier-1 contractors.

The total addressable integration market covers approximately 15 distinct software categories. This report maps each category by market penetration, API maturity, integration effort, and sales impact to SiteProof.

---

## Table of Contents

1. [Common AU Civil Contractor Software Stack](#1-common-au-civil-contractor-software-stack)
2. [Integration Priority Matrix](#2-integration-priority-matrix)
3. [Recommended Phase 1 Integrations](#3-recommended-phase-1-integrations)
4. [API and Webhook Availability per Platform](#4-api-and-webhook-availability-per-platform)
5. [Data Format Requirements](#5-data-format-requirements)
6. [Competitive Landscape -- Integration Approaches](#6-competitive-landscape--integration-approaches)
7. [Action Items](#7-action-items)
8. [Sources](#8-sources)

---

## 1. Common AU Civil Contractor Software Stack

### 1.1 Software Categories and Market Leaders

| Category | Tier 1 (Enterprise / $100M+) | Tier 2 (Mid-market / $10-100M) | Tier 3 (SME / <$10M) | AU Market Notes |
|----------|------------------------------|--------------------------------|----------------------|-----------------|
| **Accounting** | MYOB EXO, COINS Evo | MYOB Business, Xero | Xero, MYOB Essentials | Xero holds ~60% of AU online accounting market; MYOB stronger for complex payroll/awards in construction |
| **Project Management** | Procore, Aconex (Oracle) | Procore, Autodesk Construction Cloud | Sitemate Dashpivot, Fieldwire | Procore has 313+ AU customers; Aconex (Oracle) dominates Tier 1 infrastructure |
| **Scheduling** | Primavera P6, Powerproject | Microsoft Project, Powerproject | Microsoft Project, Excel | Primavera dominates government/infrastructure; Powerproject popular for civil |
| **Estimating** | RIB CostX, CostOS | CostX, Buildsoft Cubit | Buildsoft Cubit, Excel | CostX dominant in AU/NZ quantity surveying; Cubit popular for mid-market |
| **Surveying/Geospatial** | Trimble Connect, 12d Model | Trimble, Leica | Leica, basic GPS | 12d Model is AU-developed and dominant for civil design; Trimble for field |
| **Document Management** | Aconex, Asite, SharePoint | SharePoint, Procore Docs | Google Drive, Dropbox | Aconex near-universal on Tier 1 government projects; SharePoint for corporate |
| **HR/Payroll** | ELMO, Employment Hero | Employment Hero, KeyPay | KeyPay, Xero Payroll | Employment Hero/KeyPay best for construction award interpretation |
| **Fleet/Plant** | Chevin FleetWave, Teletrac Navman | Teletrac Navman | Basic spreadsheets | Teletrac Navman strong in AU; Chevin for enterprise fleet lifecycle |
| **ERP** | COINS Evo (Access), Viewpoint Vista | Jonas Construction | MYOB, Xero | COINS and Viewpoint dominate AU Tier 1 contractors |
| **Safety/Quality Inspections** | SafetyCulture (iAuditor), Procore | SafetyCulture, Sitemate | SafetyCulture, paper | SafetyCulture is AU-founded; 75,000+ organisations globally |
| **BIM** | Autodesk (Revit/ACC), Tekla | Autodesk, Trimble | Limited adoption | ~40% of AU construction firms use BIM; growing with ISO 19650 pressure |
| **Progress Claims** | ERP-integrated, Excel | Excel, custom tools | Excel | Major gap in market -- few standalone digital solutions |
| **NCR Management** | Procore Quality, SafetyCulture | Spreadsheets, email | Paper/email | Significant digitisation gap, especially for civil |
| **Daily Diary** | Procore, Sitemate | Sitemate, custom | Paper, Word docs | Growing digital adoption; regulatory push for digital records |

### 1.2 Technology Adoption Statistics (AU Construction 2025)

- Average tools per firm: **6.9** (up 20% year-on-year)
- AI/ML adoption: **37%** (up from 26% in 2023)
- BIM adoption: **~40%**
- Reported productivity increase from digital tools: **34%**
- Improved customer experience: **33%**
- Increased staff safety: **33%**

Source: Autodesk/Deloitte "State of Digital Adoption in the Construction Industry 2025"

---

## 2. Integration Priority Matrix

### 2.1 Effort vs Impact Assessment

| Integration | Sales Impact | Data Entry Reduction | Enterprise Checkbox | API Maturity | Dev Effort (weeks) | Priority Score |
|------------|-------------|---------------------|--------------------|--------------|--------------------|---------------|
| **Excel/CSV Import** | High | Very High | N/A | N/A | 2-3 | **10/10** |
| **PDF Export (authority formats)** | High | High | Yes | N/A | 2-4 | **10/10** |
| **Procore** | Very High | High | Yes | Excellent | 6-10 | **9/10** |
| **Xero** | High | High | No | Excellent | 4-6 | **9/10** |
| **SharePoint/M365** | Medium | Medium | Yes | Excellent | 4-6 | **7/10** |
| **SafetyCulture** | Medium | High | No | Good | 4-6 | **7/10** |
| **Employment Hero/KeyPay** | Medium | Medium | No | Good | 4-6 | **6/10** |
| **MYOB** | Medium | Medium | No | Good | 4-6 | **6/10** |
| **Primavera P6** | High | Medium | Yes | Moderate | 8-12 | **6/10** |
| **Powerproject** | Medium | Medium | No | Moderate | 6-8 | **5/10** |
| **Aconex** | High | Medium | Yes | Moderate | 8-12 | **5/10** |
| **Trimble Connect** | Low | Medium | No | Good | 6-8 | **4/10** |
| **CostX** | Low | Low | No | Limited | 6-8 | **3/10** |
| **COINS/Viewpoint ERP** | High | Medium | Yes | Moderate | 10-16 | **3/10** |
| **12d Model** | Low | Low | No | Limited | 8-12 | **2/10** |

### 2.2 Quadrant Analysis

```
                        HIGH SALES IMPACT
                              |
     Procore *          |          * Primavera P6
     Xero *             |          * Aconex
     Excel Import *     |          * COINS/Viewpoint
     PDF Export *       |
                        |
  LOW EFFORT -----------+----------- HIGH EFFORT
                        |
     SharePoint *       |          * Trimble Connect
     SafetyCulture *    |          * 12d Model
     Employment Hero *  |          * CostX
     MYOB *             |
                        |
                   LOW SALES IMPACT
```

**Key insight:** The top-left quadrant (high impact, low effort) contains the four recommended Phase 1 integrations. Procore sits at the boundary -- higher effort but exceptional sales impact through marketplace distribution.

---

## 3. Recommended Phase 1 Integrations

### 3.1 Excel/CSV Import & PDF Export (Weeks 1-4)

**Why first:** Eliminates the single largest adoption barrier. Every civil contractor has lot registers, ITP templates, and hold-point checklists in Excel. Without import, onboarding requires manual re-entry of hundreds of records.

**Scope:**
- **Lot register import:** CSV/XLSX with columns for lot number, description, location, discipline, status, planned dates
- **ITP template import:** CSV/XLSX with activity, reference standard, acceptance criteria, inspection type (H/W/R/S), responsibility, frequency
- **Hold point register import:** CSV with lot reference, ITP step, status, inspector, date
- **PDF export:** ITP completion reports, lot summary reports, NCR reports formatted to match state authority expectations (A4, ISO-style headers, signature blocks, photo evidence grids)

**Data format details:** See Section 5.

**Effort estimate:** 2-4 weeks for import engine + templates; 2-3 weeks for PDF report templates.

**Sales impact:** Addresses the "but we already use Excel" objection head-on. Enables 1-day onboarding for a 500-lot project instead of 2 weeks of manual entry.

### 3.2 Procore Integration (Weeks 3-12)

**Why Procore:** Procore is the dominant construction management platform in Australia with 313+ customers. Being listed in the [Procore App Marketplace](https://marketplace.procore.com/) provides:
- Distribution to 1.4 million global users
- Credibility signal for enterprise buyers ("if it's in the marketplace, it's vetted")
- Australia is the second-largest partner country at 7.58% of ISV partners
- Over 75% of ANZ customers integrate with local partners

**Integration scope:**
- **Inbound from Procore:** Project data, lot/specification data, user/contact lists, document references
- **Outbound to Procore:** Completed ITP reports (PDF to Procore Documents), NCR records, hold point sign-off status, daily diary summaries
- **Bi-directional:** Project team members and roles, quality issue tracking

**Technical approach:**
- Procore REST API with OAuth 2.0 authentication
- Webhooks for real-time sync (lot status changes, new NCRs)
- Must pass Procore marketplace technical review (no private APIs, no AI training on data)
- Publish to Procore App Marketplace for distribution

**Effort estimate:** 6-10 weeks (including marketplace listing and review process)

**Marketplace requirements:**
- Accurate, complete listing maintained regularly
- Compliance with Partner Program terms
- No use of private/undocumented APIs
- No use of Procore data for AI/ML training
- Must pass technical requirements review

### 3.3 Xero Integration (Weeks 5-10)

**Why Xero:** ~60% of AU online accounting market share. Even mid-tier contractors using MYOB for payroll often use Xero for project-level financials. The Xero API is mature with excellent developer experience.

**Integration scope:**
- **Outbound to Xero:** Progress claim line items as draft invoices, docket costs as expense records
- **Inbound from Xero:** Payment status on claims, cost code mappings
- **Sync:** Contact/supplier lists, project cost centres

**Technical approach:**
- Xero REST API with OAuth 2.0 (PKCE flow)
- Webhooks available for invoice status changes (HMAC-SHA256 signed)
- Node.js SDK available (`xero-node`)
- Rate limits: 60 calls/minute, 5,000/day, 5 concurrent
- Webhook endpoint must respond within 5 seconds

**Effort estimate:** 4-6 weeks

**Sales pitch:** "Your foreman approves a docket on-site at 3pm. By 3:01pm, the cost is in your Xero project, and your PM can see the impact on the progress claim -- no double entry."

### 3.4 Microsoft 365 / SharePoint (Weeks 8-14)

**Why SharePoint:** Ubiquitous in corporate environments and increasingly used by mid-market contractors for document management. Provides enterprise "checkbox" credibility.

**Integration scope:**
- **Document sync:** Push completed ITP reports, NCR records, and daily diary exports to designated SharePoint project folders
- **SSO:** Azure AD / Microsoft Entra ID single sign-on
- **Teams notifications:** Quality alerts and hold-point notifications via Microsoft Teams webhooks

**Technical approach:**
- Microsoft Graph API (REST, well-documented)
- Azure AD OAuth 2.0 for authentication
- SharePoint REST API for document upload
- Teams Incoming Webhooks for notifications

**Effort estimate:** 4-6 weeks

### 3.5 SafetyCulture (iAuditor) Integration (Weeks 10-16)

**Why SafetyCulture:** Australian-founded, used by 75,000+ organisations globally. Many civil contractors already use it for safety inspections. Bidirectional quality data flow reduces the "two-app" problem.

**Integration scope:**
- **Inbound from SafetyCulture:** Completed quality inspection results, photo evidence, defect/issue reports
- **Outbound to SafetyCulture:** ITP checklists as inspection templates, lot-specific inspection assignments
- **Sync:** Issue/NCR tracking across both platforms

**Technical approach:**
- SafetyCulture REST API with OAuth 2.0
- Webhook triggers on inspection completion
- Existing Procore integration model provides a pattern to follow
- PDF report auto-upload capability

**Effort estimate:** 4-6 weeks

---

## 4. API and Webhook Availability per Platform

### 4.1 Detailed API Matrix

| Platform | API Type | Auth Method | Webhooks | SDK (Node.js) | Rate Limits | Sandbox/Test | Marketplace |
|----------|----------|-------------|----------|---------------|-------------|-------------|-------------|
| **Procore** | REST | OAuth 2.0 | Yes | Yes | Per-app limits | Yes (sandbox) | Yes -- 539 apps |
| **Xero** | REST | OAuth 2.0 (PKCE) | Yes (HMAC-SHA256) | Yes (`xero-node`) | 60/min, 5K/day | Yes (demo org) | Yes -- Xero App Store |
| **MYOB Business** | REST | OAuth 2.0 | Yes (virtual) | Limited | Documented | Yes | Yes -- MYOB Add-Ons |
| **MYOB EXO** | REST/SOAP | API Key | Limited | No | Documented | Limited | No |
| **SharePoint/M365** | REST (Graph) | Azure AD OAuth 2.0 | Yes (subscriptions) | Yes (`@microsoft/microsoft-graph-client`) | Per-endpoint | Yes | Yes -- AppSource |
| **SafetyCulture** | REST | OAuth 2.0 / API Key | Yes | Community | Documented | Yes | Yes |
| **Employment Hero** | REST | OAuth 2.0 | Limited | No | Documented | Yes | Limited |
| **KeyPay** | REST | OAuth 2.0 / API Key | Limited | No | Documented | Yes | No |
| **ELMO** | REST | OAuth 2.0 | No | No | Undocumented | Limited | No |
| **Primavera P6** | REST | Basic/OAuth | No (Dataverse webhooks) | No | Per-instance | Yes | No |
| **Powerproject** | File export only | N/A | No | No | N/A | N/A | No |
| **Aconex (Oracle)** | REST | OAuth 2.0 | Limited | No | Per-tenant | Yes (via Oracle) | Oracle marketplace |
| **Trimble Connect** | REST | OAuth 2.0 | Yes | Yes | Documented | Yes | Trimble App Xchange |
| **12d Model** | File-based (.12da) | N/A | No | No | N/A | N/A | No |
| **CostX** | File export (Excel) | N/A | No | No | N/A | N/A | No |
| **Buildsoft Cubit** | None | N/A | No | No | N/A | N/A | No |
| **COINS Evo** | REST | API Key/OAuth | Limited | No | Per-tenant | Limited | No |
| **Viewpoint Vista** | REST (AppXchange) | OAuth 2.0 | Yes | No | Documented | Yes | AppXchange |
| **Jonas Construction** | Limited REST | Varies | No | No | Undocumented | Limited | Procore marketplace only |
| **Chevin FleetWave** | REST | API Key | No | No | Undocumented | Limited | No |
| **Teletrac Navman** | REST (Open API) | API Key | Limited | No | Undocumented | Limited | No |

### 4.2 API Maturity Tiers

**Tier A -- Excellent (build with confidence):**
- Procore, Xero, Microsoft Graph/SharePoint, Trimble Connect
- Characteristics: Comprehensive REST APIs, OAuth 2.0, webhooks, official SDKs, sandbox environments, active developer communities

**Tier B -- Good (build with caution):**
- MYOB Business, SafetyCulture, Employment Hero/KeyPay, Viewpoint Vista (AppXchange)
- Characteristics: REST APIs available, OAuth auth, limited webhook support, SDKs may be community-maintained

**Tier C -- Limited (file-based integration likely):**
- Primavera P6, Aconex, COINS Evo, Chevin, Teletrac Navman
- Characteristics: APIs exist but may be complex, require enterprise licensing, or have limited documentation

**Tier D -- File export only:**
- Powerproject, CostX, Buildsoft Cubit, 12d Model
- Characteristics: Integration via CSV/Excel/XML file export/import only; no real-time API

---

## 5. Data Format Requirements

### 5.1 Lot Register Import Format

Based on research into how AU civil contractors manage lot data, the standard import template should support:

**CSV/XLSX columns:**

| Column | Required | Type | Description | Example |
|--------|----------|------|-------------|---------|
| `lot_number` | Yes | String | Lot identifier | "L-001", "42A" |
| `description` | Yes | String | Lot description | "Subgrade preparation, Ch 1200-1400" |
| `discipline` | No | String | Engineering discipline | "Earthworks", "Drainage", "Pavement" |
| `location` | No | String | Chainage or grid reference | "Ch 1200-1400 LHS" |
| `itp_template` | No | String | ITP template reference | "ITP-EW-001" |
| `spec_reference` | No | String | Specification clause | "Clause 301, MRTS05" |
| `planned_start` | No | Date | Planned start date | "2026-03-15" |
| `planned_end` | No | Date | Planned completion | "2026-03-22" |
| `status` | No | String | Current status | "Open", "In Progress", "Complete" |
| `assigned_to` | No | Email | Responsible person | "foreman@contractor.com.au" |
| `notes` | No | String | Additional notes | "Requires compaction testing" |

**Key design decisions:**
- Support both `.csv` and `.xlsx` formats (contractors use both)
- Auto-detect column headers (fuzzy matching for common variations like "Lot No." / "Lot Number" / "Lot #")
- Preview mode before committing import
- Duplicate detection by lot number within a project
- Bulk import up to 5,000 lots per upload

### 5.2 ITP Template Import Format

**CSV/XLSX columns:**

| Column | Required | Type | Description | Example |
|--------|----------|------|-------------|---------|
| `step_number` | Yes | Integer | Sequence number | 1, 2, 3 |
| `activity` | Yes | String | Activity/work element | "Proof roll subgrade" |
| `reference` | Yes | String | Spec/standard reference | "MRTS05 Cl 8.2" |
| `acceptance_criteria` | Yes | String | Pass/fail criteria | "No visible deflection >25mm" |
| `inspection_type` | Yes | Enum | H=Hold, W=Witness, R=Review, S=Surveillance | "H" |
| `responsible_party` | No | String | Who inspects | "Superintendent", "Contractor QA" |
| `frequency` | No | String | How often | "Every lot", "1 per 500m3" |
| `records_required` | No | String | Evidence needed | "Test certificate, photos" |
| `notification_period` | No | String | Advance notice needed | "24 hours", "48 hours" |

**Key design decisions:**
- Import from both Excel tables and Word document tables (many ITPs exist as Word docs)
- Support CQA (Construction Quality Association) standard template format
- Support AUSSPEC template format
- Map hold/witness/review/surveillance points correctly on import
- Preserve spec references and hyperlinks where possible

### 5.3 PDF Export Formats -- State Authority Requirements

Australian state road and infrastructure authorities have specific expectations for quality documentation:

| Authority | State | Key Format Requirements |
|-----------|-------|------------------------|
| **TMR** (Transport and Main Roads) | QLD | MRTS spec references, TMR ITP forms, lot-based completion records |
| **TfNSW** (Transport for NSW) | NSW | RMS QA specs, hold point notification forms, 3rd-party test certificates |
| **MRPV** (Major Road Projects Victoria) | VIC | VicRoads spec references, MRPV quality system requirements |
| **DIT** (Dept. Infrastructure and Transport) | SA | DPTI standard forms, lot completion documentation |
| **Main Roads WA** | WA | MRWA spec references, quality system manual requirements |
| **ARTC** (Australian Rail Track Corp) | National | EGP-20-02 ITP procedure, ARTC-specific hold point forms |

**Common PDF requirements across all authorities:**
- A4 portrait orientation
- Company logo and project header block
- Revision/version control block
- Signature blocks (digital signatures increasingly accepted)
- Photo evidence grid (typically 2x3 or 3x3 per page)
- QR code or reference number for digital traceability
- Lot number, chainage, and date prominently displayed
- Test result summary tables
- Non-conformance cross-references
- Export as PDF/A for long-term archival

**Recommended SiteProof PDF templates (Phase 1):**
1. ITP Completion Report (lot-level)
2. Hold Point Release Certificate
3. NCR Report (individual + register)
4. Lot Summary Report
5. Daily Diary Export
6. Progress Claim Supporting Documentation

### 5.4 Common Data Exchange Formats

| Data Type | Import Formats | Export Formats | Notes |
|-----------|---------------|---------------|-------|
| Lot registers | CSV, XLSX | CSV, XLSX, PDF | Must handle AU date formats (DD/MM/YYYY) |
| ITP templates | CSV, XLSX, DOCX (table extraction) | PDF, XLSX | Word table parsing needed for legacy ITPs |
| Test results | CSV (from lab systems) | PDF (certificates), CSV | Labs typically provide CSV or PDF |
| NCR records | N/A (created in-app) | PDF, CSV register | PDF must match authority expectations |
| Daily diary | N/A (created in-app) | PDF, CSV | Weather data integration opportunity |
| Progress claims | XLSX (claim schedules) | PDF, XLSX | Must match head contract claim format |
| Photos | JPEG, PNG, HEIC | JPEG (in PDF reports) | EXIF GPS data extraction for location |
| Survey data | CSV (from Trimble/12d) | N/A | Chainage and coordinates for lot linking |

---

## 6. Competitive Landscape -- Integration Approaches

### 6.1 Direct Competitors and Their Integrations

| Competitor | AU Market Position | Key Integrations | Gaps |
|-----------|-------------------|-----------------|------|
| **Sitemate (Dashpivot)** | Strong mid-market civil | Xero, Procore, email | Limited accounting depth, no ERP |
| **SafetyCulture (iAuditor)** | Safety-first, quality add-on | Procore, SharePoint, Zapier | Not purpose-built for ITP/lot workflow |
| **Procore Quality** | Enterprise, bundled | Native to Procore ecosystem | Expensive, not civil-ITP-specific |
| **CivilPro** | Niche AU civil | CSV import for ITPs | Limited integrations, legacy feel |

### 6.2 SiteProof Differentiation Opportunity

SiteProof can differentiate by being the **integration hub for quality data** rather than trying to replace any existing tool:

1. **"Works with what you already use"** -- Position SiteProof as complementary to Procore/SafetyCulture, not competitive
2. **Civil-specific data model** -- Lot-based ITP workflow is unique; no competitor handles the full H/W/R/S point lifecycle with lot linkage
3. **Accounting bridge** -- Connect field quality data to financial outcomes (approved lots -> claim-ready line items -> Xero invoice)
4. **Authority-ready exports** -- PDF outputs that match what state authorities actually want to see

---

## 7. Action Items

### Immediate (Weeks 1-4)
- [ ] **Build Excel/CSV import engine** for lot registers and ITP templates with column auto-detection and preview mode
- [ ] **Design PDF export templates** for the 6 core report types, matching AU state authority format expectations
- [ ] **Register as Procore Technology Partner** at [procore.com/partners](https://www.procore.com/partners) and begin the App Marketplace onboarding process
- [ ] **Create Xero developer app** at [developer.xero.com](https://developer.xero.com/) and request API access

### Short-term (Weeks 5-12)
- [ ] **Build Procore integration** -- project sync, document upload, quality data push; target marketplace listing
- [ ] **Build Xero integration** -- progress claim to invoice flow, docket cost sync
- [ ] **Create import template library** -- downloadable XLSX templates for lot registers and common ITP types (earthworks, drainage, pavement, structures)
- [ ] **Test PDF exports** with 3+ real contractors against their actual authority submission requirements

### Medium-term (Months 4-8)
- [ ] **Build SharePoint/M365 integration** -- document sync, Azure AD SSO, Teams notifications
- [ ] **Build SafetyCulture integration** -- bi-directional inspection data flow
- [ ] **Evaluate MYOB integration** -- if customer demand warrants (monitor support requests and sales conversations)
- [ ] **Build Employment Hero / KeyPay connector** -- time/attendance data from daily diary to payroll

### Long-term (Months 9-12)
- [ ] **Evaluate Primavera P6 / Powerproject** scheduling integration via REST API / file import
- [ ] **Explore ERP connectors** (COINS, Viewpoint Vista) for tier-1 contractor pipeline
- [ ] **Investigate Trimble Connect** integration for surveying data linkage to lots
- [ ] **Build Zapier/Make connector** as catch-all for long-tail integrations

### Ongoing
- [ ] **Monitor API changes** for all integrated platforms (subscribe to developer changelogs)
- [ ] **Track integration usage analytics** -- which integrations drive retention and expansion
- [ ] **Collect integration feature requests** from sales pipeline and customer success
- [ ] **Maintain integration documentation** and status page for customers

---

## 8. Sources

### Industry Reports and Surveys
- [State of Digital Adoption in the Construction Industry 2025 -- Autodesk/Deloitte](https://www.deloitte.com/au/en/services/economics/analysis/state-digital-adoption-construction-industry.html)
- [Future of Construction: 2026 Contractor Survey Insights -- Trimble](https://www.trimble.com/blog/trimble/en-US/article/future-construction-technology-trends-contractor-survey)
- [2026 Construction Trends: 25+ Experts Share Insights -- Autodesk Digital Builder](https://www.autodesk.com/blogs/construction/2026-construction-trends-25-experts-share-insights/)
- [What Technologies are Shaping Australia's Construction Sector in 2025 -- Australian Tenders](https://info.australiantenders.com.au/blog/digital-adoption-in-construction)
- [Digital Technology Transforms Construction in ANZ -- Visibuild](https://visibuild.com/state-of-digital-adoption-construction-2025/)
- [Construction 4.0 in Australia -- ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2444569X25001672)

### Accounting Software
- [MYOB vs Xero: Which Is Better for Aussie SMBs in 2026 -- Arielle](https://arielle.com.au/myob-vs-xero/)
- [Small Business Accounting Software Comparison: Xero vs MYOB Australia 2026 -- ScaleSuite](https://www.scalesuite.com.au/resources/best-small-business-accounting-software-australia)
- [MYOB or Xero: Which Is Best in Australia for 2025 -- ProfitBooks](https://profitbooks.net/myob-or-xero-in-australia/)
- [MYOB vs Xero: Pros and Cons -- Liston Newton](https://www.listonnewton.com.au/information-centre/xero-vs-myob-which-will-work-better-for-your-business)

### API Documentation and Developer Resources
- [Procore API Documentation](https://developers.procore.com/)
- [Procore Marketplace Requirements](https://developers.procore.com/documentation/partner-content-reqs)
- [Xero Developer Platform](https://developer.xero.com/)
- [Xero Webhooks Documentation](https://developer.xero.com/documentation/guides/webhooks/overview/)
- [MYOB Developer Centre](https://developer.myob.com/)
- [MYOB Business API Introduction](https://apisupport.myob.com/hc/en-us/articles/4407275101967-Introducing-the-MYOB-Business-API)
- [Employment Hero Payroll API Reference](https://api.keypay.com.au/australia/guides/Home)
- [Employment Hero Developer Documentation](https://developer.employmenthero.com/)
- [ELMO Developer API](https://developer.elmotalent.com.au/)
- [Oracle Aconex APIs -- Support Central](https://help.aconex.com/aconex/aconex-apis/)
- [Oracle Aconex Cloud Adapter Documentation](https://docs.oracle.com/en/industries/construction-engineering/smart-construction-platform/aconex-adapter/using-oracle-aconex-cloud-adapter-oracle-integration-3.pdf)
- [Primavera P6 EPPM REST API Documentation](https://docs.oracle.com/cd/F37125_01/English/Integration_Documentation/rest_api/index.html)
- [Trimble Connect API Documentation](https://help.trimble.com/en/trimble-connect/trimble-connect/welcome-to-trimble-connect/trimble-connect-api-documentation-resources)
- [Trimble Developer Docs](https://www.trimble.com/en/developer/docs)
- [12d Model Trimble Link](https://www.12d.com/multimedia/trimble_link.html)
- [Microsoft Graph API -- SharePoint](https://learn.microsoft.com/en-us/power-platform/admin/set-up-sharepoint-integration)
- [Microsoft Project Schedule APIs](https://learn.microsoft.com/en-us/dynamics365/project-operations/project-management/schedule-api-preview)
- [Viewpoint Vista Cloud APIs FAQ](https://sites.google.com/trimble.com/vista-cloud-faq/home/integration-technology/vista-apis)
- [SafetyCulture Integrations Marketplace](https://integrations.safetyculture.com/)
- [SafetyCulture Procore Integration Guide](https://help.safetyculture.com/en-US/001088/)
- [Chevin FleetWave Integrations](https://www.chevinfleet.com/integrations/)
- [Teletrac Navman Integrations](https://www.teletracnavman.com/fleet-management-software/integrations-enhancements)

### Procore Market Data
- [Procore Market Share -- 6sense](https://6sense.com/tech/project-collaboration/procore-market-share)
- [Procore App Marketplace -- 539 Apps](https://appmarketplace.com/marketplaces/procore-app-marketplace/)
- [Procore ANZ -- Leading Construction Companies](https://www.procore.com/en-au/lp/procore-construction-management-platform)
- [Best Procore App Marketplace Partners 2025 -- G2](https://www.g2.com/categories/procore-app-marketplace-partners)

### ITP and Quality Templates
- [CQA Guide: How to Create an ITP](https://www.cqa.org.au/post/guide-how-to-create-an-inspection-and-test-plan-itp)
- [Sitemate ITP Construction Template](https://sitemate.com/templates/quality/forms/itp-construction-template/)
- [SafetyCulture ITP Templates](https://safetyculture.com/checklists/inspection-test-plan)
- [Builder Assist ITP Templates](https://www.builderassist.com.au/product/itp-inspection-test-plan-template/)
- [ARTC Inspection and Test Plans Procedure EGP-20-02](https://extranet.artc.com.au/docs/eng/all/procedures/egp-20-02.pdf)
- [Greater Taree Council AUSSPEC ITP Forms](https://www.midcoast.nsw.gov.au/files/assets/public/v/3/document-resources/development/stage-2/roads-amp-bridges/design-guide-amp-construction-specs/manning-specs/aus-spec/engineering-development-quality-inspection-test-plan-itp-forms.pdf)
- [CivilPro CSV Import for ITPs](https://civilpro.zendesk.com/hc/en-us/articles/4407225710095-Import-ITP-from-CSV-files)

### Estimating Software
- [Construction Estimating Software in Australia 2026 -- Buildern](https://buildern.com/resources/blog/construction-estimating-software-in-australia/)
- [Estimation Software in Australia and New Zealand -- ConsultANZ](https://www.consultanz.com.au/overview-of-estimation-software-used-in-australia-and-new-zealand/)
- [RIB CostX](https://www.rib-software.com/en/rib-costx)

### Scheduling Software
- [Asta Powerproject -- Elecosoft](https://elecosoft.com/products/asta/asta-powerproject/)
- [Powerproject Integration with Power BI -- Acumine](https://acumine.com/asta-powerproject-integration-with-microsoft-fabric-and-power-bi/)
- [Oracle Primavera P6](https://www.oracle.com/construction-engineering/primavera-p6/)

### Competitors
- [Sitemate (Dashpivot) -- Civil Construction Software](https://sitemate.com/au/industries/civil/)
- [Sitemate Quality Management](https://sitemate.com/au/quality/quality-project-management-software/)
- [Best 10 Procore Alternatives -- Kynection](https://www.kynection.com.au/best-10-procore-alternatives-for-integrated-construction/)
- [Procore Competitors 2026 -- G2](https://www.g2.com/products/procore/competitors/alternatives)

### Payroll for Construction
- [Best Payroll Software for Australian Construction -- Accountix](https://www.accountix.com.au/trade-business-software/what-is-the-best-payroll-software-for-australian-construction/)
- [Top 10 Payroll Solutions for Australian Businesses -- Access Group](https://www.theaccessgroup.com/en-au/payroll/software/compare/top-10-payroll-software/)

### ERP for Construction
- [Best ERP for Construction 2025 -- Access Group](https://www.theaccessgroup.com/en-au/erp/software/construction/best-erp-for-construction-industry/)
- [Access COINS Evo](https://www.theaccessgroup.com/en-au/construction/products/coins/)
- [Viewpoint Vista -- Kynection Integration](https://www.kynection.com.au/partner/viewpoint-vista/)

---

*Report compiled: February 2026*
*Next review: May 2026 (or upon completing Phase 1 integrations)*
