# VicRoads ITP Templates -- Asphalt Surfacing (Priority 1, Templates 6-8)

**Date:** 2026-02-10
**Researcher:** Claude (AI-assisted research)
**Methodology:** Cross-referenced VicRoads Standard Specification Sections, DTP Engineering Standards Index, VicRoads RC Codes of Practice, Austroads guidelines, and council implementations (Wyndham, Frankston, Melbourne) via web research.

---

## Key Finding: Correct VicRoads Section Numbers

The VicRoads section numbers differ from the initial assumptions. Based on the DTP Engineering Standards Index (January 2024):

| Assumed Section | Actual VicRoads Section | Title | Version | Date |
|----------------|------------------------|-------|---------|------|
| Section 410 | **Section 417** | Open Graded Asphalt | Version 5 | 27/12/2018 |
| Section 409 | **Section 404** | Stone Mastic Asphalt | Version 6 | 29/08/2018 |
| Section 408 | **Section 408** (correct) | Sprayed Bituminous Surfacings | Version 13 | 26/08/2022 |

**Additional related sections in the 400 Series:**
- Section 402 -- Removal of Pavement by Cold Planing (v3, 10/06/2014)
- Section 405 -- Regulation Gap Graded Asphalt (v3, 10/06/2014)
- Section 407 -- Dense Graded Asphalt (v17, 14/07/2023) -- primary asphalt spec, heavily referenced
- Section 409 -- Warm Mix Asphalt (not SMA as assumed)
- Section 418 -- High Modulus Asphalt EME2 (v2, 02/11/2023)
- Section 421 -- High Binder Crumb Rubber Asphalt (v3, 03/03/2020)
- Section 422 -- Light Traffic Crumb Rubber Asphalt (v2, 26/11/2019)

**Status Note:** Section 417 (OGA) was marked as "Superseded" on the VicRoads standard documents portal. Section 404 (SMA) was also marked as "Superceded" [sic]. This may indicate these have been consolidated into Section 407 or replaced. The templates below reference the last published standalone versions but flag this for verification.

---

## Key VicRoads RC Test Methods Referenced

| RC Number | Title | Relevance |
|-----------|-------|-----------|
| RC 201.01 | Design of Asphalt Mixes (Marshall Method) | Mix design verification |
| RC 201.12 | Design of Asphalt Mixes (Gyratory Compaction Method) | Modern mix design |
| RC 202.02 | Bulk Density of Compacted Asphalt (Presaturation Method) | Core density |
| RC 316.00 | Density Ratio and Moisture Ratio Lot Characteristics | Field compaction acceptance |
| RC 316.12 | Density Offset Determination | Asphalt density calibration |
| RC 317.01 | Surface Texture by Sand Patch | Texture depth measurement |
| RC 317.03 | Surface Texture (alternative method) | Texture depth |
| RC 500.01 | Registration of Bituminous Mix Designs | Mix registration (July 2023) |
| RC 500.05 | Acceptance of Field Compaction | Compaction acceptance criteria |
| RC 500.09 | Testing Aggregates for Sprayed Bituminous Surfacing | Seal aggregate testing |
| RC 500.16 | Selection of Test Methods for Testing of Materials and Work | Test method selection guide |
| RC 500.22 | Selection and Design of Pavements and Surfacings | Pavement design |

**Australian Standards commonly referenced:**
- AS 2891.14.5 -- In situ air voids determination
- AS 2150 -- Hot mix asphalt (general)
- AS 2891.3.3 -- Fibre content in asphalt (when cellulose fibres present)
- AS/NZS 2891.2.1 -- Binder content by ignition
- ATS 3110 -- Polymer Modified Binder specification
- Austroads AGPT/T101 -- Sampling polymer modified binders

---

## Confidence Notes

**HIGH CONFIDENCE items:** Section numbers, version dates, test method numbers, general clause structure, and typical Australian asphalt acceptance values are well-established through multiple sources.

**MEDIUM CONFIDENCE items:** Specific clause numbers within Sections 404, 408, and 417 are based on the standard VicRoads clause numbering pattern (e.g., 417.04, 417.05) and cross-referenced where possible. Some specific acceptance values are drawn from Australian industry norms applied by VicRoads.

**LOW CONFIDENCE / [VERIFY] items:** Exact clause numbers for some hold points and acceptance table references within the superseded Sections 404 and 417. These should be verified against the actual downloaded .docx specification files before deployment.

---

# Template 6: Open Graded Asphalt (OGA)

```
Template Name: Open Graded Asphalt (OGA)
Activity Type: asphalt
Specification Reference: VicRoads Section 417
Edition/Revision Date: Version 5, 27/12/2018 (Note: marked as Superseded -- may now be within Section 407 v17)
```

## Checklist Items

### Pre-Work Submissions

```
Item #: 1
Description: Submit mix design for OGA registered in accordance with RC 500.01, including aggregate grading, binder type/content, and design air voids
Acceptance Criteria: Mix registered with VicRoads/ARRB as per RC 500.01; PMB type compliant with ATS 3110; design air voids typically 18-22%
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: RC 500.01 / RC 201.01 or RC 201.12
Notes: Clause 417.04 [VERIFY]. Mix must be registered at least 2 months prior to supply. Only "General" registered mixes unless Superintendent approves otherwise. OGA typically uses polymer modified binder (A10E or S45R PMB).
```

```
Item #: 2
Description: Submit Quality Plan for OGA works including placement procedures, plant details, rolling patterns, joint treatment methods, and testing schedule
Acceptance Criteria: Quality Plan addresses all requirements of Section 417; approved by Superintendent prior to works commencing
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 417.03 [VERIFY]. Standard VicRoads quality system requirement. Must include proposed lot sizes, testing frequencies, corrective action procedures.
```

```
Item #: 3
Description: Submit evidence that asphalt plant is capable of producing OGA to registered mix design including calibration records and plant trial results
Acceptance Criteria: Plant production trial demonstrates consistent mix within registered tolerances; binder drain-down test results within limits
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: AS 2891.3.3 (fibre content if applicable) / Schellenberg drain-down test
Notes: Clause 417.04 [VERIFY]. OGA is sensitive to production temperature -- plant must demonstrate temperature control capability. Drain-down at production temperature must not exceed 0.3% by mass.
```

```
Item #: 4
Description: Verify source and quality of coarse aggregate for OGA including polished stone value, Los Angeles abrasion, and particle shape
Acceptance Criteria: Aggregate compliant with Section 801 and RC 500.01 requirements; PSV >= 45 for wearing course [VERIFY]; LA abrasion <= 30% [VERIFY]; flakiness index within limits
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1141.40 (PSV) / AS 1141.23 (LA) / AS 1141.15 (Flakiness)
Notes: Clause 417.05 [VERIFY]. OGA requires premium aggregate due to open texture and direct tyre contact. Aggregate must comply with VicRoads Section 801 requirements.
```

```
Item #: 5
Description: Verify polymer modified binder (PMB) compliance with specification requirements and ATS 3110
Acceptance Criteria: PMB meets ATS 3110 Class A10E or S45R [VERIFY]; softening point, elastic recovery, and viscosity within specified ranges
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Austroads AGPT/T101 (sampling PMB)
Notes: Clause 417.05 [VERIFY]. OGA requires PMB to resist binder drain-down and provide durable adhesion in open matrix. Binder must be sampled per AGPT/T101.
```

### Surface Preparation

```
Item #: 6
Description: Inspect underlying pavement surface (tack coat substrate) for compliance with level and condition requirements prior to OGA placement
Acceptance Criteria: Substrate surface within level tolerances per Section 407; free of loose material, dust, and standing water; any repairs completed
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 417.06 [VERIFY]. The wearing course beneath OGA is critical as it is the structural wearing course layer. OGA sits on top as a functional layer only.
```

```
Item #: 7
Description: Apply tack coat to substrate surface at specified rate and verify uniform coverage and curing
Acceptance Criteria: Tack coat applied uniformly at rate specified in design (typically 0.2-0.4 L/m2 residual [VERIFY]); adequately cured/broken before OGA placement; no excess pooling
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 417.06 [VERIFY]. Tack coat adhesion is critical for OGA -- delamination is a common failure mode. Uniform application rate across full width required.
```

### Trial Section / First Production

```
Item #: 8
Description: Construct trial section of OGA to demonstrate compliance with mix design, placement procedures, and compaction capability
Acceptance Criteria: Trial section meets all specification requirements including air voids, permeability, texture depth, and compaction; Superintendent approves trial results before main works proceed
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: RC 316.00 / RC 317.01 / permeability test
Notes: Clause 417.07 [VERIFY]. Trial section typically 200-500m length. Must demonstrate achievable compaction, acceptable texture depth, and adequate permeability. Results establish benchmarks for main production.
```

```
Item #: 9
Description: Verify OGA temperature at first load delivery to site and confirm within placement temperature range
Acceptance Criteria: OGA temperature at delivery within manufacturer's recommended range for PMB type; typically 140-170 deg C depending on binder [VERIFY]; not below minimum placement temperature
Point Type: witness
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Infrared thermometer / calibrated probe
Notes: Clause 417.08 [VERIFY]. OGA is more sensitive to temperature than DGA. Too hot causes drain-down; too cold prevents compaction. Temperature to be recorded at truck and behind paver.
```

### During Placement

```
Item #: 10
Description: Monitor paver operation for consistent speed, screed settings, material feed, and head of material in hopper
Acceptance Criteria: Paver speed consistent (typically 3-5 m/min for OGA [VERIFY]); screed temperature adequate; continuous material feed; no segregation visible
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 417.08 [VERIFY]. OGA is prone to segregation due to open grading. Paver hopper must be kept at least half full at all times. Material transfer vehicle (MTV) recommended.
```

```
Item #: 11
Description: Monitor asphalt temperature during placement at regular intervals behind the paver screed
Acceptance Criteria: Mat temperature within specified range; no areas below minimum placement temperature; temperature recorded at minimum every 100m or per load [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Infrared thermometer
Notes: Clause 417.08 [VERIFY]. Temperature monitoring is critical for OGA. Low temperature areas indicate potential compaction deficiency and permeability issues.
```

```
Item #: 12
Description: Monitor weather conditions during OGA placement to ensure compliance with specification limits
Acceptance Criteria: Air temperature >= 10 deg C [VERIFY]; no rain or standing water on surface; wind speed within acceptable limits; pavement surface temperature >= 10 deg C [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 417.07 [VERIFY]. OGA must not be placed in rain or on wet surfaces. Minimum temperatures may be higher than DGA due to open texture cooling rapidly.
```

```
Item #: 13
Description: Verify rolling pattern and compaction procedures in accordance with approved Quality Plan and trial section results
Acceptance Criteria: Rolling pattern matches approved procedure; static steel roller used (no vibration for OGA [VERIFY]); number of passes as per trial; no displacement or cracking of mat
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 417.08 [VERIFY]. OGA is typically compacted with static steel rollers only -- pneumatic or vibratory rollers can crush the open matrix. Minimum 2-3 static passes typical [VERIFY].
```

```
Item #: 14
Description: Verify longitudinal and transverse joint construction for OGA including overlap, temperature, and compaction at joints
Acceptance Criteria: Joints properly formed with minimal cold joint exposure; hot joint preferred where possible; no segregation or ravelling at joints; joints rolled within temperature requirements
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 417.08 [VERIFY]. OGA joints are particularly vulnerable to ravelling. Cold longitudinal joints should be cut back to sound material and tack coated before abutting.
```

### Compaction and Density Testing

```
Item #: 15
Description: Determine lot boundaries for compaction testing in accordance with specification and approved lot sizes
Acceptance Criteria: Lot size as specified (typically 300-500 tonnes or area-based [VERIFY]); lot boundaries identified and documented; minimum 6 test locations per lot per RC 316.00
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: RC 316.00
Notes: Clause 417.09 [VERIFY]. Where total OGA quantity exceeds 300 tonnes, compaction tested on lot basis. Each lot to have 6 random core locations per RC 316.00.
```

```
Item #: 16
Description: Extract cores and test for in-situ air voids and density of compacted OGA
Acceptance Criteria: Characteristic in-situ air voids (CAV) within specified range; OGA design air voids typically 18-22%; CAV = AV + (0.92 x S_AV) per RC 500.05 [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: RC 316.00 / AS 2891.14.5 / RC 500.05
Notes: Clause 417.09 [VERIFY]. OGA is unique -- high air voids are required for permeability function. Both too-high and too-low air voids are problematic. Cores tested per AS 2891.14.5.
```

### Permeability Testing

```
Item #: 17
Description: Test permeability of compacted OGA to confirm adequate drainage function
Acceptance Criteria: Permeability meets specification minimum [VERIFY]; visual confirmation of water draining through OGA layer; no ponding on surface
Point Type: witness
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Falling head permeameter or equivalent [VERIFY]
Notes: Clause 417.09 [VERIFY]. Permeability is the primary functional requirement for OGA. Insufficient permeability (due to over-compaction or fines contamination) defeats the purpose of OGA.
```

### Surface Quality

```
Item #: 18
Description: Measure surface texture depth of completed OGA using sand patch method
Acceptance Criteria: Mean texture depth (MTD) >= 1.0 mm [VERIFY]; measured at frequency of 1 per 200m per lane [VERIFY]; no areas with excessively smooth or rough texture
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: RC 317.01 (Sand Patch Method)
Notes: Clause 417.09 [VERIFY]. OGA should have high macro-texture for spray reduction and noise benefits. Table 417.091 [VERIFY] specifies texture depth requirements.
```

```
Item #: 19
Description: Verify surface level of completed OGA against design levels at specified intervals
Acceptance Criteria: Surface level within +/-10mm of design level at any point [VERIFY]; no localised depressions exceeding 5mm under 3m straightedge [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey / 3m straightedge
Notes: Clause 417.09 [VERIFY]. Surface levels checked at centreline, edges, and crown. Departures documented on as-built survey.
```

```
Item #: 20
Description: Verify thickness of OGA layer from core measurements against design thickness
Acceptance Criteria: Mean thickness not less than design thickness; no individual core less than design minus 5mm [VERIFY]; OGA wearing course typically 30-45mm thick [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Core measurement
Notes: Clause 417.09 [VERIFY]. Thickness from cores taken for density testing. Deficient thickness may compromise permeability and noise reduction function.
```

### Binder and Mix Compliance Testing

```
Item #: 21
Description: Sample and test OGA production mix for binder content compliance at specified frequency
Acceptance Criteria: Binder content within +/-0.3% of registered mix design [VERIFY]; tested at minimum 1 per sublot or per 250-500 tonnes [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 2891.2.1 (Ignition method) or solvent extraction
Notes: Clause 417.09 [VERIFY]. OGA binder content is critical -- too low causes ravelling, too high causes drain-down. Typical OGA binder content 4.5-5.5% [VERIFY].
```

```
Item #: 22
Description: Sample and test OGA production mix for aggregate grading compliance at specified frequency
Acceptance Criteria: Aggregate grading within registered mix design envelopes; tested at minimum 1 per sublot [VERIFY]; no excess fines (passing 0.075mm sieve)
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1141.11 (Sieve analysis)
Notes: Clause 417.09 [VERIFY]. Excess fines in OGA will block the air voids and reduce permeability. Critical control parameter during production.
```

```
Item #: 23
Description: Conduct binder drain-down test on OGA production mix to confirm resistance to binder migration
Acceptance Criteria: Binder drain-down not exceeding 0.3% by mass at maximum production temperature [VERIFY]; tested at plant start-up and when production temperature changes
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Schellenberg drain-down test / AS 2891 related [VERIFY]
Notes: Clause 417.05 [VERIFY]. Drain-down is a characteristic risk for OGA. Test should be performed at the proposed maximum production temperature. Fibres may be added to control drain-down.
```

### Traffic Management and Curing

```
Item #: 24
Description: Implement traffic management on completed OGA including speed restrictions during initial trafficking period
Acceptance Criteria: Speed limit reduced to 60 km/h (or as specified) for initial period [VERIFY]; no heavy vehicles until Superintendent approval; surface protected from contamination
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 417.10 [VERIFY]. OGA requires careful initial trafficking to embed aggregate and develop stable surface. Speed restrictions help prevent stone loss.
```

```
Item #: 25
Description: Inspect OGA surface after initial trafficking for evidence of ravelling, delamination, or aggregate loss
Acceptance Criteria: No excessive stone loss or ravelling; no delamination from substrate; no fat spots or bleeding; surface draining freely
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 417.10 [VERIFY]. Post-trafficking inspection critical for OGA. Early detection of problems allows corrective action before defects become widespread.
```

### Documentation and Handover

```
Item #: 26
Description: Compile and submit all production, placement, and testing records for each lot of OGA
Acceptance Criteria: Complete records including: mix design certificates, production temperatures, placement records, core results, texture depth, permeability, surface levels, as-built survey
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 417.11 [VERIFY]. All test results and inspection records to be compiled in lot folders and submitted to Superintendent within 14 days of lot completion [VERIFY].
```

```
Item #: 27
Description: Obtain Superintendent acceptance of completed OGA works for each lot
Acceptance Criteria: All test results within specification; all hold points released; all non-conformances resolved or accepted; as-built survey complete
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: Clause 417.11 [VERIFY]. Final lot acceptance. Superintendent reviews all documentation and test results before issuing lot acceptance certificate.
```

```
Item #: 28
Description: Verify defects liability requirements and provide maintenance instructions for OGA surface
Acceptance Criteria: Defects liability period as per contract; maintenance requirements for OGA documented (cleaning of voids, avoiding sealcoat, etc.)
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: General contract requirement. OGA requires periodic high-pressure cleaning to maintain permeability. Surface must not be overlaid with slurry seal or fog coat.
```

## Test Methods & Frequencies Summary -- OGA

| Test | Method | Typical Frequency | Key Acceptance Value |
|------|--------|-------------------|---------------------|
| Mix design verification | RC 201.01 / RC 201.12 | Pre-production | Per RC 500.01 registered design |
| Binder drain-down | Schellenberg / AS 2891 | Start-up + temp changes | <= 0.3% mass [VERIFY] |
| Binder content (production) | AS/NZS 2891.2.1 | 1 per 250-500t [VERIFY] | +/- 0.3% of design [VERIFY] |
| Aggregate grading | AS 1141.11 | 1 per sublot [VERIFY] | Within registered envelope |
| Mat temperature | Infrared thermometer | Every load / 100m | Within placement range (140-170 deg C) [VERIFY] |
| In-situ air voids | RC 316.00 / AS 2891.14.5 | 6 cores per lot | Design 18-22% [VERIFY] |
| Density / compaction | RC 500.05 | 6 cores per lot | Per RC 500.05 formula |
| Texture depth | RC 317.01 (Sand Patch) | 1 per 200m per lane [VERIFY] | >= 1.0 mm MTD [VERIFY] |
| Permeability | Falling head test [VERIFY] | Per lot / trial section | Minimum flow rate [VERIFY] |
| Surface level | Survey | 25m intervals [VERIFY] | +/- 10mm of design [VERIFY] |
| Thickness | Core measurement | 6 per lot (from density cores) | >= design minus 5mm [VERIFY] |

---

# Template 7: Stone Mastic Asphalt (SMA)

```
Template Name: Stone Mastic Asphalt (SMA)
Activity Type: asphalt
Specification Reference: VicRoads Section 404
Edition/Revision Date: Version 6, 29/08/2018 (Note: marked as Superseded -- may now be within Section 407 v17)
```

## Checklist Items

### Pre-Work Submissions

```
Item #: 1
Description: Submit mix design for SMA registered in accordance with RC 500.01, including aggregate grading, binder type/content, fibre type/content, and design air voids
Acceptance Criteria: Mix registered with VicRoads/ARRB per RC 500.01; design air voids 3-4%; binder content typically 6.0-7.0%; fibre content 0.3% by mass of total mix; PMB compliant with ATS 3110
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: RC 500.01 / RC 201.01 or RC 201.12
Notes: Clause 404.04 [VERIFY]. SMA is a gap-graded mix with 70-80% coarse aggregate, 8-12% filler, 6-7% binder, and 0.3% fibre. VP and Size 7mm SMA were added to RC 500.01 in July 2023.
```

```
Item #: 2
Description: Submit Quality Plan for SMA works including placement procedures, plant details, rolling patterns, joint treatment, fibre dosing procedures, and testing schedule
Acceptance Criteria: Quality Plan addresses all requirements of Section 404; includes fibre storage and dosing procedures; approved by Superintendent
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 404.03 [VERIFY]. SMA requires specific attention to fibre dosing accuracy and prevention of binder drain-down. Quality Plan must address these unique SMA requirements.
```

```
Item #: 3
Description: Submit binder drain-down test results from plant production trial demonstrating SMA mix stability
Acceptance Criteria: Binder drain-down not exceeding 0.3% by mass at maximum production temperature [VERIFY]; drain-down sensitivity demonstrated at temperature range
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Schellenberg drain-down test / AS 2891 related [VERIFY]
Notes: Clause 404.04 [VERIFY]. Drain-down testing must be at the proposed maximum production temperature. Lower drain-down targets (e.g., 0.15%) may be specified for airport or high-stress applications.
```

```
Item #: 4
Description: Verify source and quality of coarse aggregate for SMA including crushing value, polished stone value, and particle shape
Acceptance Criteria: Aggregate compliant with Section 801; PSV >= 50 for high-stress applications [VERIFY]; crushed faces >= 98%; flakiness index per specification
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1141.40 (PSV) / AS 1141.23 (LA) / AS 1141.15 (Flakiness)
Notes: Clause 404.05 [VERIFY]. SMA performance depends on stone-on-stone contact of coarse aggregate. Premium aggregate quality essential. Section 801 aggregate requirements apply.
```

```
Item #: 5
Description: Verify polymer modified binder (PMB) compliance with ATS 3110 and specification requirements
Acceptance Criteria: PMB meets ATS 3110 specified class; typically A10E or higher modification for SMA [VERIFY]; softening point, elastic recovery, viscosity within ranges
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Austroads AGPT/T101
Notes: Clause 404.05 [VERIFY]. SMA requires PMB to achieve mastic binding and resist drain-down. VicRoads early SMA used C320 bitumen but moved to PMB from 1999 for improved fatigue performance.
```

```
Item #: 6
Description: Verify fibre type, quality certification, and dosing system calibration for SMA production
Acceptance Criteria: Cellulose or mineral fibre meeting specification; fibre content 0.3% by mass (+/- 0.05%) [VERIFY]; dosing system calibrated and verified; fibre stored dry and uncontaminated
Point Type: witness
Responsible Party: superintendent
Evidence Required: test_result
Test Type: AS 2891.3.3
Notes: Clause 404.05 [VERIFY]. Fibre is essential to prevent binder drain-down in SMA. Cellulose fibre most common. Must be measured and reported as percentage of total mix per RC 500.16.
```

### Surface Preparation

```
Item #: 7
Description: Inspect underlying surface for compliance with level and condition requirements prior to SMA placement
Acceptance Criteria: Substrate surface within specified level tolerances; free of loose material, dust, oil, and water; any milled surfaces cleaned; repairs completed and accepted
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 404.06 [VERIFY]. Substrate must provide stable, uniform platform for SMA. Previously profiled surfaces must be clean and dry.
```

```
Item #: 8
Description: Apply tack coat to substrate surface at specified rate and verify uniform coverage
Acceptance Criteria: Tack coat applied at design rate (typically 0.2-0.4 L/m2 residual [VERIFY]); uniform coverage; adequately broken/cured before SMA placement; no excess pooling
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 404.06 [VERIFY]. Tack coat rate may need adjustment for milled surfaces (higher rate) vs existing asphalt (standard rate).
```

### Trial Section / First Production

```
Item #: 9
Description: Construct trial section of SMA to demonstrate compliance with mix design, placement, compaction, and finished surface quality
Acceptance Criteria: Trial section meets all specification requirements: air voids, density, texture depth, drain-down control, surface appearance; Superintendent approves before main production
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: RC 316.00 / RC 317.01
Notes: Clause 404.07 [VERIFY]. Trial section typically 200-500m. Must demonstrate compaction can achieve target density without crushing aggregate skeleton. Establishes rolling pattern and pass count.
```

```
Item #: 10
Description: Verify SMA delivery temperature at first load arrival and confirm within specified placement range
Acceptance Criteria: Mix temperature at delivery within specified range for PMB type used; typically 150-175 deg C [VERIFY]; not exceeding maximum to avoid drain-down; not below minimum for compaction
Point Type: witness
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Infrared thermometer / calibrated probe
Notes: Clause 404.08 [VERIFY]. SMA temperature control is critical -- excessive temperature causes drain-down even with fibres. The temperature-viscosity curve for the specific PMB determines the range.
```

### During Placement

```
Item #: 11
Description: Monitor paver operation including consistent speed, screed settings, material feed rate, and hopper level
Acceptance Criteria: Paver operating at consistent speed; screed adequately heated; continuous material feed; no visible segregation; hopper maintained at adequate level
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 404.08 [VERIFY]. SMA can segregate in the paver hopper. MTV (material transfer vehicle) recommended for large paving operations to reduce segregation risk.
```

```
Item #: 12
Description: Monitor mat temperature during placement at regular intervals behind paver screed
Acceptance Criteria: Mat temperature within specified range; recorded at minimum every load or 100m [VERIFY]; no cold spots below minimum placement temperature
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Infrared thermometer
Notes: Clause 404.08 [VERIFY]. Temperature monitoring frequency increased for SMA due to drain-down sensitivity. Record ambient temperature simultaneously.
```

```
Item #: 13
Description: Monitor weather conditions during SMA placement
Acceptance Criteria: Air temperature >= 5 deg C [VERIFY]; no rain; pavement surface dry; wind speed within limits to prevent rapid mat cooling
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 404.07 [VERIFY]. Similar weather restrictions to DGA but SMA may have slightly more restrictive limits due to need for effective compaction of gap-graded mix.
```

```
Item #: 14
Description: Verify rolling pattern and compaction procedures match approved Quality Plan and trial section results
Acceptance Criteria: Rolling pattern as approved; typically static steel followed by limited pneumatic [VERIFY]; correct number of passes; no displacement of aggregate skeleton; surface closed but not over-compacted
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 404.08 [VERIFY]. SMA compaction is delicate -- over-rolling crushes the stone skeleton and reduces surface texture. Under-rolling leaves high voids and poor durability. Follow trial pattern precisely.
```

```
Item #: 15
Description: Verify longitudinal and transverse joint construction including cutting back cold edges, tack coating, and compaction
Acceptance Criteria: Cold joints cut back to sound material; tack coat applied to joint face; hot-side overlap adequate; joint compacted within temperature window; no open or segregated joints
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 404.08 [VERIFY]. SMA joints require careful execution. Gap-graded mix makes cold joints more visible and potentially weaker than DGA joints.
```

### Compaction and Density Testing

```
Item #: 16
Description: Determine lot boundaries for SMA compaction testing
Acceptance Criteria: Lot size as specified (typically 300-1000 tonnes or area-based [VERIFY]); lot boundaries clearly identified; minimum 6 test locations per lot per RC 316.00
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: RC 316.00
Notes: Clause 404.09 [VERIFY]. Where total SMA quantity exceeds 300 tonnes, compaction shall be tested and accepted on a lot basis.
```

```
Item #: 17
Description: Extract cores and test in-situ air voids and density of compacted SMA
Acceptance Criteria: Characteristic in-situ air voids (CAV) within specified range; SMA design air voids 3-4%; field voids typically 3-6% acceptable [VERIFY]; Characteristic Density Ratio per RC 500.05
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: RC 316.00 / AS 2891.14.5 / RC 500.05
Notes: Clause 404.09 [VERIFY]. Both characteristic density ratio and characteristic field air voids to be reported. SMA target air voids lower than OGA but higher than some DGA mixes. CAV = AV + (0.92 x S_AV).
```

### Surface Quality

```
Item #: 18
Description: Measure surface texture depth of completed SMA using sand patch method
Acceptance Criteria: Mean texture depth (MTD) >= 0.7 mm for standard SMA [VERIFY]; measured per RC 317.01 at specified frequency; consistent texture across full width
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: RC 317.01 (Sand Patch Method)
Notes: Clause 404.09 [VERIFY]. SMA should have higher macro-texture than DGA but lower than OGA. Table 404.091 [VERIFY] specifies texture depth requirements. Over-compaction reduces texture.
```

```
Item #: 19
Description: Assess surface for binder-rich (fat) spots indicating drain-down or flushing during placement
Acceptance Criteria: No visible fat spots or binder-rich areas exceeding specified limits [VERIFY]; uniform surface appearance; no bleeding under trafficking
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: Visual assessment
Notes: Clause 404.09 [VERIFY]. Fat spots in SMA indicate either drain-down during transport/placement or over-compaction forcing mastic to the surface. May warrant drain-down re-testing.
```

```
Item #: 20
Description: Verify surface level of completed SMA against design levels
Acceptance Criteria: Surface level within +/-5mm of design level at crown and edges [VERIFY]; no localised depressions exceeding 5mm under 3m straightedge; crossfall within tolerance
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey / 3m straightedge
Notes: Clause 404.09 [VERIFY]. Surface levels checked at centreline, edge of seal, and quarter points where specified.
```

```
Item #: 21
Description: Verify SMA layer thickness from core measurements against design thickness
Acceptance Criteria: Mean thickness not less than design thickness; no individual core less than design minus 5mm [VERIFY]; SMA wearing course typically 40-50mm thick [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Core measurement
Notes: Clause 404.09 [VERIFY]. Thickness determined from density cores. SMA available in 10mm and 14mm nominal sizes with corresponding minimum layer thicknesses.
```

### Production Mix Compliance

```
Item #: 22
Description: Sample and test SMA production mix for binder content at specified frequency
Acceptance Criteria: Binder content within +/-0.3% of registered mix design [VERIFY]; tested at minimum 1 per sublot or per 250-500 tonnes [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 2891.2.1 (Ignition method)
Notes: Clause 404.09 [VERIFY]. SMA binder content typically 6.0-7.0%. Higher than DGA due to mastic formation. Critical for drain-down and durability.
```

```
Item #: 23
Description: Sample and test SMA production mix for aggregate grading at specified frequency
Acceptance Criteria: Aggregate grading within registered mix design envelopes; gap grading maintained; VMA within specification [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1141.11 (Sieve analysis)
Notes: Clause 404.09 [VERIFY]. SMA gap grading must be maintained during production -- excess mid-range sizes will disrupt stone-on-stone contact and compromise performance.
```

```
Item #: 24
Description: Verify fibre content in SMA production mix samples at specified frequency
Acceptance Criteria: Fibre content 0.3% +/- 0.05% by mass of total mix [VERIFY]; tested per AS 2891.3.3; consistent dosing demonstrated
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 2891.3.3
Notes: Clause 404.09 [VERIFY]. Fibre content must be measured and reported per RC 500.16 when asphalt contains added cellulose fibres. Insufficient fibre leads to drain-down; excessive fibre affects workability.
```

### Traffic Management and Curing

```
Item #: 25
Description: Implement traffic management on completed SMA including initial speed restrictions
Acceptance Criteria: Speed restrictions applied as specified; no heavy braking/turning loads until surface stabilised; surface protected from contamination and damage
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 404.10 [VERIFY]. SMA develops its final texture and stability under initial trafficking. Excessive braking forces on hot SMA can displace the mastic.
```

```
Item #: 26
Description: Inspect SMA surface after initial trafficking period for defects including ravelling, fat spots, and delamination
Acceptance Criteria: No excessive aggregate loss; no delamination; no widespread fat spots; texture depth maintained; surface draining uniformly
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 404.10 [VERIFY]. Post-trafficking inspection verifies SMA is performing as intended. Early binder migration to surface (flushing) may indicate production or placement issues.
```

### Documentation and Handover

```
Item #: 27
Description: Compile and submit all production, placement, and testing records for each SMA lot
Acceptance Criteria: Complete records including: mix design, fibre dosing records, production temperatures, placement records, core results (density, air voids, thickness), texture depth, surface levels
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 404.11 [VERIFY]. Records to include fibre delivery dockets and dosing calibration records specific to SMA production. Submit within 14 days of lot completion [VERIFY].
```

```
Item #: 28
Description: Obtain Superintendent acceptance of completed SMA works for each lot
Acceptance Criteria: All test results within specification limits; all hold points released; all non-conformances resolved; as-built survey complete; fibre content verified
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: Clause 404.11 [VERIFY]. Final lot acceptance. Superintendent reviews complete documentation package before issuing acceptance.
```

```
Item #: 29
Description: Verify skid resistance of completed SMA surface if required by specification
Acceptance Criteria: Skid Resistance Value (SRV) >= 60 [VERIFY] or as specified; tested using approved method; adequate friction for road geometry and traffic
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 4586 or VicRoads approved method [VERIFY]
Notes: TN-060. VicRoads specifies SRV >= 60 for skid resistant surfacing. May be required at specific locations (curves, intersections, approaches) rather than full length.
```

## Test Methods & Frequencies Summary -- SMA

| Test | Method | Typical Frequency | Key Acceptance Value |
|------|--------|-------------------|---------------------|
| Mix design registration | RC 500.01 / RC 201.01 or 201.12 | Pre-production | Per RC 500.01 requirements |
| Binder drain-down | Schellenberg test | Plant start-up + temp changes | <= 0.3% mass [VERIFY] |
| Binder content (production) | AS/NZS 2891.2.1 | 1 per 250-500t [VERIFY] | +/- 0.3% of design (6.0-7.0% typical) |
| Aggregate grading | AS 1141.11 | 1 per sublot [VERIFY] | Within registered envelope |
| Fibre content | AS 2891.3.3 | 1 per sublot [VERIFY] | 0.3% +/- 0.05% [VERIFY] |
| Mat temperature | Infrared thermometer | Every load / 100m | 150-175 deg C [VERIFY] |
| In-situ air voids | RC 316.00 / AS 2891.14.5 | 6 cores per lot | Design 3-4%, field 3-6% [VERIFY] |
| Density ratio | RC 500.05 | 6 cores per lot | Per RC 500.05 formula |
| Texture depth | RC 317.01 (Sand Patch) | 1 per 200m per lane [VERIFY] | >= 0.7 mm MTD [VERIFY] |
| Surface level | Survey | 25m intervals [VERIFY] | +/- 5mm of design [VERIFY] |
| Thickness | Core measurement | 6 per lot | >= design minus 5mm [VERIFY] |
| Skid resistance | SRV test (where specified) | As directed | SRV >= 60 [VERIFY] |

---

# Template 8: Sprayed Bituminous Surfacing

```
Template Name: Sprayed Bituminous Surfacing
Activity Type: asphalt_prep
Specification Reference: VicRoads Section 408
Edition/Revision Date: Version 13, 26/08/2022
```

**Scope Note:** Section 408 covers the full range of sprayed bituminous surfacings including:
- **Primer** -- initial treatment to granular pavement
- **Primerseal** (Initial Seal) -- first seal combining priming and sealing function
- **Single/Single Seal** -- single application of binder + single layer of aggregate
- **Double/Double Seal** -- two applications of binder + two layers of aggregate
- **Reseal** -- renewal seal over existing surfacing
- **Geotextile Reinforced Seal** -- seal incorporating geotextile interlayer (see also TB-38)

**Supporting Documents:**
- Guide to Section 408 -- Sprayed Bituminous Surfacings (v1, 24/05/2017)
- VicRoads Technical Bulletin TB-45 -- Bituminous Sprayed Surfacing Manual (2004)
- VicRoads Technical Bulletin TB-38 -- Guide to Geotextile Reinforced Sprayed Seals
- VicRoads Technical Report TR-209 -- Best Practice for Preparation of New Granular Pavements
- RC 500.09 -- Testing Aggregates for Sprayed Bituminous Surfacing (July 2018)
- Austroads AGPT-04K -- Guide to Pavement Technology Part 4K: Selection and Design of Sprayed Seals

## Checklist Items

### Pre-Work Submissions

```
Item #: 1
Description: Submit Seal Design for the sprayed bituminous surfacing including binder type, application rate, aggregate size, treatment type, and design in accordance with Austroads AGPT-04K
Acceptance Criteria: Seal design compliant with AGPT-04K methodology; binder type and application rate per Table 408.191 [VERIFY]; aggregate size and spread rate appropriate for traffic and climate; Superintendent approval received
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 408.04 [VERIFY]. Design application rates are determined to nearest 0.1 L/m2. Traffic data, surface condition, climate zone all factor into design. Table 408.191 provides default rates.
```

```
Item #: 2
Description: Submit Quality Plan for sprayed sealing works including proposed equipment, operator qualifications, weather monitoring, application procedures, and traffic management
Acceptance Criteria: Quality Plan addresses all Section 408 requirements; approved by Superintendent; includes contingency for weather changes and equipment breakdown
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 408.03 [VERIFY]. Quality Plan must detail binder heating, sprayer calibration, aggregate spreader calibration, and rolling procedures.
```

```
Item #: 3
Description: Submit aggregate test results demonstrating compliance with specification requirements for the proposed aggregate source
Acceptance Criteria: Aggregate tested per RC 500.09; size, shape, cleanliness, stripping resistance, and durability all within specification limits
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: RC 500.09 (Testing Aggregates for Sprayed Bituminous Surfacing)
Notes: Clause 408.05 [VERIFY]. Aggregate quality is fundamental to seal performance. Testing must include: flakiness, ACV/TFV, stripping, dust ratio, sand equivalent.
```

```
Item #: 4
Description: Verify binder supply documentation including type, grade, source, and compliance certificates
Acceptance Criteria: Binder type matches seal design (cutback bitumen, emulsion, PMB, or crumb rubber modified); compliance with relevant AS/ATS; flash point verified at least 10 deg C above maximum spraying temperature per ASTM D276
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: ASTM D276 (flash point)
Notes: Clause 408.05 [VERIFY]. For initial seals (primerseals), binder shall be suitable cutback bitumen, emulsion, or 9% (10 parts) crumb rubber modified binder. High Stress Seal uses lightly modified PMB (S10E, S35E).
```

### Equipment Verification

```
Item #: 5
Description: Verify calibration of bitumen sprayer including spray bar uniformity, application rate accuracy, and temperature control
Acceptance Criteria: Sprayer calibrated within +/-5% of design application rate [VERIFY]; uniform transverse distribution; nozzles clean and at correct angle; temperature gauge calibrated
Point Type: witness
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Sprayer calibration test (tray test or similar)
Notes: Clause 408.08 [VERIFY]. Sprayer calibration is critical -- uneven binder distribution causes fatty or dry patches. Bar height, nozzle angle, and pump speed all verified.
```

```
Item #: 6
Description: Verify calibration of aggregate spreader for uniform coverage at design spread rate
Acceptance Criteria: Spreader delivers uniform aggregate across full width; spread rate within +/-10% of design [VERIFY]; forward-facing operator (per specification); no gaps or heavy spots
Point Type: witness
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Tray test or area measurement
Notes: Clause 408.08 [VERIFY]. Specification requires operator of aggregate spreading plant to face in direction of travel. Synchronised spraying/spreading equipment may be used.
```

### Surface Preparation

```
Item #: 7
Description: Inspect pavement surface condition and preparation prior to primer/seal application
Acceptance Criteria: Surface shaped to required crossfall and profile; free of loose material, dust, and vegetation; surface moisture condition suitable; any pot holes or defects repaired
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 408.06 [VERIFY]. Surface pre-treatment to correct variable texture must be allowed for and carried out per Tables 408.152 and 408.153. Refer also TR-209 for new granular pavement preparation.
```

```
Item #: 8
Description: Verify surface temperature of pavement meets minimum requirements before binder application
Acceptance Criteria: Pavement surface temperature >= 15 deg C for standard sealing [VERIFY]; >= 25 deg C for night works on geotextile reinforced seals; measured by contact or infrared thermometer
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Contact thermometer / infrared thermometer
Notes: Clause 408.07 [VERIFY]. Binder shall not be applied until receiving surface temperature meets requirements. Night works have different minimums.
```

```
Item #: 9
Description: Apply light water spray ahead of primer or primerseal application as required
Acceptance Criteria: Consistent water spray across full width of proposed seal; no pooling or dry areas; water spray applied immediately ahead of binder application
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 408.08(c) [VERIFY]. Light water spray precedes application of either primer or primerseal. Spray must be consistent across full width.
```

### Primer Application (where applicable)

```
Item #: 10
Description: Apply primer to granular pavement surface at specified application rate
Acceptance Criteria: Primer (cutback bitumen or approved emulsion) applied at design rate per specification; uniform application; penetration into pavement surface achieved; no pooling or run-off
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 408.08(c) [VERIFY]. Primer must be water resistant, uniform appearance, and provide strong bond. Proprietary emulsion may substitute for cutback if Superintendent approves and evidence shows equivalent function.
```

```
Item #: 11
Description: Allow primer to cure for minimum specified period before seal application
Acceptance Criteria: Primer cured for minimum period (typically 7-14 days depending on conditions [VERIFY]); surface stable under traffic; no tacky areas remaining; penetration adequate
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 408.08(c) [VERIFY]. Curing time depends on temperature, humidity, and primer type. Cutback primers require longer curing than emulsion primers.
```

### Seal Application -- Binder Spraying

```
Item #: 12
Description: Verify binder temperature at sprayer immediately before application
Acceptance Criteria: Binder temperature within specified range for binder type; not exceeding maximum (flash point minus 10 deg C); temperature recorded and documented
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Calibrated thermometer on sprayer
Notes: Clause 408.08 [VERIFY]. Correct binder viscosity at application depends on temperature. Too cold = poor wetting of aggregate; too hot = safety risk and binder degradation.
```

```
Item #: 13
Description: Monitor binder application rate during spraying and verify compliance with seal design rate
Acceptance Criteria: Binder application rate within +/-0.05 L/m2 of design rate [VERIFY]; uniform transverse distribution; consistent longitudinal rate; no misses, double sprays, or edge issues
Point Type: witness
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Area/volume calculation / tray test verification
Notes: Clause 408.08 [VERIFY]. Application rate checked by measurement of area covered versus binder used. Allowances per AGPT-04K are cumulative and added/subtracted from basic rate.
```

```
Item #: 14
Description: Verify transverse joins in binder application are properly managed (paper overlay method or equivalent)
Acceptance Criteria: Transverse joins have clean edges; no double application; no gaps; paper strip method or approved alternative used; joins not visible in final surface
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 408.08 [VERIFY]. Paper overlay at transverse stops prevents double spraying. Paper must be removed before aggregate application in adjacent area.
```

### Seal Application -- Aggregate Spreading

```
Item #: 15
Description: Spread aggregate immediately following binder application at specified rate within maximum time delay
Acceptance Criteria: Aggregate spread within 30 seconds [VERIFY] of binder application; uniform one-stone-thick coverage; spread rate per design; no bare patches or double coverage
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 408.08 [VERIFY]. Delay between binder application and aggregate spreading must be minimised. Synchronised equipment preferred for critical work.
```

```
Item #: 16
Description: Monitor aggregate spread rate and uniformity across seal width
Acceptance Criteria: Spread rate within +/-10% of design [VERIFY]; uniform single stone layer; no clumps or bare areas; aggregate oriented with least dimension vertical where practicable
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual assessment / area measurement
Notes: Clause 408.08 [VERIFY]. Aggregate spread rate calculation: design rate (kg/m2) based on aggregate ALD (average least dimension) and voids calculation per AGPT-04K.
```

### Rolling and Embedment

```
Item #: 17
Description: Commence initial rolling of aggregate immediately after spreading to achieve embedment
Acceptance Criteria: Multi-tyre roller commences within 2 minutes [VERIFY] of aggregate spreading; minimum 3 passes initially [VERIFY]; aggregate oriented and seated in binder; no crushing of aggregate
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 408.08 [VERIFY]. Initial rolling critical for aggregate retention. Pneumatic tyre roller preferred for embedment. Rolling speed typically 5-8 km/h [VERIFY].
```

```
Item #: 18
Description: Continue rolling to achieve required aggregate embedment depth
Acceptance Criteria: Aggregate embedded to 50-70% of ALD (average least dimension) [VERIFY]; uniform embedment across width; no stripping or displacement; adequate binder contact with aggregate faces
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual assessment / measurement
Notes: Clause 408.09 [VERIFY]. Embedment checked visually and by measurement. Under-embedded aggregate will strip under traffic; over-embedded aggregate causes flushing.
```

### Second Application (Double Seal only)

```
Item #: 19
Description: For double/double seals: apply second binder coat at specified rate after first application has been rolled
Acceptance Criteria: Second binder application rate per design (typically lower than first [VERIFY]); uniform application; first aggregate layer adequately embedded before second application
Point Type: witness
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Area/volume calculation
Notes: Clause 408.08 [VERIFY]. Double seals have a second, smaller aggregate size applied over the first. Second binder rate designed to partially fill remaining voids.
```

```
Item #: 20
Description: For double/double seals: spread second (smaller) aggregate and roll to achieve embedment
Acceptance Criteria: Smaller aggregate size spread uniformly at design rate; rolled to embed in second binder coat; no displacement of first aggregate layer; interlocking achieved
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 408.08 [VERIFY]. Second aggregate typically one size smaller (e.g., 7mm over 14mm, or 10mm over 16mm). Must interlock with first layer without disrupting it.
```

### Weather Monitoring

```
Item #: 21
Description: Monitor weather conditions throughout sealing operations and cease work if conditions deteriorate beyond specification limits
Acceptance Criteria: No rain during application or before initial set; air temperature >= 10 deg C [VERIFY]; pavement surface temperature >= 15 deg C [VERIFY]; wind speed not causing spray drift; cease work and protect surface if conditions change
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Weather station / thermometers / rain gauge
Notes: Clause 408.07 [VERIFY]. Weather monitoring is continuous during sealing. Imminent rain is the most critical risk -- binder must achieve initial set before any moisture contact.
```

### Post-Application Quality

```
Item #: 22
Description: Assess surface texture of completed seal by visual inspection and measurement where required
Acceptance Criteria: Surface texture uniform and consistent; texture depth assessed per RC 317.01 if directed by Superintendent; compliance with Table 408.152 [VERIFY] in marginal cases
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: RC 317.01 (Sand Patch) -- in marginal cases
Notes: Clause 408.09 [VERIFY]. Acceptance of surface texture and enrichment based on visual assessment primarily. RC 317.01 used only in marginal/disputed cases per Table 408.152.
```

```
Item #: 23
Description: Assess aggregate retention by visual inspection during and after initial trafficking
Acceptance Criteria: No excessive stone loss exceeding specified limits per Table 408.153 [VERIFY]; aggregate firmly embedded; no widespread stripping; isolated loose stones swept and removed
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual assessment per Table 408.153 [VERIFY]
Notes: Clause 408.09 [VERIFY]. Aggregate retention assessed against Table 408.153 criteria. Some initial stone loss is normal but excessive stripping indicates adhesion failure.
```

```
Item #: 24
Description: Assess surface for bleeding/flushing (binder rising to surface) particularly in wheel paths
Acceptance Criteria: No visible bleeding or flushing; binder not exceeding aggregate surface level; uniform appearance; no fat spots or wet-look areas
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual assessment
Notes: Clause 408.09 [VERIFY]. Bleeding indicates excess binder, insufficient aggregate, or over-embedment. May require corrective treatment with additional aggregate.
```

### Traffic Management

```
Item #: 25
Description: Implement post-seal traffic management including speed restrictions and sweeping programme
Acceptance Criteria: Speed limit reduced (typically 40-60 km/h [VERIFY]) for minimum period after seal; loose stone swept regularly; pilot vehicle used if required; duration of restrictions per specification
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 408.10 [VERIFY]. Traffic management critical for new seals. Excessive speed causes windscreen damage and stone loss. Sweeping removes excess stone to prevent damage.
```

```
Item #: 26
Description: Conduct sweeping of loose aggregate from seal surface at specified intervals
Acceptance Criteria: Excess loose aggregate removed by sweeping; sweeping method does not damage seal; timing of sweeps per specification; aggregate recycled or removed from site
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 408.10 [VERIFY]. Sweeping too early can damage seal; too late allows loose stone to accumulate. Typically first sweep 24-48 hours after sealing, then as directed.
```

### Geotextile Reinforced Seal (where applicable)

```
Item #: 27
Description: For geotextile reinforced seals: verify geotextile material and placement prior to binder application
Acceptance Criteria: Geotextile type and weight as specified; placed flat without wrinkles or folds; adequate overlap at joins; substrate preparation complete; binder application rate adjusted for geotextile absorption
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 408.08 [VERIFY] and TB-38. Geotextile reinforced seals require higher binder application rate to saturate the fabric. Binder not applied until surface temp >= 25 deg C during night works.
```

### Documentation and Handover

```
Item #: 28
Description: Compile and submit all seal design, application, and quality records
Acceptance Criteria: Complete records including: seal design, binder delivery/temperature records, application rates (actual vs design), aggregate delivery dockets, weather records, rolling records, post-seal inspection reports
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 408.11 [VERIFY]. All records to be submitted within 14 days [VERIFY]. Include photographic record of key stages.
```

```
Item #: 29
Description: Obtain Superintendent acceptance of completed sprayed seal works
Acceptance Criteria: All test results and inspections within specification; all hold points released; texture and retention acceptable; no unresolved non-conformances; maintenance period requirements documented
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: Clause 408.11 [VERIFY]. Final acceptance after post-seal monitoring period. Superintendent to confirm aggregate retention, texture, and overall seal quality before acceptance.
```

```
Item #: 30
Description: Conduct final surface inspection after post-seal monitoring/maintenance period
Acceptance Criteria: Seal surface performing satisfactorily; adequate texture depth; no excessive stripping, bleeding, or fatting; aggregate retention stable; surface draining correctly
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: RC 317.01 if directed
Notes: Clause 408.11 [VERIFY]. Final inspection typically at end of defects liability period or maintenance period for sealed surfaces.
```

## Test Methods & Frequencies Summary -- Sprayed Bituminous Surfacing

| Test | Method | Typical Frequency | Key Acceptance Value |
|------|--------|-------------------|---------------------|
| Aggregate quality | RC 500.09 | Per source / delivery | Per Section 408 tables |
| Sprayer calibration | Tray test | Before each seal run | +/- 5% of design rate [VERIFY] |
| Aggregate spreader calibration | Area/volume | Before each seal run | +/- 10% of design rate [VERIFY] |
| Binder temperature | Calibrated thermometer | Continuous during spraying | Within specified range for binder type |
| Binder application rate | Volume/area calculation | Each run | +/- 0.05 L/m2 of design [VERIFY] |
| Aggregate spread rate | Area/mass calculation | Each run | Per design |
| Surface temperature | Contact/IR thermometer | Before application | >= 15 deg C standard; >= 25 deg C geotextile night [VERIFY] |
| Air temperature | Thermometer | Continuous | >= 10 deg C [VERIFY] |
| Surface texture | RC 317.01 (if directed) | Marginal cases only | Per Table 408.152 [VERIFY] |
| Aggregate retention | Visual (Table 408.153) | Post-trafficking | Per Table 408.153 [VERIFY] |
| Embedment depth | Visual / measurement | During rolling | 50-70% ALD [VERIFY] |
| Binder flash point | ASTM D276 | Per supply batch | >= max spray temp + 10 deg C |

---

## Cross-Reference: Key VicRoads Codes of Practice

| Code | Title | Relevance |
|------|-------|-----------|
| RC 500.01 | Registration of Bituminous Mix Designs (July 2023) | All asphalt mix registration |
| RC 500.05 | Acceptance of Field Compaction (June 2017) | OGA and SMA compaction acceptance |
| RC 500.09 | Testing Aggregates for Sprayed Bituminous Surfacing (July 2018) | Section 408 aggregate testing |
| RC 500.16 | Selection of Test Methods (July 2018) | Test method selection for all works |
| RC 500.22 | Selection and Design of Pavements and Surfacings (Dec 2018) | Pavement/surfacing design framework |

## Cross-Reference: Related VicRoads Technical Documents

| Document | Title | Relevance |
|----------|-------|-----------|
| TN-004 | Open Graded Asphalt | Technical guidance for OGA |
| TN-060 | Skid Resistant Surfacing | SRV >= 60 requirement |
| TN-098 | Reporting Field (In situ) Air Voids in Asphalt | Air voids reporting methodology |
| TN-107 | Use of Recycled Materials in Road Pavements (July 2023) | Recycled content in asphalt |
| TB-38 | Guide to Geotextile Reinforced Sprayed Seals | Geotextile seal design and construction |
| TB-45 | Bituminous Sprayed Surfacing Manual (2004) | Comprehensive seal design reference |
| TR-209 | Best Practice for Preparation of New Granular Pavements | Pavement prep before sealing |

---

## Verification Required Before Deployment

The following items require verification against the actual VicRoads specification documents (.docx files downloadable from the VicRoads standard documents portal):

### Critical Verifications

1. **Section 417 Superseded Status:** Confirm whether OGA requirements are now consolidated into Section 407 v17 or if Section 417 v5 remains the applicable standalone specification. If consolidated, update clause references.

2. **Section 404 Superseded Status:** Confirm whether SMA requirements are now consolidated into Section 407 v17 or if Section 404 v6 remains applicable. If consolidated, update clause references.

3. **Clause Numbers:** All clause numbers marked [VERIFY] need confirmation against the actual .docx specification files. The numbering pattern (e.g., 417.04, 417.05) follows VicRoads convention but specific clause assignments need verification.

4. **Acceptance Values:** Air voids ranges, temperature ranges, texture depth minimums, application rate tolerances, and other numerical values marked [VERIFY] should be confirmed against the specification tables.

5. **Hold Point / Witness Point Classification:** VicRoads hold point and witness point designations should be confirmed from the specifications. Wyndham Council reference indicates these are listed in Appendix G of each section, with 24 hours notice required for witness points.

### Download Links for Verification

- Section 417 OGA: https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/7F1C032AFD13B5F5CA25836F007E60AE
- Section 404 SMA: https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/8E8D8459884F87F2CA2582F800196756
- Section 408 Sprayed Surfacing: https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/92ABF7E4EE82B617CA25854300062EA7
- Section 407 DGA (current v17): https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/32443A7A5C6A99FCCA2586BF00066ED5

---

## Sources

- [VicRoads Standard Documents - 404 Stone Mastic Asphalt](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/8E8D8459884F87F2CA2582F800196756)
- [VicRoads Standard Documents - 407 Dense Graded Asphalt](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/32443A7A5C6A99FCCA2586BF00066ED5)
- [VicRoads Standard Documents - 417 Open Graded Asphalt](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/7F1C032AFD13B5F5CA25836F007E60AE)
- [Wyndham City Council - Section 408 Sprayed Bituminous Surfacings](https://www.wyndham.vic.gov.au/sites/default/files/2021-11/Technical%20Specification%20Section%20408%20-%20Sprayed%20Bituminous%20Surfacings.pdf)
- [Wyndham City Council - Section 417 Open Graded Asphalt](https://www.wyndham.vic.gov.au/sites/default/files/2016-06/Technical%20Specification%20Section%20417%20-%20Open%20Graded%20Asphalt.pdf)
- [Wyndham City Council - Section 407 Dense Graded Asphalt](https://www.wyndham.vic.gov.au/sites/default/files/2026-01/Technical%20Specification%20Section%20407%20-%20Dense%20Graded%20Asphalt%20(140126).pdf)
- [DTP Engineering Standards Index (May 2024)](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/accepted-safety-barrier-products/idx-std-0001-engineering-standards-index--01052024.ashx)
- [VicRoads RC 500.01 - Registration of Bituminous Mix Designs (July 2023)](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/codes-of-practice-rc500/code-of-practice-rc-50001-of-bituminous-mix-designs-july-2023.ashx)
- [VicRoads RC 500.05 - Acceptance of Field Compaction](https://www.vicroads.vic.gov.au/~/media/files/technical-documents-new/codes-of-practice-rc500/code-of-practice-rc-50005--acceptance-of-field-compaction.pdf)
- [VicRoads RC 500.09 - Testing Aggregates for Sprayed Bituminous Surfacing](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/codes-of-practice-rc500/code-of-practice-rc-50009-testing-aggregates-for-sprayed-bituminous-surfacing-july-2018.ashx)
- [VicRoads RC 500.16 - Selection of Test Methods](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/codes-of-practice-rc500/code-of-practice-rc-50016-selection-of-test-methods-for-testing-of-materials-and-work-july-2018.ashx)
- [VicRoads RC 316.00 - Density Ratio and Moisture Ratio](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/test-methods/test-method-rc-31600-density-ratio-and-moisture-ratio-lot-characteristics.ashx)
- [VicRoads RC 201.01 - Design of Asphalt Mixes (Marshall Method)](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/test-methods/test-method-rc-20101--design-of-asphalt-mixes-marshall-method.ashx)
- [VicRoads TN-098 - Reporting Field Air Voids in Asphalt](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/technical-notes/technical-note-tn-098--reporting-field-in-situ-air-voids-in-asphalt.ashx)
- [VicRoads TN-060 - Skid Resistant Surfacing](https://www.vicroads.vic.gov.au/~/media/files/technical-documents-new/technical-notes/technical-note-tn-060--skid-resistant-surfacing.pdf)
- [Austroads AGPT-04K - Selection and Design of Sprayed Seals](https://austroads.gov.au/publications/pavement/agpt04k)
- [Pavertrend - Air Voids In Asphalt (VicRoads reference)](https://www.pavertrend.com.au/asphalt/air-voids-in-asphalt)
- [VicRoads Standard Documents portal](https://www.vicroads.vic.gov.au/business-and-industry/tenders-and-suppliers/contractors-and-consultants/standard-documents)
