/**
 * Seed Script: VIC (VicRoads) ITP Templates - Environmental
 *
 * Creates global ITP templates for VIC environmental activities.
 * Templates: ESC (Sec 176/177), Landscaping (Sec 720), Geosynthetics (Sec 210),
 *            Reinforced Soil Structures (Sec 682)
 *
 * Run with: node scripts/seed-itp-templates-vic-environmental.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// =============================================================================
// VIC EROSION & SEDIMENT CONTROL (VicRoads Sec 176/177)
// =============================================================================

const vicESCTemplate = {
  name: 'Erosion & Sediment Control',
  description: 'VIC VicRoads erosion and sediment control including ESCP preparation, ESC device installation, weekly and rain event inspections, water quality monitoring, dust control, progressive stabilisation, and decommissioning per Section 176 (Minor) and Section 177 (Major), supplemented by EPA Victoria Publication 275 and IECA BPESC',
  activityType: 'environmental',
  specificationReference: 'Sec 176/177',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK PLANNING
    // =========================================================================
    {
      description: 'Submit Erosion and Sediment Control Plan (ESCP) for Superintendent review',
      acceptanceCriteria: 'ESCP addresses all site-specific erosion risks; identifies control measures for each stage of works; includes site plan showing drainage paths, sensitive receivers, waterways; addresses staging of ESC installation relative to earthworks',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176/177. ESCP is a component of the overall Environmental Management Plan (EMP). Work must not commence until ESCP is reviewed and accepted by Superintendent.'
    },
    {
      description: 'Verify ESC personnel competency and training records',
      acceptanceCriteria: 'All personnel directly involved in installing and maintaining ESC measures hold demonstrated competence or have completed a nationally accredited training course in erosion and sediment control (Green Card or equivalent)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176. Training must be completed prior to commencement of works onsite.'
    },
    {
      description: 'Confirm sensitive environmental receivers identified and mapped',
      acceptanceCriteria: 'All waterways, drainage lines, vegetation to be retained, and neighbouring properties identified on ESCP site plan; buffer distances documented (minimum 10 m from waterways for stockpiles per Section 176)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176. Soil stockpiles shall be located no less than 10 metres from waterways.'
    },
    {
      description: 'Confirm ESC materials and products are on site prior to earthworks commencing',
      acceptanceCriteria: 'Silt fence fabric, star pickets/posts, sediment basin materials, rock check dam materials, coir logs, stabilised site entry materials all available on site and compliant with specifications',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 176/177. ESC measures must be installed before ground disturbance commences.'
    },
    {
      description: 'Establish baseline turbidity/water quality at receiving waterways (if applicable)',
      acceptanceCriteria: 'Baseline turbidity readings taken at upstream and downstream monitoring points as specified in ESCP; readings documented with date, time, location, and instrument calibration records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Turbidity meter (NTU)',
      notes: 'Section 177. Required for works near sensitive waterways. EPA Victoria discharge limits apply.'
    },

    // =========================================================================
    // ESC INSTALLATION
    // =========================================================================
    {
      description: 'Install silt fence to ESCP locations and details',
      acceptanceCriteria: 'Geotextile fabric minimum 450 mm buried in trench; supported by star pickets or timber posts at maximum 2 m centres; maximum contributing slope length 60 m for sheet flow only; fabric returns at ends to prevent bypass; joins overlapped minimum 150 mm and secured',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA Publication 275, IECA BPESC. Silt fences only for sheet flow -- not to be placed across concentrated flow paths.'
    },
    {
      description: 'Construct sediment basin(s) to ESCP design',
      acceptanceCriteria: 'Basin sized per IECA BPESC guidelines (Type A, B, or D/F as specified); volumetric capacity as designed; inlet and outlet structures installed; emergency spillway provided; basin operational before contributing catchment is disturbed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA Publication 275, IECA BPESC. Sediment basins required where catchment area exceeds 2500 m2. Basin must be desilted when capacity reduced by one-third.'
    },
    {
      description: 'Install rock check dams in drainage lines',
      acceptanceCriteria: 'Rock size and grading per ESCP design; check dam height maximum 450 mm above invert; spacing such that toe of upstream dam is at crest level of downstream dam; sides keyed into channel banks minimum 300 mm; geotextile underliner where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA Publication 275. Check dams slow concentrated flow to allow sediment deposition.'
    },
    {
      description: 'Construct stabilised site entry/exit point',
      acceptanceCriteria: 'Minimum 8 m long, 3.5 m wide (or full vehicle width); 150 mm minimum depth of 40-75 mm clean crushed rock over geotextile; drainage directed to sediment control device; location as per ESCP',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA Publication 275. All site vehicles to use stabilised entry/exit to prevent tracking of mud onto public roads. Must be maintained for duration of works.'
    },
    {
      description: 'Install temporary diversion drains / catch drains',
      acceptanceCriteria: 'Diversion drains installed upslope of works area to divert clean water around disturbed areas; minimum grade 1%; lined where flow velocity exceeds erosive threshold for soil type; directed to stable outlet point',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA Publication 275, IECA BPESC. Separating clean and dirty water is a fundamental ESC principle.'
    },
    {
      description: 'Apply temporary stabilisation to stockpiles and exposed surfaces',
      acceptanceCriteria: 'Topsoil and spoil stockpiles covered or seeded if inactive for more than 14 days; exposed cut and fill batters stabilised with erosion control blankets, hydromulch or temporary seeding within timeframes specified in ESCP',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 176/177. Limit exposed site areas and limit the time areas are exposed.'
    },
    {
      description: 'Verify ESC measures installed and functional before ground disturbance commences',
      acceptanceCriteria: 'All perimeter and downslope ESC measures installed, inspected and documented as functional; photographic record taken; sign-off by ESC-trained personnel',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176/177. ESC controls must be in place before any clearing, grubbing or earthworks.'
    },

    // =========================================================================
    // MONITORING & MAINTENANCE
    // =========================================================================
    {
      description: 'Conduct routine weekly ESC inspection',
      acceptanceCriteria: 'All ESC measures inspected at least once per week; deficiencies recorded on standard ESC inspection checklist; photographic record maintained; rectification actions noted and completed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176. Contractor must inspect all erosion and sedimentation control works at least once per week.'
    },
    {
      description: 'Conduct rain event ESC inspection',
      acceptanceCriteria: 'Additional inspections conducted within 1 hour of rain commencement during working hours; every 4 hours for continuous rain during working hours; within 12 hours of rain event outside working hours; when runoff is observed leaving the site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176. Specific inspection frequency triggered by rainfall events.'
    },
    {
      description: 'Repair and maintain silt fences after rain events',
      acceptanceCriteria: 'Sediment removed from behind silt fence when accumulation reaches 50% of fence height; damaged or collapsed sections replaced immediately; fabric integrity verified; fence re-tensioned and posts re-secured as required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA Publication 275, IECA BPESC. Silt fences must be maintained to remain functional.'
    },
    {
      description: 'Desilt sediment basins when capacity reduced',
      acceptanceCriteria: 'Sediment removed from basin when accumulated sediment reduces capacity by one-third; removed sediment placed in approved disposal area; basin re-established to design capacity; outlet structure checked and cleaned',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'EPA Publication 275. Sediment basins require regular maintenance to remain effective.'
    },
    {
      description: 'Rectify ESC deficiencies within required timeframe',
      acceptanceCriteria: 'All defects and deficiencies in control measures rectified immediately upon identification; control measures cleaned, repaired and augmented as required to ensure effective control',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176. If Contractor does not take action within 7 days of non-compliance report, Superintendent may arrange remedial action and deduct costs from monies due to Contractor.'
    },
    {
      description: 'Monitor discharge water quality (if discharging offsite)',
      acceptanceCriteria: 'Turbidity readings within EPA Victoria discharge limits at monitoring points; pH within acceptable range (6.5-8.5); no visible oil, grease or floating debris in discharge; records maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Turbidity meter (NTU), pH meter',
      notes: 'Section 176/177, EPA Victoria ERS. Required where site runoff discharges to waterways or stormwater system.'
    },
    {
      description: 'Maintain dust control measures',
      acceptanceCriteria: 'Dust from road construction activities does not create hazard or nuisance to public; water carts operating as needed; emissions of visible smoke from plant and equipment for periods no greater than 10 consecutive seconds',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176. Air quality provisions for construction sites.'
    },

    // =========================================================================
    // DECOMMISSIONING
    // =========================================================================
    {
      description: 'Progressive site stabilisation and ESC removal',
      acceptanceCriteria: 'Completed areas permanently stabilised (topsoiled, seeded, or paved) before temporary ESC measures removed; removal staged to maintain protection of downstream areas; ESC materials removed from site',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 176/177. ESC measures remain in place until permanent stabilisation achieved.'
    },
    {
      description: 'Final ESC decommissioning and site handover',
      acceptanceCriteria: 'All temporary ESC measures removed; sediment basins decommissioned and rehabilitated or converted to permanent features as designed; all disturbed areas permanently stabilised; final ESC inspection completed and documented',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 176/177. Part of practical completion process. Superintendent to verify all ESC measures appropriately decommissioned.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All ESC criteria met, inspection and monitoring records complete, decommissioning verified',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent'
    }
  ]
}

// =============================================================================
// VIC LANDSCAPING & REVEGETATION (VicRoads Sec 720)
// =============================================================================

const vicLandscapingTemplate = {
  name: 'Landscaping & Revegetation',
  description: 'VIC VicRoads landscaping and revegetation works including topsoil management, soil amelioration, planting, seeding, mulching, establishment watering, weed control, and maintenance per Section 720 (Landscape Works), supplemented by AS 4419, AS 4454, and AS 2303',
  activityType: 'environmental',
  specificationReference: 'Sec 720',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit landscape works plan and plant schedule for review',
      acceptanceCriteria: 'Landscape plan shows all areas to be planted, seeded, mulched; species schedule matches drawings; container sizes, quantities and spacing confirmed; sourcing of plant material identified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Plan must be submitted and accepted by Superintendent before landscape works commence.'
    },
    {
      description: 'Submit weed management program',
      acceptanceCriteria: 'Weed control program documented to deplete potential weed seed bank within topsoil to be used in planting beds; herbicide types and application rates specified; timing of pre-treatment documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Weed control shall be programmed and implemented to deplete the potential weed seed bank within topsoil.'
    },
    {
      description: 'Verify topsoil source and quality',
      acceptanceCriteria: 'Topsoil compliant with Section 720 requirements and AS 4419; free of declared noxious weeds, contaminants, and debris; organic content, pH, nutrient levels, salinity within specified limits; test results from supplier provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 4419 (Soils for Landscaping and Garden Use)',
      notes: 'Section 720. VicRoads 720 topsoil is a specification-compliant sandy loam. Imported topsoil must meet Section 720 material requirements.'
    },
    {
      description: 'Verify plant stock quality and species compliance',
      acceptanceCriteria: 'Plant stock compliant with AS 2303 where applicable; species, cultivar, container size match schedule; plants healthy, free of disease and pests; root system well-developed and not root-bound; plants hardened off for site conditions',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2303 (Tree Stock for Landscape Use)',
      notes: 'Section 720. Plants to be inspected on delivery before planting commences.'
    },

    // =========================================================================
    // SITE PREPARATION
    // =========================================================================
    {
      description: 'Strip and stockpile topsoil from cleared areas',
      acceptanceCriteria: 'Topsoil stripped to specified depth before earthworks; stockpiled separately from subsoil; stockpile height maximum 2 m; stockpile located minimum 10 m from waterways; seeded or covered if stored more than 14 days',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 201/720. Topsoil is a valuable resource to be preserved for re-use in landscaping.'
    },
    {
      description: 'Prepare subsoil/subgrade for topsoil placement',
      acceptanceCriteria: 'Subgrade surface ripped or scarified to minimum 75 mm depth to key with topsoil layer; surface graded to design levels and drainage falls; free of rocks, debris, construction waste; compacted areas loosened',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Subsoil preparation enables root penetration and drainage.'
    },
    {
      description: 'Place topsoil to specified depth',
      acceptanceCriteria: 'Topsoil placed to minimum depth as specified on drawings (typically 100-150 mm for grass areas, 300-450 mm for planting beds); evenly spread; friable and free of clods greater than 50 mm; not placed when wet or waterlogged',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Planting holes backfilled with friable topsoil free of debris, rocks and clods greater than 50 mm in diameter.'
    },
    {
      description: 'Apply soil ameliorants and fertiliser as specified',
      acceptanceCriteria: 'Soil ameliorants (gypsum, lime, organic matter) applied at rates specified on drawings or in specification; fertiliser type and rate per specification; incorporated into topsoil by cultivation; even distribution achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Soil preparation to support plant establishment.'
    },

    // =========================================================================
    // PLANTING
    // =========================================================================
    {
      description: 'Excavate planting holes to specified dimensions',
      acceptanceCriteria: 'Planting holes minimum twice the width and 1.5 times the depth of root ball or container; sides of hole scarified to prevent glazing; drainage adequate (not water-holding)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Planting hole dimensions to ensure adequate root establishment.'
    },
    {
      description: 'Plant trees and shrubs per landscape plan',
      acceptanceCriteria: 'Plants installed at correct spacing and locations per drawings; planted at same depth as in container (root collar at ground level); root ball moistened before planting; backfilled with friable topsoil; no air pockets around roots',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 720. Species, location and spacing per approved landscape plan.'
    },
    {
      description: 'Provide initial watering to all plantings',
      acceptanceCriteria: 'Each plant saturated within 8 hours after planting; cells and tubes irrigated with minimum 3 litres of water per plant; larger containers irrigated with water volume greater than container size; watering basins formed around plants where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Contractor shall saturate each plant within 8 hours after planting.'
    },
    {
      description: 'Install tree guards, stakes and plant protection as specified',
      acceptanceCriteria: 'Tree guards, stakes, ties and protection devices installed per specification; guards ventilated and UV-stabilised; stakes do not damage root ball; ties allow for trunk movement and growth',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 720. Protection from damage, mowing, herbicide spray drift.'
    },

    // =========================================================================
    // SEEDING & MULCHING
    // =========================================================================
    {
      description: 'Seed grass and groundcover areas per specification',
      acceptanceCriteria: 'Seed mix species and rates per drawings and specification; seed applied evenly using approved method (broadcast, hydroseed, drill); seed raked or lightly covered; areas to be seeded include all disturbed areas and areas indicated on drawings',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Contractor shall seed grass to all areas indicated to be grassed on the Drawings and all areas disturbed by the Contractor.'
    },
    {
      description: 'Verify seed germination within specified timeframe',
      acceptanceCriteria: 'Germination achieved across grassed areas within 8 weeks (except during December to March hot/dry period); areas that fail to germinate shall be reseeded with specified grass seed mix',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. If germination not achieved within 8 weeks (except Dec-Mar), area shall be reseeded.'
    },
    {
      description: 'Apply mulch to planting beds',
      acceptanceCriteria: 'Mulch type and depth per specification (typically 75-100 mm); mulch compliant with AS 4454; kept clear of plant stems minimum 50 mm; applied after planting and initial watering; mulch does not impede surface drainage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'AS 4454 (Composts, Soil Conditioners and Mulches)',
      notes: 'Section 720. Mulch suppresses weeds, retains moisture, moderates soil temperature.'
    },
    {
      description: 'Conduct first mow of grassed areas',
      acceptanceCriteria: 'First cut when at least 50% of grassing area has grown to minimum 75 mm and maximum 150 mm height; mow to minimum height of 75 mm; less than one-third of grass height removed in first cut',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Specific first mow criteria to promote healthy grass establishment.'
    },

    // =========================================================================
    // ESTABLISHMENT & MAINTENANCE
    // =========================================================================
    {
      description: 'Implement watering regime during establishment period',
      acceptanceCriteria: 'Watering schedule per specification or ESCP; frequency adequate to maintain plant health (typically 2-3 times per week in establishment, reducing over time); irrigation system functional (if installed); water quality suitable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Watering essential during establishment, especially over summer months.'
    },
    {
      description: 'Conduct weed control during establishment period',
      acceptanceCriteria: 'Weed coverage does not exceed specified threshold (typically 10-15% cover); weeds removed by hand, mechanical means or approved herbicide application; herbicide application does not damage planted species',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Weed control is ongoing during maintenance/establishment period.'
    },
    {
      description: 'Replace failed plantings during maintenance period',
      acceptanceCriteria: 'Dead, dying or unhealthy plants identified and replaced with same species and container size; replacements watered and maintained as per original planting; replacement rate typically monitored at 6-month intervals',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Contractor responsible for plant establishment during Defects Liability Period.'
    },
    {
      description: 'Conduct landscape maintenance during Defects Liability Period',
      acceptanceCriteria: 'Landscape maintenance tasks per specification including mowing, weeding, watering, mulch top-up, pest/disease management, pruning, litter removal; tasks documented on maintenance schedule',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Landscape maintenance shall begin prior to Practical Completion and continue until completion of Defects Liability Period for landscape works.'
    },

    // =========================================================================
    // FINAL ACCEPTANCE & CLOSE-OUT
    // =========================================================================
    {
      description: 'Final landscape inspection and practical completion',
      acceptanceCriteria: 'Minimum plant survival rate achieved (typically 85-90%); grass cover continuous and healthy; mulch maintained; weed coverage within limits; all plantings established and actively growing; landscape elements complete and undamaged',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 720. Landscape works Defects Liability Period may be separate from and extend beyond the Whole of Works DLP. Superintendent to verify all acceptance criteria met.'
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
      notes: 'Final lot approval by Superintendent'
    }
  ]
}

// =============================================================================
// VIC GEOSYNTHETICS (VicRoads Sec 210)
// =============================================================================

const vicGeosyntheticsTemplate = {
  name: 'Geosynthetics (Geotextiles, Geogrids, Geomembranes)',
  description: 'VIC VicRoads geosynthetics installation including geotextiles for separation/filtration (Section 210), geogrids for reinforcement, and geomembranes for containment, covering material compliance, subgrade preparation, placement, seaming, cover material placement, compaction, and as-built documentation per Section 210 and AS 3706 series',
  activityType: 'environmental',
  specificationReference: 'Sec 210',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit geosynthetic material data sheets and test certificates',
      acceptanceCriteria: 'Product data sheets for each geosynthetic product submitted; manufacturer test certificates demonstrating compliance with Section 210 property requirements for specified class; certificates current (within 12 months)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 3706 series (Geotextile testing)',
      notes: 'Section 210. Geosynthetic material must not be placed until product compliance verified and accepted by Superintendent.'
    },
    {
      description: 'Verify geotextile class matches specification requirements',
      acceptanceCriteria: 'Geotextile robustness class (A, B, C or D) matches specification for each application; UV stability confirmed; polymer type (polypropylene or polyester) as specified; fabric weight and thickness within tolerances',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Classes range from Class A (moderately robust, 85-230 microns) through to Class D (extremely robust). Must be UV stable.'
    },
    {
      description: 'Verify geogrid material properties (where specified)',
      acceptanceCriteria: 'Geogrid product matches specification for tensile strength (kN/m), aperture size, junction efficiency; manufacturer certificates provided; installation guidelines reviewed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Manufacturer test certificate per AS 3706 series',
      notes: 'Project-specific specification supplementing Section 210. Geogrids for reinforcement applications must demonstrate specified design strength and durability properties.'
    },
    {
      description: 'Verify geomembrane material properties (where specified)',
      acceptanceCriteria: 'Geomembrane type (HDPE, LLDPE, PVC, etc.), thickness, tensile strength, puncture resistance, and permeability meet specification; manufacturer quality certificates provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Manufacturer test certificate',
      notes: 'Project-specific specification supplementing Section 210. Geomembranes for containment applications require stringent QA.'
    },

    // =========================================================================
    // SITE PREPARATION
    // =========================================================================
    {
      description: 'Prepare subgrade surface for geosynthetic placement',
      acceptanceCriteria: 'Subgrade surface graded to design levels; free of sharp objects, rocks greater than 25 mm, stumps, roots and debris that could damage geosynthetic; surface firm and stable; no standing water',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Preparing the work area is prerequisite to geosynthetic placement. Superintendent to verify subgrade condition.'
    },
    {
      description: 'Verify storage and handling of geosynthetic materials',
      acceptanceCriteria: 'Materials stored off ground on pallets or racks; protected from UV exposure (covered or stored indoors if stored more than 14 days); protected from damage, chemicals, and fire; rolls not dragged across ground',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Geosynthetics are UV-sensitive and can be damaged by improper handling.'
    },
    {
      description: 'Mark out geosynthetic layout on prepared subgrade',
      acceptanceCriteria: 'Layout marked showing roll placement direction, overlap locations, and anchor/seam locations; layout matches design drawings; allows for correct overlap direction (upslope over downslope)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Layout planning prevents material waste and ensures correct overlaps.'
    },

    // =========================================================================
    // INSTALLATION
    // =========================================================================
    {
      description: 'Unroll and place geotextile on prepared surface',
      acceptanceCriteria: 'Geotextile unrolled smoothly without folds, wrinkles or tension; placed in contact with subgrade surface; orientation correct (machine direction as specified); no damage during placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 210. Geotextile placed by unrolling onto prepared subgrade without dragging.'
    },
    {
      description: 'Verify geotextile overlap dimensions',
      acceptanceCriteria: 'Adjacent panels overlapped minimum as specified -- typically 300 mm for separation, 450 mm for soft ground; overlap direction correct (upslope panel over downslope panel for slopes); no gaps between panels',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Overlapped seams per specification requirements. Superintendent to verify overlap dimensions.'
    },
    {
      description: 'Secure geotextile seams (sewn or welded, where specified)',
      acceptanceCriteria: 'Seaming method as specified (sewn with polymer thread, thermally bonded, or overlap-only); sewn seams with minimum specified stitch density; seam strength meets specification requirements; seaming documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Seam strength test (if specified)',
      notes: 'Section 210. Sewn or welded seams required for critical applications.'
    },
    {
      description: 'Place geogrid reinforcement at specified levels (where applicable)',
      acceptanceCriteria: 'Geogrid placed at design elevation and orientation; tensioned to remove slack; connected to facing elements per design (if MSE wall application); overlap or mechanical connection at panel junctions per manufacturer recommendation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Project-specific specification. Geogrid orientation (machine vs cross-machine direction) is critical for reinforcement applications. Superintendent to verify placement.'
    },
    {
      description: 'Place and weld geomembrane panels (where applicable)',
      acceptanceCriteria: 'Geomembrane panels placed with specified overlap; welded using approved method (hot wedge or extrusion); trial welds completed at start of each shift and after breaks exceeding 30 minutes; welds tested per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Trial weld peel and shear test, air pressure test on dual-track welds',
      notes: 'Project-specific specification. Geomembrane seam integrity is critical for containment applications. Superintendent approval required before proceeding.'
    },
    {
      description: 'Inspect geosynthetic for damage before cover placement',
      acceptanceCriteria: 'Entire geosynthetic surface inspected for tears, punctures, displacement or contamination; damaged areas repaired with patches extending minimum 300 mm beyond damage in all directions; no vehicles or equipment directly on unprotected geosynthetic',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Damage inspection before covering is critical -- defects cannot be identified or repaired after cover placement.'
    },
    {
      description: 'Place cover material over geosynthetic',
      acceptanceCriteria: 'Cover material (common fill, permeable fill, or crushed rock as specified) placed from the geosynthetic onto the already-covered area; no trafficking on exposed geosynthetic; initial lift minimum 150 mm compacted thickness; equipment does not operate directly on geosynthetic; permeable fill for filtration applications to be clean sand or gravel under 19 mm with minimum permeability of 10^-2 cm/sec when compacted',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Backfill placed without damaging geotextile layer. Permeable filling must be clean sand or gravel under 19 mm with adequate permeability.'
    },

    // =========================================================================
    // POST-INSTALLATION
    // =========================================================================
    {
      description: 'Compact fill material over geosynthetic',
      acceptanceCriteria: 'Compaction equipment and method appropriate for fill type and proximity to geosynthetic; compaction to specified density ratio; no rutting or displacement of geosynthetic during compaction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 (Density Ratio and Moisture Ratio Lot Characteristics)',
      notes: 'Section 210/204. Backfilled to required densities without damaging the geotextile layer.'
    },
    {
      description: 'Test geomembrane seam integrity (where applicable)',
      acceptanceCriteria: 'Destructive seam samples taken at specified frequency; peel strength and shear strength meet specification minima; non-destructive testing (vacuum box or air lance) completed on all field welds; all test results documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ASTM D6392 (peel/shear), vacuum box test',
      notes: 'Project-specific specification. Seam testing is mandatory for geomembrane containment applications. Superintendent approval required before covering.'
    },
    {
      description: 'Verify geosynthetic anchorage at edges and terminations',
      acceptanceCriteria: 'Geosynthetic anchored into anchor trenches or wrapped around per design details; anchor trench dimensions as specified; trench backfilled and compacted; no pull-out risk at edges',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Edge anchoring prevents geosynthetic pull-out under load.'
    },
    {
      description: 'Complete as-built geosynthetic documentation',
      acceptanceCriteria: 'As-built records showing actual geosynthetic placement including product used, roll numbers, panel layout, seam locations, repair locations, overlap widths, and test results; records stored for project handover',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 210. Quality records to be maintained as part of project documentation for Superintendent review.'
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
      notes: 'Final lot approval by Superintendent'
    }
  ]
}

// =============================================================================
// VIC REINFORCED SOIL STRUCTURES (VicRoads Sec 682)
// =============================================================================

const vicReinforcedSoilStructuresTemplate = {
  name: 'Reinforced Soil Structures (RSS / MSE Walls)',
  description: 'VIC VicRoads reinforced soil structure construction including MSE walls with precast concrete panel facing, design submissions, QMS, material compliance, foundation preparation, panel erection, reinforcement connection, fill placement and compaction, drainage, survey monitoring, coping, and as-built documentation per Section 682 and BTN 009, aligned with AS 5100 and AS 4678',
  activityType: 'environmental',
  specificationReference: 'Sec 682',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit RSS design package for Superintendent review',
      acceptanceCriteria: 'Contractor-designed RSS package includes structural calculations, reinforcement layout, facing system details, drainage design, construction sequence; design compliant with AS 5100 and Section 682; design life 100 years; design by suitably qualified engineer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Contractor shall design the RSS and prepare a specification and drawings for manufacture and construction. Design life of 100 years. Superintendent approval required before construction.'
    },
    {
      description: 'Submit Quality Management System documentation',
      acceptanceCriteria: 'QMS in place which ensures compliance with Section 682 performance requirements; includes ITP, material testing schedule, construction procedures, non-conformance procedures',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Contractor shall have a Quality Management System ensuring compliance with performance requirements.'
    },
    {
      description: 'Submit reinforcement material test certificates',
      acceptanceCriteria: 'Soil reinforcement (steel strips, geogrids, or geotextiles) test certificates demonstrating design tensile strength, durability (corrosion protection for steel, UV/chemical resistance for polymeric), and creep properties; certificates from accredited laboratory',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Manufacturer test certificates per relevant standards',
      notes: 'Section 682. All reinforcement materials must meet specified performance requirements for 100-year design life. Superintendent approval required.'
    },
    {
      description: 'Submit precast facing panel production QA records',
      acceptanceCriteria: 'Facing panels manufactured in accordance with Sections 610, 611 and 620; concrete mix design approved; compressive strength test results compliant; dimensional tolerances met per BTN 009; surface finish acceptable; connection hardware cast in correctly',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (Compressive strength of concrete)',
      notes: 'Section 682, BTN 009, Section 620. Compliance with BTN 009 is mandatory. RC panels to comply with AS 5100 together with Sections 610, 611 and 620.'
    },
    {
      description: 'Verify select fill material properties',
      acceptanceCriteria: 'Select fill material for reinforced zone tested and compliant with Section 682 requirements -- grading, plasticity, chemical properties (pH, resistivity, chloride, sulphate content for steel reinforcement durability); compaction characteristics determined',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289 series (soil classification, compaction, chemical properties)',
      notes: 'Section 682. Fill properties critical for reinforcement durability (especially for steel reinforcement with 100-year design life).'
    },
    {
      description: 'Submit construction sequence and methodology',
      acceptanceCriteria: 'Construction methodology addresses foundation preparation, levelling pad construction, panel erection sequence, reinforcement connection and placement, fill placement and compaction sequence, drainage installation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Construction sequence critical for wall stability during construction.'
    },

    // =========================================================================
    // FOUNDATION PREPARATION
    // =========================================================================
    {
      description: 'Excavate and prepare foundation to design levels',
      acceptanceCriteria: 'Foundation excavated to design depth and extent; foundation material inspected and confirmed as suitable; soft or unsuitable material removed and replaced; foundation graded to design levels and falls',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Foundation adequacy directly affects RSS performance. Superintendent to inspect foundation.'
    },
    {
      description: 'Construct levelling pad for facing panels',
      acceptanceCriteria: 'Levelling pad (concrete or compacted crushed rock as specified) constructed to design alignment, level and width; surface tolerance within specified limits; pad provides stable, level base for panel erection',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (alignment, level)',
      notes: 'Section 682. Levelling pad alignment controls final wall alignment. Superintendent approval required before panel erection.'
    },
    {
      description: 'Install foundation drainage system',
      acceptanceCriteria: 'Drainage blanket or pipe drainage system behind wall base installed per design; connects to outlet system; filter material or geotextile wrapping as specified; falls to drainage outlet verified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Drainage prevents hydrostatic pressure build-up behind wall.'
    },

    // =========================================================================
    // PANEL ERECTION
    // =========================================================================
    {
      description: 'Erect first row of facing panels on levelling pad',
      acceptanceCriteria: 'Panels placed in accordance with manufacturer recommendations; panels plumb, aligned and at correct spacing; temporary bracing installed; vertical and horizontal alignment within tolerances; connection points accessible for reinforcement attachment',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (alignment, plumb)',
      notes: 'Section 682. Each facing panel shall be temporarily and securely supported during and after erection until adjacent fill placed and compacted. First row sets alignment for entire wall. Superintendent approval required before proceeding.'
    },
    {
      description: 'Inspect facing panel condition and dimensions before erection',
      acceptanceCriteria: 'Panels inspected for damage (cracks, spalling, exposed reinforcement); dimensions within BTN 009 tolerances; connection hardware intact and correctly positioned; panel identification marks correspond to erection sequence',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682, BTN 009. Damaged panels must not be erected without Superintendent approval.'
    },
    {
      description: 'Verify panel temporary bracing and support',
      acceptanceCriteria: 'Temporary bracing securely connected; bracing resists wind and construction loads; panels supported until fill is placed and compacted to a level that provides permanent support; bracing removal sequence documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Panels temporarily and securely supported during and after erection until adjacent fill material placed and compacted.'
    },
    {
      description: 'Install joint material between panels',
      acceptanceCriteria: 'Joint strips, pads or geotextile filter fabric installed between panels per design; prevents loss of fill material through joints; allows for thermal movement; material as specified by RSS system designer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 682. Joint treatment prevents fines loss and ensures aesthetic finish.'
    },
    {
      description: 'Survey panel alignment after each lift',
      acceptanceCriteria: 'Panel face alignment (horizontal and vertical) within specified tolerances; batter angle correct; steps between adjacent panels within limits; cumulative deviation within overall tolerance; survey records maintained',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (alignment, batter, level)',
      notes: 'Section 682. Alignment checked progressively as wall is built up. Superintendent to verify.'
    },

    // =========================================================================
    // REINFORCEMENT & FILL
    // =========================================================================
    {
      description: 'Connect reinforcement to facing panels',
      acceptanceCriteria: 'Reinforcing elements connected to wall panels in accordance with design; connection bolts or clips tightened to specification; connection type and spacing per approved drawings',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Reinforcing elements connected to wall panels in accordance with the design. Superintendent to verify connections.'
    },
    {
      description: 'Place reinforcement on compacted fill at specified level',
      acceptanceCriteria: 'Reinforcing elements placed at required level and position directly on top of compacted fill material; reinforcement free of twists, kinks, sags or deviations; reinforcement length and spacing per design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Reinforcing elements placed at required level and position directly on top of compacted fill. Any twists, kinks, sags or deviations shall be removed prior to placement of fill on reinforcing.'
    },
    {
      description: 'Place select fill in reinforced zone',
      acceptanceCriteria: 'Fill placed in uniform layers not exceeding specified lift thickness (typically 150-300 mm compacted); placed from reinforcement onto already-covered area to prevent displacement; no end-dumping onto reinforcement; no trafficking on exposed reinforcement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Fill placement must not displace or damage reinforcement.'
    },
    {
      description: 'Compact fill between reinforcement layers',
      acceptanceCriteria: 'Compaction equipment suitable for proximity to facing panels (light equipment within 1 m of face); density ratio meets specification (typically 95% Standard or as specified); moisture content within optimum range; no rutting of reinforcement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 (Density Ratio and Moisture Ratio Lot Characteristics)',
      notes: 'Section 682. Compaction critical for RSS performance. Light compaction equipment near face to prevent panel displacement.'
    },
    {
      description: 'Verify no traffic or equipment on unprotected reinforcement',
      acceptanceCriteria: 'Traffic on reinforcing elements not allowed until reinforcement protected by minimum 150 mm layer of fill material; construction equipment routes planned to avoid running over unprotected reinforcement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Traffic and work on reinforcing elements is not allowed until reinforcement protected by minimum 150 mm of fill.'
    },
    {
      description: 'Install drainage behind wall at specified levels',
      acceptanceCriteria: 'Drainage aggregate or geocomposite drain placed behind facing panels as designed; drainage layer continuous and connected to outlets; filter material prevents fill migration into drainage layer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 682. Drainage essential to prevent hydrostatic pressure on wall.'
    },
    {
      description: 'Place retained fill behind reinforced zone',
      acceptanceCriteria: 'Retained fill (general fill) placed and compacted behind reinforced zone to design levels; compaction to specification; fill level kept approximately equal to reinforced zone fill level during construction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 (Density Ratio and Moisture Ratio Lot Characteristics)',
      notes: 'Section 682. Differential fill levels between reinforced and retained zones can cause instability.'
    },

    // =========================================================================
    // COMPLETION
    // =========================================================================
    {
      description: 'Install coping/cap units on top of wall',
      acceptanceCriteria: 'Coping units or cast-in-place capping beam installed per design; aligned and level; secured to top panels; drainage falls correct; finish acceptable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 682. Coping provides finish and protects top of wall from infiltration.'
    },
    {
      description: 'Install safety fence at top of wall (where required)',
      acceptanceCriteria: 'Safety fence installed where fall hazard exists at top of RSS; fence minimum 1.2 m high with galvanised steel tube top and bottom rail faced with galvanised steel chain mesh (unless otherwise specified)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Where a fall-hazard exists, safety fence shall be 1.2 m high with galvanised steel tube rails and chain mesh.'
    },
    {
      description: 'Final survey and as-built documentation',
      acceptanceCriteria: 'Final survey of wall face alignment (horizontal and vertical); as-built drawings prepared showing actual reinforcement lengths, levels, panel layout, drainage locations; all QA records compiled',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check (final wall geometry)',
      notes: 'Section 682. As-built records required for maintenance and future reference. Superintendent to attend final survey.'
    },

    // =========================================================================
    // FINAL ACCEPTANCE & CLOSE-OUT
    // =========================================================================
    {
      description: 'Final RSS inspection and acceptance',
      acceptanceCriteria: 'Wall face alignment within specified tolerances; no visible damage, cracking or displacement; drainage functioning; backfill complete; all QA documentation submitted and accepted; structure complies with approved design',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 682. Superintendent acceptance required prior to handover.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All RSS criteria met, survey data acceptable, QA documentation package complete',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent'
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
      stateSpec: 'VicRoads',
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
  console.log(' VIC (VicRoads) ITP Template Seeder - Environmental')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(vicESCTemplate)
    await seedTemplate(vicLandscapingTemplate)
    await seedTemplate(vicGeosyntheticsTemplate)
    await seedTemplate(vicReinforcedSoilStructuresTemplate)

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
