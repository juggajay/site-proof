# AI Research Prompt: Australian Civil Construction ITP Template Library

## Context

I'm building **SiteProof**, a civil construction quality assurance application used by contractors in Australia. The app uses **Inspection and Test Plans (ITPs)** to track quality compliance on road and civil infrastructure projects.

I need to create a comprehensive database of ITP templates covering all major Australian state road authority specifications. These templates will be used by construction supervisors to:
- Track completion of quality checkpoints
- Document hold points and witness points
- Link test results to specification requirements
- Generate conformance records

---

## Research Plan

Execute the following 9-step research plan:

### (1) Locate Official Specification Libraries

Locate the official Technical Specification libraries and current publication lists for all required authorities:

| State | Specification Set | Full Name | Authority Website |
|-------|------------------|-----------|-------------------|
| National | **Austroads** | Austroads Guide to Road Design & Construction | austroads.com.au |
| QLD | **MRTS** | Main Roads Technical Specification | tmr.qld.gov.au |
| NSW | **TfNSW / RMS** | Transport for NSW Specifications | transport.nsw.gov.au |
| VIC | **VicRoads** | VicRoads Standard Specifications | roads.vic.gov.au |
| WA | **MRWA** | Main Roads Western Australia Specs | mainroads.wa.gov.au |
| SA | **DIT** | Dept Infrastructure and Transport | dit.sa.gov.au |
| TAS | **DoSG** | Dept of State Growth Specifications | stategrowth.tas.gov.au |
| NT | **DIPL** | Dept Infrastructure Planning Logistics | dipl.nt.gov.au |

**Capture:** Current revision numbers and publication dates for all major specification documents.

---

### (2) High Priority Specifications - Detailed Extraction

For **QLD MRTS**, **Austroads**, and **TfNSW**, extract detailed information for the following activity types:

**EARTHWORKS**
- Site Clearing & Grubbing
- Bulk Excavation
- Rock Excavation
- Fill Placement & Compaction
- Subgrade Preparation
- Embankment Construction
- Batter Construction

**PAVEMENT - UNBOUND**
- Select Fill / Capping Layer
- Sub-base (unbound granular)
- Base Course (unbound granular)
- Shoulder Construction

**PAVEMENT - BOUND**
- Cement Treated Sub-base (CTSB)
- Cement Treated Base (CTB)
- Lean Mix Concrete Sub-base
- Foamed Bitumen Stabilisation

**ASPHALT**
- Prime & Primerseal
- Tack Coat Application
- Dense Graded Asphalt (DGA)
- Stone Mastic Asphalt (SMA)
- Open Graded Asphalt (OGA)
- Asphalt Profiling/Milling

**CONCRETE**
- Mass Concrete
- Structural Concrete (bridges, retaining walls)
- Reinforcement Placement
- Concrete Pavement (Plain, Reinforced, CRCP)
- Precast Concrete Elements

**For each activity, extract:**
- Specification document reference (number, title, revision)
- Pre-Work submission requirements
- Hold Points (H) with exact clause numbers
- Witness Points (W) with exact clause numbers
- Testing requirements and frequencies

---

### (3) Medium & Low Priority Specifications

**Medium Priority: VicRoads, MRWA**

Research the same activity list, specifically looking for:
- Differences in compaction standards (e.g., Scale A/B/C classifications)
- Material classifications unique to the state
- State-specific test methods compared to national baseline
- Any unique hold point or witness point requirements

**Low Priority: SA (DIT), TAS (DoSG), NT (DIPL)**

For these states:
- Identify the governing specification numbers for major activity groups
- Determine if they reference Austroads directly or have standalone requirements
- Note any unique hold/witness point requirements

---

### (4) Specialized Activity Deep Dive

Conduct targeted research across ALL jurisdictions for:

**DRAINAGE**
- Pipe Installation (RCP, RCBC, PVC, HDPE)
- Pit & Chamber Construction
- Box Culverts
- Headwalls & Wingwalls
- Subsoil Drainage

**STRUCTURES**
- Piling (Bored, Driven, CFA)
- Pile Caps
- Abutments & Piers
- Bridge Deck Construction
- Retaining Walls (MSE, Crib, Cantilever)

**ANCILLARY WORKS**
- Kerb & Channel
- Line Marking
- Signage Installation
- Safety Barriers (W-beam, Wire Rope, Concrete)
- Fencing
- Noise Walls

**LANDSCAPING & ENVIRONMENT**
- Topsoil Placement
- Seeding & Hydromulching
- Erosion & Sediment Control
- Revegetation

**Focus on:**
- Specialized hold points
- Environmental approval requirements
- Weather/temperature limitations
- Material testing criteria

---

### (5) Testing Standards Cross-Reference Table

Create a comprehensive cross-reference table mapping:
- Australian Standards (AS 1289 series)
- QLD methods (Q series)
- NSW methods (T series)
- VIC methods (RC series)
- WA methods (WA series)

**Tests to include:**

| Test Name | AS/NZS Standard | QLD Method | NSW Method | VIC Method | WA Method |
|-----------|----------------|------------|------------|------------|-----------|
| Compaction (Sand Replacement) | AS 1289.5.3.1 | Q103A | T103 | RC 103.01 | WA 103.1 |
| Compaction (Nuclear) | AS 1289.5.8.1 | Q103B | T111 | RC 103.02 | WA 103.2 |
| CBR | AS 1289.6.1.1 | Q113A | T117 | RC 113.01 | WA 113.1 |
| Plasticity Index | AS 1289.3.3.1 | Q104 | T108 | RC 104.01 | WA 104.1 |
| Particle Size Distribution | AS 1289.3.6.1 | Q103A | T105 | RC 105.01 | WA 105.1 |
| Liquid Limit | AS 1289.3.1.1 | Q104 | T108 | RC 104.01 | WA 104.1 |
| Linear Shrinkage | AS 1289.3.4.1 | Q106 | T109 | RC 106.01 | WA 106.1 |
| Moisture Content | AS 1289.2.1.1 | Q102A | T101 | RC 102.01 | WA 102.1 |
| Maximum Dry Density | AS 1289.5.1.1 | Q142A | T111 | RC 142.01 | WA 142.1 |
| Flakiness Index | AS 1141.15 | Q201 | T235 | RC 201.01 | WA 201.1 |
| Aggregate Crushing Value | AS 1141.21 | Q205 | T215 | RC 205.01 | WA 205.1 |
| Los Angeles Value | AS 1141.23 | Q205 | T215 | RC 205.01 | WA 205.1 |

Complete this table with all relevant tests and verify accuracy.

---

### (6) Industry Resources & Best Practices

Research current Australian civil construction industry resources:

**Organizations:**
- CCAA (Cement Concrete & Aggregates Australia)
- AAPA (Australian Asphalt Pavement Association)
- IPWEA (Institute of Public Works Engineering Australasia)
- Roads Australia
- AustStab (Pavement Recycling & Stabilisation Association)

**Extract:**
- Common Non-Conformance Report (NCR) categories
- Best practice guidelines for ITP preparation
- Industry standard checklist formats
- Digital quality assurance trends (GPS tagging, electronic lot registers, BIM integration)

---

### (7) Example ITPs & Quality Plan Templates

Search for and analyze real-world ITP examples:

**Sources to check:**
- State authority websites (often publish example quality plans)
- Major contractor tender documentation (publicly available)
- Published project quality management plans
- Industry association templates

**Purpose:**
- Validate checklist item structures
- Confirm typical sequencing of inspection points
- Identify practical implementation patterns
- Understand documentation formatting used on site

---

### (8) Detailed Criteria Extraction

For EACH researched activity, extract the following specific details:

**A. Acceptance Criteria Values**
- Pass/fail thresholds (e.g., ≥98% MDD, ≤6 PI, ±10mm tolerance)
- Different criteria for different road classes if applicable
- Minimum vs characteristic values

**B. Notification Periods**
- Witness point notification timeframes (24hr / 48hr / 72hr)
- Hold point release response times
- Required notice for inspections

**C. Responsible Party Designations**
- Who performs each check (Contractor QA / Superintendent / Designer / Third Party)
- Who can release hold points
- Who must sign off on documentation

**D. Lot Sizing Definitions**
- How each state defines a "lot" (area, volume, length-based)
- Minimum and maximum lot sizes
- How test frequency scales with lot size

**E. Curing & Weather Limitations**
- Minimum/maximum temperatures for placement
- Rain delay requirements
- Curing periods before testing or loading
- Wind limitations (for spray sealing, line marking)

**F. Defect Rectification Protocols**
- What happens when a test fails
- Re-testing requirements
- NCR escalation paths (minor → major)
- Removal and replacement procedures

---

### (9) Output Format - Raw Data Delivery

**IMPORTANT:** Do NOT create formatted templates. Instead, deliver RAW DATA organized by activity and state that I can use to build templates myself.

**For EACH Activity, provide the following data points:**

#### A. Specification References
```
Activity: [e.g., Unbound Pavement Base Course]
State: [e.g., QLD]
Document: [e.g., MRTS05]
Full Title: [e.g., Unbound Pavements]
Revision: [e.g., Rev 8, October 2023]
URL: [if available]
Related Docs: [e.g., MRS05, MRTS50]
```

#### B. Hold Points (List all with clause references)
```
1. [Description] | Clause: [X.X.X] | Released by: [Role] | Verification: [What's checked]
2. [Description] | Clause: [X.X.X] | Released by: [Role] | Verification: [What's checked]
```

#### C. Witness Points (List all with notification periods)
```
1. [Description] | Clause: [X.X.X] | Notice Required: [24hr/48hr/none]
2. [Description] | Clause: [X.X.X] | Notice Required: [24hr/48hr/none]
```

#### D. Testing Requirements (List each test)
```
Test: [Name]
Method: [AS number or state method]
Frequency: [e.g., 1 per 500m³]
Acceptance: [e.g., ≥98% MDD]
Timing: [Before/During/After placement]
```

#### E. Pre-Work Submissions Required
```
- [Submission 1]
- [Submission 2]
```

#### F. Key Inspection/Verification Items
```
- [What needs to be checked - item 1]
- [What needs to be checked - item 2]
```

#### G. Responsible Parties
```
Contractor QA: [Their responsibilities]
Superintendent: [Their responsibilities]
Third Party: [If applicable]
```

#### H. Lot Sizing
```
Definition: [How state defines a lot]
Typical Size: [Area/volume/length]
Max Size: [If specified]
```

#### I. Weather/Environmental Limits
```
Min Temp: [Value]
Max Temp: [Value]
Rain: [Requirements]
Wind: [If applicable]
Curing: [Period required]
```

#### J. Defect/Failure Protocol
```
Failed Test Action: [Remove/retest/accept with conditions]
NCR Category: [Minor/Major]
Rectification: [Procedure]
```

#### K. State-Specific Notes
```
[Any unique requirements compared to other states]
[Local terminology differences]
[Common issues/gotchas]
```

---

## Important Notes

1. **Mark Unavailable Data:** Where exact information cannot be found, clearly note `[VERIFICATION REQUIRED]` so manual verification can be done before implementation.

2. **Prioritize Accuracy:** The most critical elements are:
   - Specification references (document numbers, clause numbers)
   - Hold point and witness point requirements (contractually important)
   - Test methods and acceptance criteria
   - Test frequencies

3. **Note Conflicts:** If different sources show conflicting information, note both and flag for verification.

4. **Version Currency:** Always note the revision/version of specifications referenced - these documents are updated regularly.

---

## Deliverable Summary

The final deliverable should include RAW DATA (not formatted templates):

1. **Specification Library Index** - All states, all documents, current versions/revisions
2. **Raw Data Per Activity** - Using the format in Section 9 (A-K data points) for each activity/state combination
3. **Testing Standards Matrix** - Complete cross-reference table (AS vs state methods)
4. **Industry Best Practices** - NCR categories, common failure modes, digital trends
5. **Example ITP Analysis** - Key patterns observed (not full templates, just insights)

**I will build the actual templates from this raw data** to match my application's database schema.

---

## Timeline Priority

If the full scope is too extensive for a single research session, prioritize:

**Phase 1 (Essential):**
1. MRTS (Queensland) - Most detailed, well-documented
2. Austroads - National baseline
3. Testing Standards Matrix

**Phase 2 (High Value):**
4. TfNSW (NSW) - High volume of projects
5. VicRoads - Well-structured specifications

**Phase 3 (Complete Coverage):**
6. MRWA (WA)
7. SA, TAS, NT

---

## Questions?

If any clarification is needed on:
- The application structure
- How this data will be used in the ITP template system
- Priority of specific activities or states
- Output format requirements

Please ask before proceeding with research.
