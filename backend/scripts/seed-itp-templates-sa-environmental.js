/**
 * Seed Script: SA (DIT) ITP Templates - Environmental
 *
 * Creates global ITP templates for SA environmental activities.
 * Templates: ESC (EHTM / EPA SA / PR-LS-C5), Landscaping (PR-LS Series),
 *            Geosynthetics (RD-EW-S1), Reinforced Soil Structures (ST-RE-C1)
 *
 * Run with: node scripts/seed-itp-templates-sa-environmental.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// =============================================================================
// SA EROSION & SEDIMENT CONTROL (DIT EHTM / EPA SA / PR-LS-C5)
// =============================================================================

const saESCTemplate = {
  name: 'Erosion & Sediment Control (DIT EHTM / EPA SA)',
  description: 'DIT Erosion and Sediment Control per the Environment and Heritage Technical Manual (EHTM), EPA SA stormwater guidelines, and PR-LS-C5 (Erosion Control Matting). SA uses a multi-document approach — no single ESC specification. Covers silt fences, sediment basins, rock check dams, stabilised entries, and monitoring.',
  activityType: 'environmental',
  specificationReference: 'EHTM / EPA SA / PR-LS-C5',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK PLANNING
    // =========================================================================
    {
      description: 'Submit Erosion and Sediment Control Plan (ESCP) / Soil Erosion Drainage Management Plan (SEDMP)',
      acceptanceCriteria: 'ESCP/SEDMP addresses all site-specific erosion risks; identifies control measures for each stage of works; includes site plan showing drainage paths, sensitive receivers, waterways; complies with EHTM Part 5 and EPA SA Code of Practice for Building and Construction; SEDMP required where total disturbed area exceeds 0.5 hectares',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM Part 5 / EPA SA Code of Practice. Work must not commence until ESCP/SEDMP is reviewed and accepted by Principal\'s Authorised Person. SA requires SEDMP where disturbed area exceeds 0.5 ha.'
    },
    {
      description: 'Verify ESC personnel competency and training records',
      acceptanceCriteria: 'All personnel directly involved in installing and maintaining ESC measures hold demonstrated competence or have completed a recognised training course in erosion and sediment control; records current and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM. Training must be completed prior to commencement of works onsite.'
    },
    {
      description: 'Confirm sensitive environmental receivers identified and mapped',
      acceptanceCriteria: 'All waterways, drainage lines, vegetation to be retained, and neighbouring properties identified on ESCP site plan; buffer distances documented; stormwater discharge points to receiving waters identified per EPA SA Environment Protection (Water Quality) Policy 2015',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM Part 5 / EPA SA. EPA SA Environment Protection (Water Quality) Policy 2015 provides the legal framework for water quality protection.'
    },
    {
      description: 'Establish baseline water quality at receiving waterways (if applicable)',
      acceptanceCriteria: 'Baseline turbidity and pH readings taken at upstream and downstream monitoring points as specified in ESCP; readings documented with date, time, location, and instrument calibration records; baseline established before site disturbance commences',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Turbidity meter (NTU), pH meter',
      notes: 'EHTM Part 5 / EPA SA. Required for works near sensitive waterways. Baseline data needed to assess construction impact on water quality.'
    },
    {
      description: 'Confirm ESC materials and products are on site prior to earthworks commencing',
      acceptanceCriteria: 'Silt fence fabric, posts, sediment basin materials, rock check dam materials, erosion control matting (PR-LS-C5 compliant), stabilised site entry materials all available on site and compliant with specifications',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EHTM / PR-LS-C5. ESC measures must be installed before ground disturbance commences. Two-pronged approach: erosion controls (prevention) and sediment controls (capture).'
    },

    // =========================================================================
    // ESC INSTALLATION
    // =========================================================================
    {
      description: 'Install sediment fences to ESCP locations and details',
      acceptanceCriteria: 'Geotextile fabric buried in trench to specified depth; supported by posts at maximum centres per design; maximum contributing slope length for sheet flow only; fabric returns at ends to prevent bypass; joins overlapped and secured; positioned downslope of disturbed areas',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EHTM / EPA SA Code of Practice. Silt fences for sheet flow only — not to be placed across concentrated flow paths. Must be installed before earthworks commence in contributing catchment.'
    },
    {
      description: 'Construct sediment basin(s) to ESCP design',
      acceptanceCriteria: 'Basin sized per project-specific catchment analysis; volumetric capacity as designed; inlet and outlet structures installed; emergency spillway provided; basin operational before contributing catchment is disturbed; dewatering procedure documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EHTM / EPA SA. Sediment basins required where project catchment analysis determines necessity. Basin must be desilted when capacity is reduced.'
    },
    {
      description: 'Install rock check dams in drainage lines',
      acceptanceCriteria: 'Rock size and grading per ESCP design; check dam height maximum 450 mm above invert; spacing such that toe of upstream dam is at crest level of downstream dam; sides keyed into channel banks; geotextile underliner where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EHTM / EPA SA. Check dams slow concentrated flow to allow sediment deposition.'
    },
    {
      description: 'Construct stabilised site entry/exit point',
      acceptanceCriteria: 'Minimum dimensions per ESCP design; clean crushed rock over geotextile at specified depth; drainage directed to sediment control device; all site vehicles to use stabilised entry/exit to prevent tracking of mud onto public roads',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA SA Code of Practice. Stabilised entries required at all construction site access points to public roads.'
    },
    {
      description: 'Install erosion control matting per PR-LS-C5',
      acceptanceCriteria: 'Erosion control matting type, weight and material as specified in PR-LS-C5; surface prepared and free of debris; matting anchored securely with pins/staples at specified centres; overlaps in direction of water flow; matting extends into anchor trench at crest',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'PR-LS-C5 (Erosion Control Matting). Matting used on exposed batters, channels and other erosion-prone surfaces requiring stabilisation before vegetation establishment.'
    },
    {
      description: 'Install temporary diversion drains and catch drains',
      acceptanceCriteria: 'Diversion drains installed upslope of works area to divert clean water around disturbed areas; minimum grade as designed; lined where flow velocity exceeds erosive threshold for soil type; directed to stable outlet point',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EHTM. Separating clean and dirty water is a fundamental ESC principle — minimising erosion reduces the need for sediment controls.'
    },
    {
      description: 'Implement dust control measures',
      acceptanceCriteria: 'Water carts operating as needed to suppress dust; exposed areas dampened during windy conditions; haul roads maintained and dampened; dust does not create hazard or nuisance to public or adjacent properties; visible dust emissions minimised',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM / EPA SA. Dust suppression required to prevent nuisance and protect air quality during construction.'
    },
    {
      description: 'Install stormwater outlet protection',
      acceptanceCriteria: 'Energy dissipation and sediment capture measures installed at all temporary and permanent stormwater outlets; outlet protection sized for design flow; scour protection extends to stable receiving environment; no discharge of pollutants to stormwater per EPA SA requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA SA Environment Protection (Water Quality) Policy 2015. Pollutants cannot be discharged to stormwater system.'
    },
    {
      description: 'Verify all ESC measures installed and functional before ground disturbance commences',
      acceptanceCriteria: 'All perimeter and downslope ESC measures installed, inspected and documented as functional; photographic record taken; sign-off by ESC-trained personnel; measures confirmed adequate for first stage of earthworks',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM / EPA SA. ESC controls must be in place before any clearing, grubbing or earthworks. Principal\'s Authorised Person to confirm.'
    },

    // =========================================================================
    // MONITORING & MAINTENANCE
    // =========================================================================
    {
      description: 'Conduct routine weekly ESC inspection',
      acceptanceCriteria: 'All ESC measures inspected at least once per week; deficiencies recorded on standard ESC inspection checklist; photographic record maintained; rectification actions noted and completed within specified timeframe',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM. Regular inspections required to ensure ESC measures remain functional.'
    },
    {
      description: 'Conduct post-rainfall ESC inspections',
      acceptanceCriteria: 'Additional inspections conducted after each rainfall event exceeding nominated threshold; ESC measures checked for damage, displacement and sediment accumulation; effectiveness of controls assessed; rectification actions implemented immediately',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM / EPA SA. Post-rainfall inspections critical for identifying ESC failures and preventing offsite sediment discharge.'
    },
    {
      description: 'Repair and maintain ESC devices after rain events',
      acceptanceCriteria: 'Sediment removed from behind silt fences when accumulation reaches 50% of fence height; damaged or collapsed sections replaced immediately; sediment basins desilted when capacity reduced; all ESC devices restored to functional condition',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EHTM / EPA SA. ESC measures must be maintained to remain functional throughout construction.'
    },
    {
      description: 'Rectify ESC deficiencies within required timeframe',
      acceptanceCriteria: 'All defects and deficiencies in control measures rectified immediately upon identification; control measures cleaned, repaired and augmented as required; rectification documented with before and after photographs; non-conformances reported to Principal\'s Authorised Person',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM / EPA SA. Prompt rectification required to prevent sediment discharge. EPA SA compliance obligations apply.'
    },
    {
      description: 'Monitor discharge water quality (if discharging offsite)',
      acceptanceCriteria: 'Turbidity readings within EPA SA discharge limits at monitoring points; pH within acceptable range; no visible oil, grease or floating debris in discharge; compliance with Environment Protection (Water Quality) Policy 2015; records maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Turbidity meter (NTU), pH meter',
      notes: 'EPA SA Environment Protection (Water Quality) Policy 2015. Required where site runoff discharges to waterways or stormwater system.'
    },
    {
      description: 'Maintain monitoring and maintenance schedule register',
      acceptanceCriteria: 'Register records all ESC inspections, maintenance activities, rainfall data, water quality monitoring results, and corrective actions; register available for review by Principal\'s Authorised Person at any time',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM. Documented monitoring and maintenance schedule required for compliance verification.'
    },

    // =========================================================================
    // PROGRESSIVE STABILISATION & DECOMMISSIONING
    // =========================================================================
    {
      description: 'Progressive site stabilisation of completed areas',
      acceptanceCriteria: 'Completed areas permanently stabilised (topsoiled, seeded, mulched, or paved) within specified timeframe; exposed areas not being actively worked stabilised with temporary measures; limit exposed site areas and limit the time areas are exposed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EHTM / EPA SA. Progressive stabilisation is a key ESC principle — minimise duration and extent of exposed surfaces.'
    },
    {
      description: 'Apply temporary stabilisation to stockpiles and inactive surfaces',
      acceptanceCriteria: 'Topsoil and spoil stockpiles covered or seeded if inactive for more than 14 days; exposed cut and fill batters stabilised with erosion control matting (PR-LS-C5), hydromulch or temporary seeding within specified timeframes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EHTM / PR-LS-C5. Minimise erosion from stockpiles and inactive work areas.'
    },
    {
      description: 'Decommission ESC measures and achieve final stabilisation',
      acceptanceCriteria: 'All temporary ESC measures removed only after permanent stabilisation achieved; sediment basins decommissioned and rehabilitated or converted to permanent features; all disturbed areas permanently stabilised; final ESC inspection completed and documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EHTM / EPA SA. ESC measures remain in place until permanent stabilisation achieved. Principal\'s Authorised Person to verify all ESC measures appropriately decommissioned.'
    },
    {
      description: 'Compile EPA SA compliance documentation package',
      acceptanceCriteria: 'All monitoring records, inspection checklists, maintenance logs, water quality test results, incident reports, and corrective actions compiled; demonstrates compliance with EPA SA Environment Protection (Water Quality) Policy 2015 throughout construction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'EPA SA / EHTM. Compliance documentation required to demonstrate adherence to regulatory requirements.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All ESC criteria met, inspection and monitoring records complete, decommissioning verified, EPA SA compliance documentation package accepted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
    }
  ]
}

// =============================================================================
// SA LANDSCAPING & REVEGETATION (DIT PR-LS Series)
// =============================================================================

const saLandscapingTemplate = {
  name: 'Landscaping & Revegetation (DIT PR-LS Series)',
  description: 'DIT Landscaping and Revegetation per the Public Realm Landscape (PR-LS) specification series — SA has the most granular landscaping specs of any state (12+ separate parts). Key specs: PR-LS-C2 (Planting), PR-LS-C6 (Seeding), PR-LS-C7 (Topsoil), plus PR-LS-C1 (Soft Landscape), PR-LS-C3 (Mulching), PR-LS-C4 (Irrigation), PR-LS-C5 (Erosion Control Matting), PR-LS-C8 (Turf), PR-LS-C9 (Tree Relocation).',
  activityType: 'environmental',
  specificationReference: 'PR-LS-C1 to C9',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit landscape plan and species list for review',
      acceptanceCriteria: 'Landscape plan shows all areas to be planted, seeded, mulched and turfed; species schedule matches design drawings (PR-LS-D1, PR-LS-D2); container sizes, quantities and spacing confirmed; plant sourcing identified per PR-LS-S1 (Supply of Plant Material); species suitable for SA climate and local conditions',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-D1 / PR-LS-D2. Plan must be submitted and accepted by Principal\'s Authorised Person before landscape works commence. SA has the most granular landscaping specs of any state (12+ separate PR-LS parts).'
    },
    {
      description: 'Verify plant stock quality and species compliance per PR-LS-S1',
      acceptanceCriteria: 'Plant stock compliant with PR-LS-S1 (Supply of Plant Material) and AS 2303 where applicable; species, cultivar, container size match schedule; plants healthy, free of disease and pests; root system well-developed and not root-bound; plants hardened off for site conditions',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2303 (Tree Stock for Landscape Use)',
      notes: 'PR-LS-S1. Plants to be inspected on delivery before planting commences.'
    },
    {
      description: 'Submit weed management program',
      acceptanceCriteria: 'Weed control program documented; herbicide types and application rates specified; timing of pre-treatment documented; management of declared weeds under SA legislation addressed; program integrated with planting and seeding schedule',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C2 / PR-LS-M1. Weed control required to protect establishing plantings and ensure revegetation success.'
    },

    // =========================================================================
    // TOPSOIL (PR-LS-C7)
    // =========================================================================
    {
      description: 'Verify topsoil source and quality per PR-LS-C7',
      acceptanceCriteria: 'Topsoil compliant with PR-LS-C7 requirements and AS 4419; free of declared noxious weeds, contaminants, and debris; organic content, pH, nutrient levels, salinity within specified limits; non-dispersive topsoil as required by RD-EW-D1; test results from supplier provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 4419 (Soils for Landscaping and Garden Use)',
      notes: 'PR-LS-C7. RD-EW-D1 requires minimum 150 mm of non-dispersive topsoil on cut faces before revegetation. Source approval required before supply commences.'
    },
    {
      description: 'Strip and stockpile existing topsoil from cleared areas',
      acceptanceCriteria: 'Topsoil stripped to specified depth before earthworks; stockpiled separately from subsoil; stockpile height maximum as specified; stockpile located away from waterways; seeded or covered if stored for extended period; topsoil conditioning per PR-LS-C7 if required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'PR-LS-C7 / RD-EW-C1. Topsoil is a valuable resource to be preserved for re-use in landscaping. RD-EW-C1 requires earthworks designs to avoid heavy compaction where landscape treatments are to be installed.'
    },
    {
      description: 'Prepare subgrade for topsoil placement',
      acceptanceCriteria: 'Subgrade surface ripped or scarified to minimum depth to key with topsoil layer; compacted areas loosened per RD-EW-C1 requirement to avoid heavy compaction where landscape treatments are to be installed; surface graded to design levels and drainage falls; free of rocks, debris, construction waste',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C7 / RD-EW-C1. Subsoil preparation enables root penetration and drainage. RD-EW-C1 requires earthworks designs to avoid heavy compaction in landscape areas.'
    },
    {
      description: 'Place topsoil to specified depth per PR-LS-C7',
      acceptanceCriteria: 'Topsoil placed to minimum depth as specified on drawings (typically 150 mm for grass areas, 300+ mm for planting beds); evenly spread; friable and free of large clods; not placed when wet or waterlogged; subgrade scarified before topsoil placement to key layers together',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C7. Topsoil installed on batters must be stabilised with appropriate landscape treatments. RD-EW-D1 specifies minimum 150 mm on cut faces.'
    },

    // =========================================================================
    // SEEDING (PR-LS-C6)
    // =========================================================================
    {
      description: 'Verify seed mix species, purity and viability per PR-LS-C6',
      acceptanceCriteria: 'Seed mix species and rates per drawings and PR-LS-C6; seed purity and germination certificates provided; seed current season (within expiry date); species appropriate for SA climate zone and site conditions; native species where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C6 (Hydroseeding and Direct Seeding). Seed quality directly affects establishment success.'
    },
    {
      description: 'Apply seed per PR-LS-C6 — hydroseeding or direct seeding method',
      acceptanceCriteria: 'Seed applied evenly using approved method (hydroseed or direct seed as specified in PR-LS-C6); application rate as specified; timing appropriate for species and season; seed raked or lightly covered for direct seeding; hydromulch applied as part of hydroseed mix if specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C6. Application method, rate, and timing per specification. SA provides separate specification for hydroseeding and direct seeding methods.'
    },

    // =========================================================================
    // PLANTING (PR-LS-C2)
    // =========================================================================
    {
      description: 'Excavate planting holes and prepare beds per PR-LS-C2',
      acceptanceCriteria: 'Planting holes minimum twice the width and 1.5 times the depth of root ball or container; sides of hole scarified to prevent glazing; drainage adequate; planting beds cultivated and soil ameliorants applied as specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C2. Planting hole dimensions to ensure adequate root establishment.'
    },
    {
      description: 'Plant trees, shrubs and groundcovers per PR-LS-C2 and landscape plan',
      acceptanceCriteria: 'Plants installed at correct spacing and locations per drawings; planted at same depth as in container (root collar at ground level); root ball moistened before planting; backfilled with friable topsoil; no air pockets around roots; staking installed where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'PR-LS-C2 (Planting). Species, location and spacing per approved landscape plan. Staking and guards per specification.'
    },
    {
      description: 'Provide initial watering to all plantings',
      acceptanceCriteria: 'Each plant watered thoroughly within specified hours after planting; adequate volume to saturate root zone; watering basins formed around plants where specified; water quality suitable for plant establishment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C2. Initial watering critical for plant establishment, particularly in SA\'s dry climate.'
    },
    {
      description: 'Install tree guards, stakes and plant protection as specified',
      acceptanceCriteria: 'Tree guards, stakes, ties and protection devices installed per PR-LS-C2; guards ventilated and UV-stabilised; stakes do not damage root ball; ties allow for trunk movement and growth; protection from mowing damage and herbicide spray drift',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'PR-LS-C2. Protection installed to prevent mechanical damage and promote healthy establishment.'
    },
    {
      description: 'Apply erosion control matting to seeded batters per PR-LS-C5',
      acceptanceCriteria: 'Erosion control matting type and weight per PR-LS-C5; matting anchored securely; overlaps in direction of water flow; applied over seeded surface to protect seed from erosion before germination; matting biodegradable where specified for revegetation areas',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'PR-LS-C5 (Erosion Control Matting). Protects seeded surfaces from erosion during germination and establishment period.'
    },

    // =========================================================================
    // MULCHING (PR-LS-C3)
    // =========================================================================
    {
      description: 'Apply mulch to planting beds per PR-LS-C3',
      acceptanceCriteria: 'Mulch type and depth per PR-LS-C3 specification; mulch compliant with AS 4454; kept clear of plant stems minimum 50 mm; applied after planting and initial watering; mulch does not impede surface drainage; even depth achieved across planting beds',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'AS 4454 (Composts, Soil Conditioners and Mulches)',
      notes: 'PR-LS-C3 (Mulching). Mulch suppresses weeds, retains moisture (important in SA climate), moderates soil temperature.'
    },

    // =========================================================================
    // IRRIGATION (PR-LS-C4 [VERIFY]) & TURF (PR-LS-C8 [VERIFY])
    // =========================================================================
    {
      description: 'Install irrigation system per PR-LS-C4 (if specified)',
      acceptanceCriteria: 'Irrigation system installed per PR-LS-C4 [VERIFY] design and specification; pipe, fittings and emitters as specified; pressure testing completed and passed; controller programmed for establishment watering schedule; coverage verified by operational test',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C4 [VERIFY] / PR-LS-C9 (Irrigation). Installation and testing of irrigation system if specified in design. SA provides a dedicated irrigation specification.'
    },
    {
      description: 'Lay turf per PR-LS-C8 (if specified)',
      acceptanceCriteria: 'Turf species and quality per PR-LS-C8 [VERIFY] specification; laid on prepared topsoil surface; joints staggered and butted tightly; rolled to ensure contact with soil; watered immediately after laying; turf pegged on slopes if required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'PR-LS-C8 [VERIFY] (Turf). Turfing where specified as alternative to seeding for immediate stabilisation and presentation.'
    },

    // =========================================================================
    // TREE RELOCATION (PR-LS-C9 [VERIFY])
    // =========================================================================
    {
      description: 'Relocate trees per PR-LS-C9 specialist procedure (if specified)',
      acceptanceCriteria: 'Tree relocation carried out by specialist arborist per PR-LS-C9 [VERIFY] / PR-LS-C4 (Tree and Palm Transplanting); root ball size adequate for tree caliper; tree prepared (root pruning, crown reduction) as specified; transport and replanting within specified timeframe; post-relocation support (staking, guying, watering) installed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C4 (Tree and Palm Transplanting) / PR-LS-C9 [VERIFY]. Specialist procedure requiring Principal\'s Authorised Person approval before proceeding. SA provides dedicated tree transplanting specification.'
    },

    // =========================================================================
    // ESTABLISHMENT & MAINTENANCE
    // =========================================================================
    {
      description: 'Implement watering schedule during establishment period',
      acceptanceCriteria: 'Watering frequency adequate to maintain plant health (typically more frequent in SA\'s hot, dry climate); irrigation system operational and programmed if installed; manual watering supplementing irrigation where required; watering records maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C9 (Irrigation) / PR-LS-M1 (Maintenance of Plants). Watering essential during establishment, especially over SA summer months.'
    },
    {
      description: 'Conduct weed control and maintenance during establishment per PR-LS-M1',
      acceptanceCriteria: 'Weed coverage does not exceed specified threshold; weeds removed by hand, mechanical means or approved herbicide; herbicide application does not damage planted species; dead or failed plants identified for replacement; mulch top-up where depleted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-M1 (Maintenance of Plants). Ongoing weed control and maintenance during establishment period.'
    },
    {
      description: 'Verify seed germination and assess coverage',
      acceptanceCriteria: 'Germination achieved across seeded areas within specified timeframe; minimum coverage percentage met; areas that fail to germinate reseeded per PR-LS-C6; bare patches addressed promptly to prevent erosion',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-C6. Germination assessment to confirm seeding success and identify areas requiring re-treatment.'
    },
    {
      description: 'Replace failed plantings during maintenance period',
      acceptanceCriteria: 'Dead, dying or unhealthy plants identified and replaced with same species and container size per PR-LS-S1; replacements watered and maintained as per original planting; replacement rate monitored at specified intervals',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-M1 / PR-LS-C2. Contractor responsible for plant establishment during Defects Liability Period.'
    },

    // =========================================================================
    // FINAL ACCEPTANCE & CLOSE-OUT
    // =========================================================================
    {
      description: 'Establishment period inspection — plant health and coverage assessment',
      acceptanceCriteria: 'Minimum plant survival rate achieved (as specified); grass/seed cover continuous and healthy; mulch maintained; weed coverage within limits; all plantings established and actively growing; irrigation system functional (if installed); landscape elements complete and undamaged',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-M1. Principal\'s Authorised Person to verify all acceptance criteria met at end of establishment period.'
    },
    {
      description: 'Defects liability inspection — final landscape acceptance',
      acceptanceCriteria: 'All landscape works meet specification requirements at end of Defects Liability Period; plant health and coverage sustained; irrigation system operational; no outstanding defects; all maintenance obligations fulfilled',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'PR-LS-M1. Landscape works DLP may extend beyond the Whole of Works DLP. Final inspection before handover.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All landscaping and revegetation criteria met, establishment records complete, maintenance period obligations fulfilled per PR-LS-M1',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
    }
  ]
}

// =============================================================================
// SA GEOSYNTHETICS (DIT RD-EW-S1)
// =============================================================================

const saGeosyntheticsTemplate = {
  name: 'Geosynthetics (DIT RD-EW-S1)',
  description: 'DIT Geosynthetics supply and installation per RD-EW-S1 (Supply of Geotextiles). Covers geotextiles, geogrids, and geomembranes for separation, filtration, reinforcement, and drainage applications.',
  activityType: 'environmental',
  specificationReference: 'RD-EW-S1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit geosynthetic product data sheets and test certificates',
      acceptanceCriteria: 'Product data sheets for each geosynthetic product submitted; certificate of compliance for each type of geotextile provided; all test results reported on NATA endorsed test documents per RD-EW-S1; certificates current; minimum melt temperature greater than 195 degrees C confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 3706 series (Geotextile testing), NATA endorsed',
      notes: 'RD-EW-S1. Geosynthetic material must not be placed until product compliance verified and accepted by Principal\'s Authorised Person. All test results must be on NATA endorsed test documents.'
    },
    {
      description: 'Provide bitumen retention rate (at least 28 days prior to use)',
      acceptanceCriteria: 'Bitumen retention rate submitted to Principal\'s Authorised Person at least 28 days prior to intended use; rate determined from testing per RD-EW-S1 requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-S1. SA-specific requirement — bitumen retention rate must be provided at least 28 days prior to use.'
    },
    {
      description: 'Verify geosynthetic material properties match specification',
      acceptanceCriteria: 'Geotextile properties match specified application (filtration, drainage, or separation per RD-EW-S1); product free from defects or flaws which significantly affect physical and/or filtering properties; polymer type, weight, thickness within tolerances; UV stability confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-S1. Earthworks designs may incorporate geotextile for filtration, drainage, or separation.'
    },
    {
      description: 'Verify geogrid material properties (where specified)',
      acceptanceCriteria: 'Geogrid product matches specification for tensile strength (kN/m), aperture size, junction efficiency; manufacturer certificates provided on NATA endorsed documents; installation guidelines reviewed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Manufacturer test certificate per AS 3706 series, NATA endorsed',
      notes: 'Project-specific specification supplementing RD-EW-S1. Geogrids for reinforcement applications must demonstrate specified design strength and durability properties.'
    },
    {
      description: 'Verify geomembrane material properties (where specified)',
      acceptanceCriteria: 'Geomembrane type (HDPE, LLDPE, PVC, etc.), thickness, tensile strength, puncture resistance, and permeability meet project specification; manufacturer quality certificates provided; NATA endorsed test results where applicable',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Manufacturer test certificate, NATA endorsed',
      notes: 'Project-specific specification supplementing RD-EW-S1. Geomembranes for containment applications require stringent QA.'
    },

    // =========================================================================
    // STORAGE & SITE PREPARATION
    // =========================================================================
    {
      description: 'Verify storage and handling of geosynthetic materials',
      acceptanceCriteria: 'Geotextiles stored under protective cover or wrapped with waterproof, opaque UV protective sheeting per RD-EW-S1; protected from UV damage prior to installation; protected from damage, chemicals, and fire; rolls not dragged across ground',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-S1. Geotextiles must be stored under protective cover or wrapped with waterproof, opaque UV protective sheeting to avoid UV damage.'
    },
    {
      description: 'Prepare subgrade surface for geosynthetic placement',
      acceptanceCriteria: 'Subgrade surface graded to design levels; free of sharp objects, rocks, stumps, roots and debris that could damage or puncture geosynthetic; surface firm and stable; no standing water',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 (Earthworks). Preparing the work area is prerequisite to geosynthetic placement. Principal\'s Authorised Person to verify subgrade condition.'
    },

    // =========================================================================
    // INSTALLATION
    // =========================================================================
    {
      description: 'Place geotextile on prepared surface without damage',
      acceptanceCriteria: 'Geotextile placed without puncture or tears per RD-EW-C1; unrolled smoothly without folds, wrinkles or tension; placed in contact with subgrade surface; orientation correct; no damage during placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C1. Geotextile must be placed without puncture or tears.'
    },
    {
      description: 'Verify geosynthetic overlap dimensions — minimum 500 mm',
      acceptanceCriteria: 'Adjacent panels overlapped minimum 500 mm unless otherwise specified per RD-EW-C1; overlap direction correct (upslope panel over downslope panel for slopes); no gaps between panels; overlaps secured where specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1. SA requires minimum 500 mm overlap — more conservative than some other states (300-500 mm).'
    },
    {
      description: 'Secure geosynthetic seams (sewn, welded, or anchored where specified)',
      acceptanceCriteria: 'Seaming method as specified (sewn with polymer thread, thermally bonded, or overlap-only); seam strength meets specification requirements; seaming documented; geomembrane welds tested per project specification if applicable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Seam strength test (if specified)',
      notes: 'RD-EW-S1 / project-specific specification. Sewn or welded seams required for critical applications.'
    },
    {
      description: 'Test geomembrane seam integrity (where applicable)',
      acceptanceCriteria: 'Destructive seam samples taken at specified frequency; peel strength and shear strength meet specification minima; non-destructive testing (vacuum box or air lance) completed on all field welds; trial welds at start of each shift; all test results documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ASTM D6392 (peel/shear), vacuum box test',
      notes: 'Project-specific specification. Seam testing mandatory for geomembrane containment applications. Principal\'s Authorised Person approval required before covering.'
    },
    {
      description: 'Verify no construction equipment standing or travelling directly on laid geotextile',
      acceptanceCriteria: 'Construction equipment must NOT stand or travel directly on laid geotextile per RD-EW-C1; equipment access managed to prevent damage; any tracked or wheeled plant kept off unprotected geosynthetic surface',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1. Construction equipment must NOT stand or travel directly on laid geotextile — SA-specific explicit prohibition.'
    },

    // =========================================================================
    // COVERING & COMPLETION
    // =========================================================================
    {
      description: 'Inspect geosynthetic for damage before cover placement',
      acceptanceCriteria: 'Entire geosynthetic surface inspected for tears, punctures, displacement or contamination; damaged areas repaired with patches extending minimum 300 mm beyond damage in all directions; inspection completed and documented before covering proceeds',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 / RD-EW-S1. Damage inspection before covering is critical — defects cannot be identified or repaired after cover placement. Principal\'s Authorised Person to verify.'
    },
    {
      description: 'Place cover material over geosynthetic within 48 hours',
      acceptanceCriteria: 'Geotextile covered by relevant construction materials within 48 hours of placement per RD-EW-C1; cover material placed from the geosynthetic onto already-covered area; no trafficking on exposed geosynthetic; initial lift minimum thickness as specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1. SA requires cover within 48 hours — specific timeframe to limit UV exposure.'
    },
    {
      description: 'Compact fill material over geosynthetic',
      acceptanceCriteria: 'Compaction equipment and method appropriate for fill type and proximity to geosynthetic; compaction to specified density ratio; no rutting or displacement of geosynthetic during compaction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 320 [VERIFY] (Density testing)',
      notes: 'RD-EW-C1. Fill compacted to required densities without damaging the geotextile layer.'
    },
    {
      description: 'Verify geosynthetic anchorage at edges and terminations',
      acceptanceCriteria: 'Geosynthetic anchored into anchor trenches or wrapped around per design details; anchor trench dimensions as specified; trench backfilled and compacted; no pull-out risk at edges',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1. Edge anchoring prevents geosynthetic pull-out under load.'
    },
    {
      description: 'Complete as-built geosynthetic documentation',
      acceptanceCriteria: 'As-built records showing actual geosynthetic placement including product used, roll numbers, panel layout, seam locations, repair locations, overlap widths, test certificates, and NATA endorsed test results; records stored for project handover',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-S1. Quality records including NATA endorsed test documents to be maintained as part of project documentation.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All geosynthetic material and installation criteria met, NATA endorsed test certificates complete, as-built records submitted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
    }
  ]
}

// =============================================================================
// SA REINFORCED SOIL STRUCTURES (DIT ST-RE-C1)
// =============================================================================

const saReinforcedSoilStructuresTemplate = {
  name: 'Reinforced Soil Structures (DIT ST-RE-C1)',
  description: 'DIT Reinforced Soil Structures including MSE walls and reinforced slopes per ST-RE-C1 (Reinforced Soil Structures). Covers foundation preparation, reinforcement layers, facing panels, compaction, and drainage.',
  activityType: 'environmental',
  specificationReference: 'ST-RE-C1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit RSS construction procedures — product system and method statement',
      acceptanceCriteria: 'Contractor construction methodology addresses foundation preparation, reinforcement system details, facing panel system, construction sequence, compaction methodology, drainage installation; product system approved by Principal\'s Authorised Person; method statement covers all stages of RSS construction',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Construction procedures must be submitted and accepted before RSS construction commences. Design compliant with ST-RE-D1 (Design of Reinforced Soil Structures) and AS 4678.'
    },
    {
      description: 'Submit RSS design package for review',
      acceptanceCriteria: 'Design package includes structural calculations, reinforcement layout, facing system details, drainage design, construction sequence; design compliant with ST-RE-D1 and AS 4678; minimum design life of 100 years; facade slope of 1H in 40V or flatter; setback minimum 70 mm from rigid structures',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-D1 / ST-RE-C1. Design life 100 years. Facade slope 1H in 40V or flatter. Setback 70 mm from rigid structures (e.g., bridge abutments) to account for outward movement.'
    },
    {
      description: 'Submit reinforcement material test certificates',
      acceptanceCriteria: 'Soil reinforcement (steel strips, geogrids, or geotextiles) test certificates demonstrating design tensile strength, durability (corrosion protection for steel, UV/chemical resistance for polymeric), and creep properties; certificates from accredited laboratory; NATA endorsed where applicable',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Manufacturer test certificates per relevant standards',
      notes: 'ST-RE-C1. All reinforcement materials must meet specified performance requirements for 100-year design life. Principal\'s Authorised Person approval required.'
    },
    {
      description: 'Verify facing panel/block supply conformance',
      acceptanceCriteria: 'Facing panels manufactured in accordance with ST-RE-C1 and DIT concrete specifications; compressive strength test results compliant; dimensional tolerances met; surface finish acceptable; connection hardware cast in correctly; panel identification marks correspond to erection sequence',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (Compressive strength of concrete)',
      notes: 'ST-RE-C1. Facing panel conformance verified before erection commences.'
    },
    {
      description: 'Verify fill material conformance — grading and plasticity',
      acceptanceCriteria: 'Select fill material for reinforced zone tested and compliant with ST-RE-D1 requirements — grading, plasticity, chemical properties (pH, resistivity, chloride, sulphate content for steel reinforcement durability); compaction characteristics determined; material source approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289 series (soil classification, compaction, chemical properties)',
      notes: 'ST-RE-D1 / ST-RE-C1. Backfill must comply with ST-RE-D1 requirements. Fill properties critical for reinforcement durability (especially for steel reinforcement with 100-year design life).'
    },
    {
      description: 'Submit construction sequence and methodology',
      acceptanceCriteria: 'Construction methodology addresses foundation preparation, levelling pad construction, panel erection sequence, reinforcement connection and placement, fill placement and compaction sequence, drainage installation; staging plan for multi-level walls documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Construction sequence critical for wall stability during construction.'
    },

    // =========================================================================
    // FOUNDATION PREPARATION
    // =========================================================================
    {
      description: 'Foundation preparation and inspection',
      acceptanceCriteria: 'Foundation excavated to design depth and extent; foundation material inspected and confirmed as suitable; soft or unsuitable material removed and replaced; foundation graded to design levels and falls; bearing capacity confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Foundation adequacy directly affects RSS performance. Principal\'s Authorised Person to inspect and approve foundation before proceeding.'
    },
    {
      description: 'Construct levelling pad for facing panels',
      acceptanceCriteria: 'Levelling pad (concrete or compacted crushed rock as specified) constructed to design alignment, level and width; surface tolerance within specified limits; pad provides stable, level base for panel erection',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (alignment, level)',
      notes: 'ST-RE-C1. Levelling pad alignment controls final wall alignment.'
    },

    // =========================================================================
    // PANEL ERECTION & FIRST LAYER
    // =========================================================================
    {
      description: 'First layer placement and inspection — first row of facing panels erected',
      acceptanceCriteria: 'First row of panels placed in accordance with manufacturer recommendations and ST-RE-C1; panels plumb, aligned and at correct spacing; temporary bracing installed and secure; vertical and horizontal alignment within tolerances; connection points accessible for reinforcement attachment',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (alignment, plumb)',
      notes: 'ST-RE-C1. First row sets alignment for entire wall. Principal\'s Authorised Person approval required before proceeding with subsequent layers.'
    },

    {
      description: 'Verify panel temporary bracing and support',
      acceptanceCriteria: 'Temporary bracing securely connected; bracing resists wind and construction loads; panels supported until fill is placed and compacted to a level that provides permanent support; bracing removal sequence documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Panels temporarily and securely supported during and after erection until adjacent fill material placed and compacted.'
    },

    // =========================================================================
    // REINFORCEMENT & FILL PLACEMENT
    // =========================================================================
    {
      description: 'Connect reinforcement to facing panels',
      acceptanceCriteria: 'Reinforcing elements connected to wall panels in accordance with design and ST-RE-C1; connection type, bolts or clips tightened to specification; connection spacing per approved drawings; geogrid/strip certificates match submitted documentation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Reinforcing elements connected to wall panels in accordance with the design. Principal\'s Authorised Person to verify connections.'
    },
    {
      description: 'Place reinforcement layers at specified levels — length, spacing, connection to facing',
      acceptanceCriteria: 'Reinforcing elements placed at required level and position directly on top of compacted fill; reinforcement free of twists, kinks, sags or deviations; reinforcement length as per design; spacing between layers as specified; orientation correct (machine direction for geogrids)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Any twists, kinks, sags or deviations must be removed prior to placement of fill on reinforcing.'
    },
    {
      description: 'Place select fill in reinforced zone',
      acceptanceCriteria: 'Fill placed in uniform layers not exceeding specified lift thickness; placed from reinforcement onto already-covered area to prevent displacement; no end-dumping onto reinforcement; no trafficking on exposed reinforcement until protected by minimum 150 mm of fill',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Fill placement must not displace or damage reinforcement. No traffic on reinforcement until protected by minimum 150 mm fill.'
    },
    {
      description: 'Compact fill per layer — no heavy compaction within 1 m of face',
      acceptanceCriteria: 'Compaction equipment suitable for proximity to facing panels — light equipment within 1 m of face per ST-RE-C1; density ratio meets specification; moisture content within optimum range; no rutting of reinforcement; TP 320 [VERIFY] density testing at specified frequency',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 320 [VERIFY] (Density testing)',
      notes: 'ST-RE-C1. No heavy compaction equipment within 1 m of wall face to prevent panel displacement. Light compaction in face zone.'
    },

    {
      description: 'Verify no traffic or equipment on unprotected reinforcement',
      acceptanceCriteria: 'Traffic on reinforcing elements not allowed until reinforcement protected by minimum 150 mm layer of fill material; construction equipment routes planned to avoid running over unprotected reinforcement; site controls in place to enforce restriction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Traffic and work on reinforcing elements is not allowed until reinforcement protected by minimum 150 mm of fill.'
    },

    // =========================================================================
    // ALIGNMENT & DRAINAGE
    // =========================================================================
    {
      description: 'Check facing alignment and verticality after each lift',
      acceptanceCriteria: 'Panel face alignment (horizontal and vertical) within specified tolerances per ST-RE-C1; facade slope 1H in 40V or flatter; steps between adjacent panels within limits; cumulative deviation within overall tolerance; survey records maintained per lift',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (alignment, batter, level)',
      notes: 'ST-RE-C1 / ST-RE-D1. Facade slope 1H in 40V or flatter. Alignment checked progressively as wall is built up.'
    },
    {
      description: 'Install drainage behind structure — filter material and outlets',
      acceptanceCriteria: 'Drainage aggregate or geocomposite drain placed behind facing panels as designed; drainage layer continuous and connected to outlets; filter material prevents fill migration into drainage layer; falls to drainage outlet verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-RE-C1. Drainage essential to prevent hydrostatic pressure on wall.'
    },
    {
      description: 'Place retained fill behind reinforced zone',
      acceptanceCriteria: 'Retained fill (general fill) placed and compacted behind reinforced zone to design levels; compaction to specification; fill level kept approximately equal to reinforced zone fill level during construction to prevent differential loading',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 320 [VERIFY] (Density testing)',
      notes: 'ST-RE-C1. Differential fill levels between reinforced and retained zones can cause instability during construction.'
    },

    // =========================================================================
    // LEVEL SURVEYS & COMPLETION
    // =========================================================================
    {
      description: 'Conduct level surveys per lift',
      acceptanceCriteria: 'Level surveys completed at each reinforcement layer confirming design levels achieved; survey data recorded and compared to design; deviations within tolerance; corrective actions implemented for out-of-tolerance areas before proceeding',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (level per lift)',
      notes: 'ST-RE-C1. Progressive survey monitoring ensures wall is built to design geometry.'
    },
    {
      description: 'Install capping/coping on top of wall',
      acceptanceCriteria: 'Coping units or cast-in-place capping beam installed per design; aligned and level; secured to top panels; drainage falls correct; finish acceptable; protects top of wall from water infiltration',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-RE-C1. Coping provides finish and protects top of wall from infiltration.'
    },
    {
      description: 'Install safety fence at top of wall (where required)',
      acceptanceCriteria: 'Safety fence installed where fall hazard exists at top of RSS; fence height and type per design and safety requirements; secured to coping or top of wall; compliant with RD-BF-C4 (Fencing) where applicable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1 / RD-BF-C4. Safety fence required where fall hazard exists at top of reinforced soil structure.'
    },
    {
      description: 'Install joint material and surface treatment between panels',
      acceptanceCriteria: 'Joint strips, pads or geotextile filter fabric installed between panels per design; prevents loss of fill material through joints; allows for thermal movement; material as specified by RSS system designer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-RE-C1. Joint treatment prevents fines loss and ensures aesthetic finish.'
    },
    {
      description: 'Final survey and as-built documentation',
      acceptanceCriteria: 'Final survey of wall face alignment (horizontal and vertical); as-built drawings prepared showing actual reinforcement lengths, levels, panel layout, drainage locations; all QA records compiled including test certificates',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (final wall geometry)',
      notes: 'ST-RE-C1. As-built records required for maintenance and future reference. Principal\'s Authorised Person to attend final survey.'
    },

    // =========================================================================
    // FINAL ACCEPTANCE & CLOSE-OUT
    // =========================================================================
    {
      description: 'Final RSS inspection and lot sign-off',
      acceptanceCriteria: 'Wall face alignment within specified tolerances; no visible damage, cracking or displacement; drainage functioning; backfill complete; all QA documentation submitted and accepted; structure complies with approved design; facade slope 1H in 40V or flatter confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-RE-C1. Principal\'s Authorised Person acceptance required prior to handover.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All RSS criteria met, survey data acceptable, QA documentation package complete, design life requirements verified',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
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
      stateSpec: 'DIT',
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
  console.log(' SA (DIT) ITP Template Seeder - Environmental')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(saESCTemplate)
    await seedTemplate(saLandscapingTemplate)
    await seedTemplate(saGeosyntheticsTemplate)
    await seedTemplate(saReinforcedSoilStructuresTemplate)

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
