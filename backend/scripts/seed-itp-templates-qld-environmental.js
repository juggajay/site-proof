/**
 * Seed Script: QLD (TMR/MRTS) ITP Templates - Environmental
 *
 * Creates global ITP templates for QLD environmental activities.
 * Templates: ESC (MRTS52), Landscaping (MRTS16), Geosynthetics (MRTS27/58/100),
 *            Reinforced Soil Walls (MRTS06)
 *
 * Run with: node scripts/seed-itp-templates-qld-environmental.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// =============================================================================
// QLD EROSION AND SEDIMENT CONTROL (MRTS52 / MRTS51)
// =============================================================================

const qldESCTemplate = {
  name: 'Erosion and Sediment Control',
  description: 'QLD TMR erosion and sediment control including EMP/ESCP preparation, ESC device installation and maintenance, water quality monitoring, and progressive stabilisation per MRTS52 and MRTS51',
  activityType: 'environmental',
  specificationReference: 'TMR MRTS52 / MRTS51',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit Environmental Management Plan (EMP) incorporating Erosion and Sediment Control Plan (ESCP) for Administrator review',
      acceptanceCriteria: 'EMP/ESCP submitted, reviewed, and accepted by Administrator prior to commencement of any site works',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5 MRTS51 / Clause 6 MRTS52 -- ESCP must be prepared in accordance with IECA Best Practice ESC Manual (2008 as amended). Hold Point 1 per MRTS51.'
    },
    {
      description: 'Verify ESCP has been designed by a suitably qualified person and peer-reviewed where required by project risk level',
      acceptanceCriteria: 'ESCP signed off by Certified Professional in Erosion and Sediment Control (CPESC) or equivalent for medium/high risk projects',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6 MRTS52 -- Design of ESC devices per IECA Manual Book 6 Standard Drawings. Review by appropriately qualified person required.'
    },
    {
      description: 'Confirm project risk level assessment (low, medium, high) and appropriate ESC design standard applied',
      acceptanceCriteria: 'Risk level documented considering soil type, rainfall erosivity, landform, proximity to sensitive receiving waters; ESC devices designed to corresponding risk level standard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 4 MRTS52 -- Rainfall erosivity calculated per R = 164.74 x (1.1177)^S x S^0.64444 where S = 2-year ARI 6-hour rainfall event (mm/h).'
    },

    // =========================================================================
    // ESC DEVICE INSTALLATION
    // =========================================================================
    {
      description: 'Install ESC devices (sediment traps, catch banks, diversion drains) associated with drainage paths flowing through the works area prior to initial earthworks',
      acceptanceCriteria: 'All ESC devices installed, functional, and inspected before any clearing, grubbing, or earthworks commence in the relevant stage/section',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 7 MRTS52 -- Hold Point 2. Work MUST STOP. No earthworks shall proceed until Administrator releases this hold point. Includes sediment traps, catch banks, and diversion drains.'
    },
    {
      description: 'Install silt fences (sediment fences) at designated locations per ESCP',
      acceptanceCriteria: 'Silt fences installed with minimum 200mm toe burial, fabric secured to star pickets/steel posts at max 2m centres, return ends turned uphill minimum 2m; fabric compliant with geotextile requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS52 / IECA Standard Drawing SD-SF. Silt fences are temporary controls regularly updated as construction progresses.'
    },
    {
      description: 'Construct sediment basins at locations identified in ESCP for contributing catchments exceeding 2500m2',
      acceptanceCriteria: 'Sediment basins sized to treat at least 80% of average annual runoff volume to 50mg/L TSS or less; basin volume, spillway, and outlet designed per IECA criteria; pH range 6.5-8.5 for discharge',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 7 MRTS52 / QLD State Planning Policy 2017 / Environmental Protection Act 1994 s440ZG. Contributing catchment >= 2500m2 triggers sediment basin requirement per IECA 2008.'
    },
    {
      description: 'Install rock check dams in drainage channels and swales at spacings per ESCP design',
      acceptanceCriteria: 'Check dams constructed of durable rock (min 150mm dia), dam height not exceeding 600mm, spacing such that toe of upstream dam is at crest elevation of downstream dam; geotextile underlay where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS52 / IECA Standard Drawing SD-CD. Check dams are temporary controls.'
    },
    {
      description: 'Construct stabilised site entry/exit (shake-down pad) at all vehicle access points',
      acceptanceCriteria: 'Stabilised entry minimum 20m long x 4m wide (or as per ESCP), constructed of durable rock (min 75mm-150mm), with drainage directed to sediment trap; all vehicles to traverse full length',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS52 / IECA Standard Drawing SD-SE. Prevents sediment tracking onto public roads -- also a requirement under EP Act 1994 (prescribed water contaminant).'
    },
    {
      description: 'Install catch drains, diversion drains, and batter chutes to manage clean water diversion around disturbed areas',
      acceptanceCriteria: 'Drains installed upstream of works to divert clean water around disturbed catchments; lined where velocities exceed erosion threshold for soil type; capacity per design storm event',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS52 -- Permanent controls (diversion drains, batter chutes) are designed into the road project. Temporary controls updated as construction progresses.'
    },

    // =========================================================================
    // ENVIRONMENTAL CONTROLS & MONITORING
    // =========================================================================
    {
      description: 'Verify dust suppression measures are implemented on exposed surfaces and haul roads',
      acceptanceCriteria: 'Water cart or approved suppressant applied to active work areas and haul roads; visible dust minimised; no complaints from adjoining properties; air quality objectives met',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS51 -- Environmental Management general requirements for dust control during construction. Also EP Act 1994 environmental nuisance provisions.'
    },
    {
      description: 'Maintain ESC devices after each rainfall event and repair/replace damaged or ineffective controls',
      acceptanceCriteria: 'All ESC devices inspected within 24 hours of rainfall event exceeding 10mm; sediment removed from devices before capacity reached (50% for sediment fences, design volume for basins); repairs completed within 48 hours',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS52 -- Contractor responsible for maintenance and adaptation of ESC devices.'
    },
    {
      description: 'Conduct water quality monitoring of sediment basin discharge and site runoff at designated monitoring points',
      acceptanceCriteria: 'Discharge from sediment basins: TSS <= 50mg/L (laboratory tested); field turbidity < 60 NTU indicates laboratory analysis not required; pH 6.5-8.5; monitoring at frequency specified in ESCP',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Laboratory TSS analysis per DES Monitoring and Sampling Manual; field turbidity (NTU) via turbidity tube or meter',
      notes: 'Clause 8 MRTS52 / QLD DES Procedural Guide for Water Release from Construction Sites. Release criteria per State Planning Policy 2017 and EP Act 1994.'
    },
    {
      description: 'Conduct independent ESC audits at specified project stages',
      acceptanceCriteria: 'Minimum three independent audits per project stage: (1) immediately following clearing and grubbing, (2) during cut and fill operations, (3) at end of major earthworks; higher frequency (monthly) for sensitive environments',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS52 -- Administrator may elect to nominate greater frequency of audits. Audit results to be actioned within timeframes specified by Administrator.'
    },
    {
      description: 'Progressively stabilise disturbed areas not required for active construction within specified timeframes',
      acceptanceCriteria: 'Exposed surfaces not required for works within 20 working days stabilised by mulching, seeding, turfing, or approved cover; maximum exposed area at any time as per ESCP limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8 MRTS52 -- Progressive stabilisation is a fundamental ESC principle. Timeframe may be shorter for high-risk areas or sensitive environments.'
    },

    // =========================================================================
    // RISK LEVEL CHANGES & DEWATERING
    // =========================================================================
    {
      description: 'Submit modified ESCP prior to designated risk level change date (e.g., wet season transition)',
      acceptanceCriteria: 'Modified ESCP submitted, accepted, and implemented on site prior to the designated risk level change date as specified in Annexure MRTS52',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Annexure MRTS52 -- Project-specific hold point. Date for risk level change and modified ESCP is specified in the annexure. Administrator release required.'
    },
    {
      description: 'Monitor sediment basin water levels and manage controlled dewatering/discharge',
      acceptanceCriteria: 'Dewatering only when water quality meets release criteria (TSS <= 50mg/L, pH 6.5-8.5); pumped discharge through filter socks or approved treatment; no uncontrolled discharge to receiving waters',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Laboratory TSS analysis; field pH and turbidity measurement',
      notes: 'Clause 8 MRTS52 / EP Act 1994 s440ZG -- Depositing prescribed water contaminants in waters is an offence. Controlled release only when criteria met.'
    },

    // =========================================================================
    // SPECIAL ENVIRONMENTAL MANAGEMENT
    // =========================================================================
    {
      description: 'Verify acid sulfate soil (ASS) management measures implemented where identified in geotechnical investigation',
      acceptanceCriteria: 'ASS management plan prepared and approved where ASS identified; treatment with agricultural lime at rates per plan; containment of ASS-affected runoff; pH monitoring of discharge',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Chromium suite test (AS 4969); field pH / oxidation-reduction potential',
      notes: 'Clause 6 MRTS52 / MRTS04 -- ASS management is critical in coastal QLD projects. May require separate management plan per QLD Acid Sulfate Soil Technical Manual.'
    },
    {
      description: 'Protect waterways, wetlands, and sensitive environmental areas with buffer zones and additional ESC treatment',
      acceptanceCriteria: 'Buffer zones maintained as per ESCP (minimum width per IECA guidelines); no direct discharge of untreated runoff to sensitive receiving waters; additional treatment measures (e.g., floating booms, turbidity curtains) installed where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6 MRTS52 / Environmental Protection (Water and Wetland Biodiversity) Policy 2019. Water quality objectives for receiving waters must not be compromised.'
    },
    {
      description: 'Record and report all environmental incidents (spills, uncontrolled releases, exceedances of water quality criteria)',
      acceptanceCriteria: 'Environmental incidents reported to Administrator within 24 hours; corrective actions implemented immediately; incident register maintained; regulatory reporting per EP Act where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS51 / EP Act 1994 -- Environmental incidents must be reported to DES where they constitute environmental harm or a breach of conditions.'
    },

    // =========================================================================
    // DECOMMISSIONING & CLOSE-OUT
    // =========================================================================
    {
      description: 'Decommission temporary ESC devices upon completion of permanent stabilisation and verify site is stabilised',
      acceptanceCriteria: 'All temporary ESC devices removed only after permanent stabilisation achieved (70% ground cover or equivalent); sediment removed from devices and disposed of appropriately; site left in condition that prevents ongoing erosion',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9 MRTS52 -- ESC devices must not be decommissioned prematurely. Administrator to verify stabilisation before decommissioning.'
    },
    {
      description: 'Submit final ESC compliance report and close-out documentation',
      acceptanceCriteria: 'Report demonstrating all ESC requirements met throughout construction; water quality monitoring results within criteria; audit non-conformances closed out; photo record of final site condition',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9 MRTS52 / MRTS51 -- Part of overall environmental close-out for the project.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All ESC criteria met, monitoring records complete, audit findings resolved',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
    }
  ]
}

// =============================================================================
// QLD LANDSCAPING AND REVEGETATION (MRTS16)
// =============================================================================

const qldLandscapingTemplate = {
  name: 'Landscaping and Revegetation Works',
  description: 'QLD TMR landscaping and revegetation works including soil management, seed and plant supply, topsoil placement, seeding, planting, and establishment maintenance per MRTS16',
  activityType: 'environmental',
  specificationReference: 'TMR MRTS16',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit Soil Management Plan -- Construction as part of Environmental Management Plan prior to commencement of clearing and grubbing',
      acceptanceCriteria: 'Soil Management Plan submitted, reviewed, and accepted by Administrator; identifies topsoil material requirements; demonstrates soil-related activities; integrates with overall soil management for the project',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.1 MRTS16 -- Milestone/Hold Point. Plan to be submitted with EMP prior to clearing and grubbing.'
    },
    {
      description: 'Submit Seed Supply Proposal identifying seed species, provenance, supplier, and quantities',
      acceptanceCriteria: 'Proposal submitted within 30 days of possession of site; seed species and provenance comply with Drawings and ESCP; supplier pre-qualified; seed viability and purity test results provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Seed viability test per AS/NZS 3113',
      notes: 'Clause 6 MRTS16 -- Hold Point. Seed Supply Proposal must be accepted before seed procurement. 30-day milestone from possession of site.'
    },
    {
      description: 'Submit Plant Supply Proposal identifying plant species, sizes, supplier/nursery, and quantities',
      acceptanceCriteria: 'Proposal submitted within 30 days of possession of site; plant species and sizes comply with Drawings and specification; nursery inspection allowed (5 days notice)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6 MRTS16 -- Hold Point. Plant Supply Proposal must be accepted before plant procurement. Contractor must allow minimum 5 days notice for joint inspections at nurseries.'
    },
    {
      description: 'Submit Plant Harvesting Proposal where plants are to be salvaged/harvested from site for re-use',
      acceptanceCriteria: 'Proposal identifies plant species to be harvested, harvesting method, storage and maintenance details; accepted by Administrator before harvesting commences',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6 MRTS16 -- Hold Point. Required only where plant harvesting from site is specified or proposed.'
    },
    {
      description: 'Submit Non-Potable Water Plan if non-potable water (dam, creek, river, bore water) is proposed for landscape watering',
      acceptanceCriteria: 'Plan submitted identifying water source, quality testing results, weed/disease risk assessment, and proposed treatment; plan accepted before non-potable water used',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Water quality analysis (salinity, pH, pathogens as applicable)',
      notes: 'Clause 6 MRTS16 -- Witness Point. Required only if non-potable water sources are proposed.'
    },

    // =========================================================================
    // TOPSOIL MANAGEMENT
    // =========================================================================
    {
      description: 'Strip, stockpile, and protect site topsoil in accordance with Soil Management Plan',
      acceptanceCriteria: 'Topsoil stripped to specified depth; stockpiled in designated areas away from drainage lines; stockpile height limited per plan (typically max 2m); weed management of stockpiles maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS16 -- Site topsoil shall be prioritised over imported topsoil where practicable. Stockpile management per MRTS04 General Earthworks.'
    },
    {
      description: 'Verify imported topsoil quality before placement',
      acceptanceCriteria: 'Imported topsoil tested and compliant: organic matter content, pH range 5.5-7.5 (or as specified), free of weeds/pathogens/contaminants, particle size suitable for specified use; test certificates provided',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Soil analysis (pH, EC, organic matter, nutrient levels, particle size) per laboratory methods',
      notes: 'Clause 7 MRTS16 -- Material requirements for topsoil. Imported topsoil to be tested before delivery to site.'
    },

    // =========================================================================
    // SUBSTRATE AND TOPSOIL PLACEMENT
    // =========================================================================
    {
      description: 'Prepare subgrade/substrate for topsoil placement -- decompact, scarify, and grade surfaces',
      acceptanceCriteria: 'Subgrade ripped/scarified to minimum 100mm depth to key topsoil; surface graded to design levels/profiles; free of rocks > 50mm, construction debris, and deleterious material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS16 -- Substrate preparation critical for plant establishment. Decompaction prevents interface drainage issues.'
    },
    {
      description: 'Place topsoil to specified depths on prepared surfaces',
      acceptanceCriteria: 'Topsoil placed to minimum design thickness (typically 100-150mm on batters, 200-300mm on flat areas, or as specified in Drawings); loose-placed without over-compaction; surface left rough to promote seed/water retention on batters',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8 MRTS16 -- Topsoil thickness as specified in Drawings and Annexure MRTS16.1. Do not compact topsoil on landscape areas.'
    },
    {
      description: 'Apply soil ameliorants and fertiliser as specified prior to seeding/planting',
      acceptanceCriteria: 'Ameliorants (gypsum, lime, organic matter) and fertiliser type, rate, and method of application as per specification and soil test recommendations; application records maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS16 -- Soil amelioration based on soil test results and specified requirements. Rates per Annexure MRTS16.1.'
    },

    // =========================================================================
    // SEEDING
    // =========================================================================
    {
      description: 'Conduct seeding (hydro-seeding, broadcast, drill) at specified rates and timing',
      acceptanceCriteria: 'Seed species, rates, and method comply with accepted Seed Supply Proposal; seeding conducted during optimal season (typically spring/early summer in QLD or as specified); seed applied uniformly at specified rate (kg/ha)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9 MRTS16 -- Seeding timing critical for establishment in QLD climate. Administrator to be notified of seeding operations.'
    },
    {
      description: 'Apply mulch (hydro-mulch, straw, wood chip, or specified type) over seeded areas',
      acceptanceCriteria: 'Mulch type, depth, and application rate as per specification; hydro-mulch applied uniformly at specified rate; straw/wood mulch to specified depth (typically 50-75mm); mulch free of weed seed and contaminants',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9 MRTS16 -- Mulch assists moisture retention and erosion protection during establishment. Application rates per Annexure MRTS16.1.'
    },

    // =========================================================================
    // PLANTING
    // =========================================================================
    {
      description: 'Install plants (tubestock, advanced, or as specified) at locations and spacings per Drawings',
      acceptanceCriteria: 'Plant species, sizes, and spacings comply with accepted Plant Supply Proposal and Drawings; plants healthy, vigorous, and free of disease/pests at time of planting; planting hole minimum 2x root ball width; backfill and water-in completed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 10 MRTS16 -- Administrator to be notified of planting operations. Plant quality to be verified at delivery.'
    },
    {
      description: 'Install tree guards/plant protection where specified',
      acceptanceCriteria: 'Tree guards installed on all specified plants; guards comply with material and size requirements; staked securely; protection from mowing, vehicles, and fauna as specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 10 MRTS16 -- Protection measures per Drawings and specification.'
    },

    // =========================================================================
    // ESTABLISHMENT MAINTENANCE
    // =========================================================================
    {
      description: 'Implement watering regime for establishment period',
      acceptanceCriteria: 'Watering frequency, volume, and method per specification and seasonal conditions; newly planted areas watered within 24 hours of planting; ongoing watering schedule maintained through establishment period (typically 12-52 weeks as specified)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 11 MRTS16 -- Establishment watering is Contractor responsibility for the specified maintenance period. Frequency adjusted for rainfall.'
    },
    {
      description: 'Conduct weed management during establishment period',
      acceptanceCriteria: 'Weed cover maintained below specified threshold (typically < 10% cover or as per specification); weeds removed by approved method (manual, chemical per approved herbicide list); no damage to establishing plants from weed control activities',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 11 MRTS16 -- Weed management critical for establishment success. Chemical application only by licensed operator.'
    },
    {
      description: 'Conduct establishment monitoring inspections at specified intervals during maintenance period',
      acceptanceCriteria: 'Inspections conducted at intervals specified in Annexure (typically monthly or bi-monthly); plant survival rate meets minimum threshold (typically >= 80%); ground cover from seeding meets minimum threshold; failed plants replaced',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Visual assessment / quadrat sampling for ground cover percentage',
      notes: 'Clause 11 MRTS16 -- Administrator to be notified and given opportunity to attend establishment inspections. Deficient areas to be re-seeded/re-planted.'
    },
    {
      description: 'Replace dead or failing plants within specified timeframe during establishment period',
      acceptanceCriteria: 'Dead or failing plants (< 50% canopy health) replaced with equivalent species and size within 20 working days of identification; replacement plants receive same establishment care',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 11 MRTS16 -- Replacement planting is Contractor responsibility during establishment/maintenance period.'
    },
    {
      description: 'Apply maintenance fertiliser during establishment period at specified intervals',
      acceptanceCriteria: 'Fertiliser type and rate as specified or per soil test recommendations; application at intervals per specification (typically at planting, 3 months, 6 months); application records maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 11 MRTS16 -- Maintenance fertiliser rates per Annexure MRTS16.1.'
    },

    // =========================================================================
    // FINAL ACCEPTANCE & CLOSE-OUT
    // =========================================================================
    {
      description: 'Conduct final establishment inspection at end of maintenance period to demonstrate landscape acceptance criteria met',
      acceptanceCriteria: 'All plant survival and ground cover targets achieved; weed cover below threshold; landscape areas free of erosion, settlement, or drainage defects; all punch-list items resolved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Visual / quantitative assessment per specification criteria',
      notes: 'Clause 12 MRTS16 -- Final acceptance inspection. Administrator must be satisfied landscape meets specification requirements before maintenance period concludes.'
    },
    {
      description: 'Submit landscape establishment close-out report with photo record, monitoring data, and as-planted plans',
      acceptanceCriteria: 'Report includes photo record at each inspection stage, monitoring data (survival rates, ground cover), as-planted species/locations, maintenance records, and any deviations from specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 12 MRTS16 -- Documentation required for project close-out and defects liability period.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All landscaping and revegetation criteria met, establishment records complete, maintenance period obligations fulfilled',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
    }
  ]
}

// =============================================================================
// QLD GEOSYNTHETICS (MRTS27 / MRTS58 / MRTS100)
// =============================================================================

const qldGeosyntheticsTemplate = {
  name: 'Geosynthetics (Geotextiles, Geogrids, Geomembranes)',
  description: 'QLD TMR geosynthetics installation including geotextiles for separation/filtration (MRTS27), geogrids for subgrade/pavement reinforcement (MRTS58), and high-strength geosynthetic reinforcement for embankments (MRTS100)',
  activityType: 'environmental',
  specificationReference: 'TMR MRTS27 / MRTS58 / MRTS100 / MRTS04',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // MATERIAL SUBMISSIONS & COMPLIANCE
    // =========================================================================
    {
      description: 'Submit geosynthetic product data sheets, test certificates, and material compliance documentation for Administrator review',
      acceptanceCriteria: 'Product data sheets for all geosynthetic products submitted; manufacturer test certificates demonstrating compliance with specified properties (tensile strength, elongation, UV resistance, filtration/separation class); products from approved manufacturers',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5 MRTS27 / Clause 5 MRTS58 / Clause 5 MRTS100 -- Material properties must comply before procurement. Submission required for Administrator acceptance.'
    },
    {
      description: 'Verify geotextile Strength Class and Filtration Class comply with specification requirements',
      acceptanceCriteria: 'Geotextile Strength Class and Filtration Class comply with Tables 5.8 and 5.9 of MRTS27; survivability class appropriate for construction method, subgrade condition, and backfill material; manufacturer certified test results provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 3706 series (Geotextile testing) -- tensile strength, elongation, CBR burst, trapezoidal tear, puncture',
      notes: 'Clause 5 MRTS27 -- Strength Class and Filtration Class per Tables 5.8 and 5.9. Geotextile survivability related to construction method and stone size.'
    },
    {
      description: 'Verify geogrid product compliance with MRTS58 requirements for subgrade/pavement reinforcement application',
      acceptanceCriteria: 'Geogrid type (uniaxial/biaxial/triaxial) per specification; tensile strength, junction efficiency, aperture size, and rib profile per MRTS58 requirements; UV resistance minimum 90% retained strength at 500 hours',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 3706 series; ASTM D4355 (UV resistance); ASTM D6637 (Geogrid tensile strength)',
      notes: 'Clause 5 MRTS58 -- Material conformance per specification tables. Applicable to geogrids and geocomposites used in subgrade/pavement reinforcement.'
    },
    {
      description: 'Verify high-strength geosynthetic reinforcement properties for embankment applications (where applicable)',
      acceptanceCriteria: 'Geosynthetic reinforcement manufactured from polyester or HDPE; short-term tensile strength per BS 6906; creep test minimum 10,000 hours per BS 6906 Part 5; design strength with reduction factors per BS 8006-1; UV resistance >= 90% at 500 hours per ASTM D4355',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'BS 6906 (Tensile strength); BS 6906 Part 5 (Creep test); ASTM D4355 (UV resistance)',
      notes: 'Clause 5 MRTS100 -- High strength geosynthetic reinforcement for basal reinforcement, load transfer mats, piled embankments. Must be directionally stable with no tendency to unravel, loosen, or tear during construction.'
    },

    // =========================================================================
    // MATERIAL INSPECTION & STORAGE
    // =========================================================================
    {
      description: 'Inspect geosynthetic materials on delivery -- verify labelling, condition, and storage requirements',
      acceptanceCriteria: 'Rolls labelled with product name, manufacturer, lot/batch number, roll dimensions; packaging intact; no UV damage, tears, or contamination; stored on level surface away from UV exposure, chemicals, and puncture hazards',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6 MRTS27 / MRTS58 / MRTS100 -- Material storage and handling requirements. UV-sensitive materials must be protected from prolonged sun exposure.'
    },

    // =========================================================================
    // SUBGRADE PREPARATION
    // =========================================================================
    {
      description: 'Prepare subgrade/surface for geosynthetic installation -- remove deleterious material, grade, and compact',
      acceptanceCriteria: 'Subgrade/surface free of rocks > 50mm (or as specified for product type), sharp objects, tree roots, and organic matter; surface graded smooth and compacted to specification; no ruts, soft spots, or standing water',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 7 MRTS27 / MRTS58 -- Subgrade preparation critical for geosynthetic performance and survivability.'
    },

    // =========================================================================
    // INSTALLATION
    // =========================================================================
    {
      description: 'Install geotextile (separation/filtration) with correct orientation, overlaps, and anchoring',
      acceptanceCriteria: 'Geotextile placed in correct direction (machine direction as specified); minimum overlap 300mm (or as specified for soil/application); overlaps secured by pins/staples at 1m centres (or as specified); fabric tensioned without wrinkles but not drum-tight; anchored in trenches on slopes where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS27 -- Installation requirements for separation and filtration geotextiles. Overlap direction to be such that upstream panel overlaps downstream panel in direction of water flow.'
    },
    {
      description: 'Install geogrid reinforcement with correct orientation, overlaps, and tensioning',
      acceptanceCriteria: 'Geogrid placed in specified direction (strong direction perpendicular to road centreline for subgrade reinforcement); minimum overlap 300mm for CBR > 2 (increased to 450-900mm for softer subgrades); geogrid tensioned and pinned; no damage to ribs or junctions during installation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS58 -- Geogrid installation requirements. Overlap per specification based on subgrade CBR. Administrator to be notified of geogrid installation.'
    },
    {
      description: 'Install high-strength geosynthetic reinforcement for embankment/load transfer applications',
      acceptanceCriteria: 'Reinforcement placed per design drawings and specification; orientation (strong direction) as designed; overlap/seaming per manufacturer requirements and design; connection details at structures per design; reinforcement tensioned per specification but not pre-stressed unless designed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 7 MRTS100 -- High-strength reinforcement installation is a critical structural element. Administrator must verify placement before covering.'
    },
    {
      description: 'Conduct seam testing for welded geomembrane joints (where geomembranes specified)',
      acceptanceCriteria: 'All welds tested by non-destructive methods (air pressure test or vacuum box); destructive peel and shear tests at specified frequency (typically 1 per 150m of weld); seam strength >= specified minimum (typically 80% of parent material strength); all test results documented',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ASTM D4437 (Geomembrane seam testing); ASTM D6392 (Shear/peel testing)',
      notes: 'Applicable only where geomembranes are specified (e.g., contaminated land, water containment). Not typically covered by MRTS27/58/100 -- project-specific specification may apply.'
    },

    // =========================================================================
    // COVER PLACEMENT & COMPACTION
    // =========================================================================
    {
      description: 'Place cover material (fill, aggregate, or soil) over installed geosynthetic within specified maximum exposure time',
      acceptanceCriteria: 'Cover material placed within 14 days of geosynthetic installation (or as specified) to limit UV exposure; minimum cover thickness per specification (typically 150-300mm depending on application); tracked equipment not to operate directly on geosynthetic without cover',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS27 / MRTS58 / MRTS100 -- Maximum exposure time before covering. Cover protects against UV and construction damage.'
    },
    {
      description: 'Compact cover material over geosynthetic per specification without damaging geosynthetic',
      acceptanceCriteria: 'Cover material compacted per MRTS04 or MRTS05 requirements; compaction equipment suitable for minimum cover thickness (light equipment for thin lifts); no sharp turns or sudden braking on geosynthetic with thin cover; compaction test results compliant',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1 (Compaction) or nuclear density gauge',
      notes: 'Clause 8 MRTS27 / MRTS58 -- Compaction requirements for cover material. Construction traffic management on geosynthetics per manufacturer installation guide.'
    },

    // =========================================================================
    // VERIFICATION & QUALITY RECORDS
    // =========================================================================
    {
      description: 'Verify geosynthetic continuity at structures, drainage outlets, and edges',
      acceptanceCriteria: 'Geosynthetic properly terminated or anchored at all edges and structures; geotextile wrapped around drainage pipes where specified; no gaps in coverage at transitions; lap joints secure at structure interfaces',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS27 -- Geosynthetic termination and interface details per Drawings.'
    },
    {
      description: 'Inspect geosynthetic for damage during and after cover placement -- repair any damage',
      acceptanceCriteria: 'No tears, punctures, or displaced overlaps visible; damaged areas patched with same material extending minimum 300mm beyond damage in all directions; patch secured by overlap/adhesive per manufacturer requirements; repair documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 MRTS27 / MRTS58 -- Damage repair requirements. Any geosynthetic damage must be repaired before covering or acceptance.'
    },
    {
      description: 'Conduct as-built survey of geosynthetic placement and submit records',
      acceptanceCriteria: 'As-built records showing geosynthetic type, location, depth, orientation, overlap locations, and any repairs; product batch/lot numbers recorded; manufacturer certificates retained with quality records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Quality records per MRTS50 Specific Quality System Requirements. As-built documentation for future reference.'
    },
    {
      description: 'Verify separation geotextile installed at change in material type within embankments (where specified in MRTS04)',
      acceptanceCriteria: 'Geotextile installed between dissimilar materials (e.g., select fill over natural ground, granular over cohesive) where specified; geotextile class per MRTS27; overlaps and placement per standard requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS04 General Earthworks -- Geotextile required at changes in material type and stepping of ground surfaces on which embankments are constructed. Cross-reference MRTS27 for material properties.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All geosynthetic material and installation criteria met, test certificates complete, as-built records submitted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
    }
  ]
}

// =============================================================================
// QLD REINFORCED SOIL WALLS (MRTS06)
// =============================================================================

const qldReinforcedSoilWallsTemplate = {
  name: 'Reinforced Soil Walls (MSE Walls / Reinforced Soil Structures)',
  description: 'QLD TMR reinforced soil wall construction including MSE walls with steel strip or geosynthetic reinforcement, facing units, reinforced fill placement, drainage, and monitoring per MRTS06 aligned with ATS5120',
  activityType: 'environmental',
  specificationReference: 'TMR MRTS06',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // MATERIAL SUBMISSIONS & DESIGN
    // =========================================================================
    {
      description: 'Submit sampling of facing units to Administrator for assessment of suitability',
      acceptanceCriteria: 'Facing unit samples (concrete blocks, masonry units, or panels) supplied to Administrator for inspection minimum 14 days prior to construction; units comply with AS/NZS 4455 and AS 3700; dimensions, finish, colour, and structural properties verified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 4456 series (Masonry unit tests); compressive strength per AS/NZS 4456.4',
      notes: 'Clause 7.5.4 MRTS06 -- Witness Point 1. Supply of facing unit samples with 14-day milestone prior to construction.'
    },
    {
      description: 'Submit design of Reinforced Soil Wall (RSW) including drawings, calculations, and design report for Administrator review',
      acceptanceCriteria: 'RSW design submitted minimum 28 days prior to construction; design complies with MRTS06 and referenced standards (AS 4678, BS 8006-1); design by suitably qualified geotechnical/structural engineer; global stability, internal stability, compound stability, and bearing capacity all verified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8.5 MRTS06 -- Witness Point 2. Submission of design and drawings with 28-day milestone. Design per AS 4678 Earth Retaining Structures and BS 8006-1 Reinforced Soils.'
    },
    {
      description: 'Verify reinforced fill material properties comply with specification requirements',
      acceptanceCriteria: 'Frictional fill material: plasticity index (PI) within specified limits (typically PI < 6); particle size grading within specified envelope; free of organic matter, deleterious substances; internal friction angle verified; electrochemical properties per specification for steel reinforcement applications',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.3.1 (Liquid limit); AS 1289.3.2.1 (Plastic limit / PI); AS 1289.3.6.1 (Particle size distribution); AS 1289.4.3.1 (Resistivity); pH test',
      notes: 'Clause 7 MRTS06 -- Reinforced fill material must be capable of being compacted. Frictional fill consisting of naturally occurring or processed material.'
    },
    {
      description: 'Verify soil reinforcement materials (steel strips, geogrids, or geotextiles) comply with specification',
      acceptanceCriteria: 'Reinforcement type, dimensions, strength, and corrosion protection as per approved design; steel strips: galvanised coating thickness per AS/NZS 4680; geogrids: long-term design strength with reduction factors per BS 8006-1; manufacturer test certificates provided for each batch',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tensile strength per relevant standard; galvanising thickness per AS/NZS 4680; creep per BS 6906 Part 5 (geogrids)',
      notes: 'Clause 7 MRTS06 -- Material properties verified before installation. Steel reinforcement corrosion protection critical for design life.'
    },

    // =========================================================================
    // FOUNDATION & LEVELLING PAD
    // =========================================================================
    {
      description: 'Verify foundation preparation for RSW -- excavate to design level and inspect foundation',
      acceptanceCriteria: 'Foundation excavated to design level; founding material exposed and inspected; bearing capacity confirmed consistent with design assumptions; foundation level, clean, and free of loose material, soft pockets, and water; foundation approval by Administrator before proceeding',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Visual inspection; DCP/plate load test where required by design',
      notes: 'Clause 9.5.1 MRTS06 -- Hold Point 3. Acceptance of foundation. Inspection of foundation by Administrator required. Work MUST NOT proceed until foundation is released.'
    },
    {
      description: 'Construct levelling pad (concrete or compacted granular) for first course of facing units',
      acceptanceCriteria: 'Levelling pad constructed to design levels and alignment; concrete levelling pad: minimum dimensions and strength as per design (typically 300mm wide x 150mm deep, N20 concrete); granular pad: compacted to 100% SMDD; level tolerance +/- 5mm over 3m',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey level check',
      notes: 'Clause 9.5.1 MRTS06 -- Levelling pad alignment and level critical for wall verticality and aesthetics.'
    },

    // =========================================================================
    // ERECTION METHOD & FIRST COURSE
    // =========================================================================
    {
      description: 'Submit details of erection/construction method for Administrator review',
      acceptanceCriteria: 'Erection method statement submitted minimum 7 days prior to construction; method addresses lifting and placing facing units, reinforcement connection procedure, temporary propping/bracing, and sequence of operations',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9.5.2 MRTS06 -- Hold Point 4. Suitability of construction method. Submission of details of erection method with 7-day milestone.'
    },
    {
      description: 'Place first course of facing units (panels or blocks) and verify alignment before proceeding',
      acceptanceCriteria: 'First course placed on levelling pad; alignment to design line +/- 10mm; verticality/batter within tolerance; units level and stable; connection hardware installed where applicable; joints consistent and per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (alignment, level, verticality)',
      notes: 'Clause 9.5.2 MRTS06 -- Hold Point 5. Construction of second course of facing units cannot proceed until first course accepted.'
    },

    // =========================================================================
    // REINFORCEMENT & FILL PLACEMENT
    // =========================================================================
    {
      description: 'Inspect soil reinforcement-to-facing connection during construction of each course',
      acceptanceCriteria: 'Reinforcement connected to facing units per manufacturer/designer requirements; connection hardware (clips, pins, loops) correctly installed and engaged; no damage to reinforcement at connection point; reinforcement correctly oriented (strong direction perpendicular to face)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9.5.3 MRTS06 -- Witness Point. Recording of condition of soil reinforcement and facing connections. Connection integrity critical for wall performance.'
    },
    {
      description: 'Place reinforced fill material in layers at specified loose lift thickness',
      acceptanceCriteria: 'Reinforced fill placed in horizontal layers; maximum loose lift thickness 200mm (or as specified); fill placed from behind facing panel outwards (or as per erection method); no fill placed directly against face before reinforcement installed; fill free of oversize material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9.5.3 MRTS06 -- Fill layer thickness controls compaction quality and reinforcement alignment.'
    },
    {
      description: 'Compact reinforced fill to specified density in each layer',
      acceptanceCriteria: 'Compaction to minimum 95% modified maximum dry density (or as specified); within zone 1m of facing panels: light compaction equipment only (typically plate compactor or walk-behind roller) to prevent facing displacement; moisture content within -2% to +2% of OMC (or as specified)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1 (Compaction -- sand replacement) or nuclear density gauge; AS 1289.5.2.1 (Modified compaction -- OMC/MDD)',
      notes: 'Clause 9.5.3 MRTS06 -- Compaction requirements. Reduced compaction zone near face to prevent panel displacement.'
    },
    {
      description: 'Conduct compaction testing of reinforced fill at specified frequency',
      acceptanceCriteria: 'Density tests at frequency per MRTS06 / MRTS50 (typically minimum 1 per 200m2 per layer or as specified); all test results meet minimum density requirement; failed areas re-compacted and re-tested',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1 (Compaction control -- sand replacement) or nuclear density gauge',
      notes: 'Clause 9.5.3 MRTS06 -- Testing frequency per specification. Compaction records maintained for each layer.'
    },
    {
      description: 'Place and compact general backfill material behind reinforced zone',
      acceptanceCriteria: 'General backfill compacted to minimum 95% SMDD (or as specified); material properties per MRTS04; placed in layers not exceeding 300mm loose; compaction verified by testing; interface with reinforced fill zone managed per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1 (Compaction control)',
      notes: 'Clause 9.5.3 MRTS06 -- General fill behind reinforced zone per MRTS04. Filter material at interface where specified.'
    },

    // =========================================================================
    // DRAINAGE
    // =========================================================================
    {
      description: 'Install drainage system behind RSW (drainage blanket, perforated pipe, filter material)',
      acceptanceCriteria: 'Drainage aggregate placed behind facing panels and at base of wall per design; perforated drainage pipe installed at correct grade to outlet points; geotextile filter wrapping where specified per MRTS27; outlets connected and functional; free-draining path maintained through full height',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9.5.4 MRTS06 -- Drainage behind RSW is critical for preventing hydrostatic pressure on wall. Administrator to be notified.'
    },

    // =========================================================================
    // ALIGNMENT & QUALITY CHECKS
    // =========================================================================
    {
      description: 'Verify wall face alignment and verticality/batter at each course level during construction',
      acceptanceCriteria: 'Face alignment checked at each course; verticality/batter tolerance +/- 25mm from design over any 3m height (or as specified); no bulging or steps between adjacent panels exceeding 5mm; horizontal alignment per design +/- 15mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (plumb bob, total station, string line)',
      notes: 'Clause 10 MRTS06 -- Alignment and verticality checked incrementally during construction. Out-of-tolerance sections must be corrected before proceeding.'
    },
    {
      description: 'Inspect reinforcement condition and placement before covering with fill',
      acceptanceCriteria: 'Reinforcement free of damage (kinks, cuts, corrosion beyond allowance); laid flat and straight without wrinkles or folds; correct embedment length achieved; overlaps (for geogrids) per design minimum; no soil contamination on reinforcement surfaces',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9.5.3 MRTS06 -- Witness Point. Reinforcement condition and placement verified before covering.'
    },
    {
      description: 'Install joint filler material and sealant between facing panels as specified',
      acceptanceCriteria: 'Compressible joint filler installed in horizontal and vertical joints per specification; geotextile strip behind joints to prevent fill loss; sealant applied to external face where specified; joints consistent in width and appearance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9.5.2 MRTS06 -- Panel joints must prevent fill loss while allowing minor movement.'
    },

    // =========================================================================
    // CAPPING & FINISHING
    // =========================================================================
    {
      description: 'Construct capping beam/coping unit on top of RSW',
      acceptanceCriteria: 'Capping beam/coping constructed per design; concrete grade and reinforcement per MRTS70 / MRTS71; alignment and level per Drawings; connection to facing panels per design; finish and appearance consistent',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9.5.5 MRTS06 -- Capping beam typically cast-in-place concrete. Steel reinforcement per MRTS71.'
    },
    {
      description: 'Verify RSW is not loaded (surcharge from construction equipment, stockpiles, or permanent loads) until specified time after completion',
      acceptanceCriteria: 'No surcharge loads applied to RSW until minimum time period elapsed (as specified in design); construction traffic not permitted within specified offset from wall face during and after construction; temporary fencing/barriers maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 10 MRTS06 -- Loading restrictions during and after construction per design requirements.'
    },

    // =========================================================================
    // MONITORING & SURVEY
    // =========================================================================
    {
      description: 'Conduct settlement and displacement monitoring of RSW during construction',
      acceptanceCriteria: 'Survey monitoring points installed on wall face and crest per monitoring plan; readings taken at specified intervals (typically each course and weekly during construction); settlements and displacements within design predictions and alarm levels; results reported to Administrator',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey monitoring (precise levelling, total station)',
      notes: 'Clause 10 MRTS06 -- Monitoring during construction critical for detecting performance issues. Monitoring plan per design requirements.'
    },
    {
      description: 'Conduct final survey of completed RSW -- alignment, verticality, level, and overall geometry',
      acceptanceCriteria: 'Final wall survey demonstrating compliance with design geometry within specified tolerances; face alignment, batter, crest level, and wall length all verified; as-built drawings prepared',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey (total station / precise level)',
      notes: 'Clause 10 MRTS06 -- Final survey and as-built documentation. Administrator to attend final inspection.'
    },

    // =========================================================================
    // ADDITIONAL PROTECTION & INTERFACES
    // =========================================================================
    {
      description: 'Verify surface water drainage at top of wall (behind coping) prevents water infiltration into reinforced zone',
      acceptanceCriteria: 'Surface water collected and directed away from wall; no ponding behind capping beam; drainage falls graded away from wall crest; membrane/sealant at capping-to-fill interface where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9.5.4 MRTS06 -- Surface water management at crest prevents saturation of reinforced fill.'
    },
    {
      description: 'Verify facing unit aesthetic requirements -- colour consistency, joint alignment, surface defects',
      acceptanceCriteria: 'Facing colour consistent across wall (no patchwork appearance); horizontal and vertical joint lines straight and aligned; no cracked, chipped, or stained panels; surface finish per specification; overall appearance acceptable to Administrator',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7.5.4 MRTS06 -- Facing unit aesthetic requirements. Particularly important for walls visible to road users or public.'
    },
    {
      description: 'Install erosion protection at wall toe and outlet points',
      acceptanceCriteria: 'Rock protection (riprap) or concrete apron at wall toe where specified; outlet pipes discharged to stable surfaces; energy dissipation provided at concentrated discharge points; erosion protection per MRTS03 requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9.5.4 MRTS06 / MRTS03 -- Toe protection prevents scour undermining foundation.'
    },
    {
      description: 'Verify backfill material at structure interfaces (wing walls, abutments) is placed per design',
      acceptanceCriteria: 'Select fill material at structure interfaces placed in reduced lifts (max 150mm); compacted with light equipment to prevent damage to structure; reinforcement connected per design at transitions; no voids between wall and structure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9.5.3 MRTS06 -- Interface with other structures requires special attention to compaction and reinforcement continuity.'
    },

    // =========================================================================
    // ELECTROCHEMICAL TESTING & PROPPING
    // =========================================================================
    {
      description: 'Test reinforced fill material for electrochemical properties (for steel reinforcement systems)',
      acceptanceCriteria: 'Soil resistivity >= 1000 ohm-cm (or as specified); pH 5-10 (or as specified); chloride content within limits; sulfate content within limits; test frequency per specification (typically each 500m3 or each material source)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.4.3.1 (Resistivity); AS 1289.4.2.1 (pH); chloride and sulfate analysis',
      notes: 'Clause 7 MRTS06 -- Electrochemical testing required for steel strip reinforcement systems to verify design corrosion allowance. Not applicable to geosynthetic reinforcement.'
    },
    {
      description: 'Verify temporary propping and bracing of facing panels during construction is adequate',
      acceptanceCriteria: 'Temporary props installed per erection method statement; props maintain panel alignment and prevent displacement during fill placement; props removed only when fill provides adequate restraint (typically after fill placed to 2/3 of panel height above connection level)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9.5.2 MRTS06 -- Temporary support of facing panels during construction.'
    },

    // =========================================================================
    // POST-CONSTRUCTION MONITORING
    // =========================================================================
    {
      description: 'Conduct post-construction monitoring survey at specified intervals during defects liability period',
      acceptanceCriteria: 'Survey monitoring continued at specified intervals post-construction (typically monthly for 3 months, then quarterly); settlements and displacements within design predictions; monitoring results reported to Administrator; any anomalies investigated and reported',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey monitoring (precise levelling, total station)',
      notes: 'Clause 10 MRTS06 -- Post-construction monitoring may extend through defects liability period. Frequency per monitoring plan or as directed by Administrator.'
    },

    // =========================================================================
    // PULL-OUT TESTING (WHERE SPECIFIED)
    // =========================================================================
    {
      description: 'Conduct pull-out test on soil reinforcement (where specified in design or where conformance is in doubt)',
      acceptanceCriteria: 'Pull-out resistance meets or exceeds design values; test procedure per specification; minimum 3 tests per wall section (or as specified); results reported with reinforcement type, depth, fill properties, and load-displacement data',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Pull-out test per ASTM D6706 or project-specific test procedure',
      notes: 'Clause 8 MRTS06 -- Pull-out testing typically only required where specified in design or where unconventional fill material is proposed.'
    },

    // =========================================================================
    // COMPLETION & CLOSE-OUT
    // =========================================================================
    {
      description: 'Submit RSW completion documentation package including as-built drawings, test results, monitoring data, and design certification',
      acceptanceCriteria: 'Completion package includes: as-built drawings showing all dimensions; reinforcement type/spacing/length records; compaction test results; material test certificates; construction photos; monitoring data; design engineer statement of compliance',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 11 MRTS06 -- Final documentation package for RSW. Administrator acceptance required before wall is considered complete.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All RSW criteria met, monitoring data acceptable, documentation package complete',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
    }
  ]
}

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedTemplate(templateData) {
  console.log(`  Seeding: ${templateData.name}...`)

  const existing = await prisma.iTPTemplate.findFirst({
    where: {
      name: templateData.name,
      stateSpec: 'MRTS',
      projectId: null
    }
  })

  if (existing) {
    console.log(`  ⚠️  "${templateData.name}" already exists (ID: ${existing.id}). Skipping.`)
    return existing
  }

  const template = await prisma.iTPTemplate.create({
    data: {
      projectId: null,
      name: templateData.name,
      description: templateData.description,
      activityType: templateData.activityType,
      specificationReference: templateData.specificationReference,
      stateSpec: templateData.stateSpec,
      isActive: true,
      checklistItems: {
        create: templateData.checklistItems.map((item, index) => ({
          sequenceNumber: index + 1,
          description: item.description,
          acceptanceCriteria: item.acceptanceCriteria,
          pointType: item.pointType,
          responsibleParty: item.responsibleParty,
          evidenceRequired: item.evidenceRequired,
          testType: item.testType,
          notes: item.notes
        }))
      }
    },
    include: {
      checklistItems: true
    }
  })

  const hp = template.checklistItems.filter(i => i.pointType === 'hold_point').length
  const wp = template.checklistItems.filter(i => i.pointType === 'witness').length
  const sp = template.checklistItems.filter(i => i.pointType === 'standard').length

  console.log(`  ✅ Created: ${template.name} (${template.checklistItems.length} items: ${hp}H/${wp}W/${sp}S)`)
  return template
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' QLD (TMR/MRTS) ITP Template Seeder - Environmental')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(qldESCTemplate)
    await seedTemplate(qldLandscapingTemplate)
    await seedTemplate(qldGeosyntheticsTemplate)
    await seedTemplate(qldReinforcedSoilWallsTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (4 environmental templates)')
    console.log('═══════════════════════════════════════════════════════════════')

  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
