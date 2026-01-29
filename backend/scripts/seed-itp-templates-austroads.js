/**
 * Austroads Base ITP Templates
 *
 * These are national baseline templates based on:
 * - Austroads Guide to Road Design
 * - Austroads Guide to Pavement Technology
 * - Australian Standards (AS 1289, AS 1141, AS 1012)
 *
 * States typically adopt these with local modifications.
 * These templates serve as starting points for jurisdictions without specific specs.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// =============================================================================
// AUSTROADS EARTHWORKS TEMPLATE (Based on AS 1289 / Austroads Guide)
// =============================================================================
const austroadsEarthworksTemplate = {
  name: 'Earthworks - Austroads Base',
  description: 'Generic earthworks template based on Austroads guidelines and Australian Standards. Covers clearing, foundation prep, fill placement, compaction and testing.',
  activityType: 'earthworks',
  specificationReference: 'Austroads AGPT / AS 1289 Series',
  stateSpec: 'Austroads',
  checklistItems: [
    // Pre-Work Phase
    {
      description: 'Review and approve Project Quality Plan and Earthworks Management Plan',
      acceptanceCriteria: 'Plans approved, ITP registered',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ISO 9001 compliant QMS required'
    },
    {
      description: 'Verify survey control points and establish baseline',
      acceptanceCriteria: 'Survey control validated, datum established',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Primary control verification required'
    },
    {
      description: 'Complete pre-clearance environmental inspection',
      acceptanceCriteria: 'Environmental clearance obtained',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'CEMP approval required before clearing'
    },
    // Clearing and Grubbing
    {
      description: 'Strip and stockpile topsoil',
      acceptanceCriteria: 'Topsoil stripped to specified depth (typically 150mm), segregated from unsuitable material',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Topsoil stockpile location per approved plan'
    },
    {
      description: 'Remove all vegetation, roots and organic material',
      acceptanceCriteria: 'Complete removal of organics to foundation level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No organic material permitted in structural zone'
    },
    {
      description: 'Identify and remove unsuitable material (mucking out)',
      acceptanceCriteria: 'Unsuitable material removed and replaced with approved fill',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Document extent and depth of unsuitable material'
    },
    // Foundation Preparation
    {
      description: 'Prepare foundation surface - scarify and recompact',
      acceptanceCriteria: 'Foundation surface scarified minimum 150mm, recompacted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Prepare dry weather only'
    },
    {
      description: 'Foundation proof roll',
      acceptanceCriteria: 'No visible deflection under loaded roller (>2-3mm movement = fail)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Use fully loaded water cart or pneumatic roller'
    },
    {
      description: 'Foundation density testing',
      acceptanceCriteria: 'Minimum 95% Standard Maximum Dry Density (SMDD)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.1.1',
      notes: 'Test frequency: 1 per 500m³ or 1 per layer per lot'
    },
    {
      description: 'Foundation level survey',
      acceptanceCriteria: '+0mm / -50mm from design levels',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Document any areas requiring additional fill'
    },
    // Material Source Approval
    {
      description: 'Submit fill material source for approval',
      acceptanceCriteria: 'Material source approved with test results',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include PSD, PI, CBR test results'
    },
    {
      description: 'General fill material testing - classification',
      acceptanceCriteria: 'Material meets specification for general fill',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.6.1',
      notes: 'Particle size distribution per AS 1289.3.6.1'
    },
    {
      description: 'General fill Plasticity Index testing',
      acceptanceCriteria: 'PI within specified limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.3.1',
      notes: 'Liquid Limit per AS 1289.3.1.1, Plastic Limit per AS 1289.3.2.1'
    },
    {
      description: 'General fill CBR testing',
      acceptanceCriteria: 'CBR ≥ 3-5 (general fill), CBR ≥ 15 (select fill)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.6.1.1',
      notes: 'Soaked CBR test, 4-day soak period'
    },
    // Fill Placement
    {
      description: 'Verify fill layer thickness before compaction',
      acceptanceCriteria: 'Loose lift thickness ≤ 200mm (or as per trial)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Thinner lifts may be required for cohesive soils'
    },
    {
      description: 'Moisture conditioning of fill material',
      acceptanceCriteria: 'Moisture content within 85-115% of OMC',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.2.1.1',
      notes: 'Field check via microwave or speedy moisture'
    },
    {
      description: 'Compaction of general fill layers',
      acceptanceCriteria: '≥ 95% Standard Maximum Dry Density (SMDD)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.1.1',
      notes: 'Test via AS 1289.5.8.1 (nuclear) or sand replacement'
    },
    {
      description: 'Layer proof roll verification',
      acceptanceCriteria: 'No visible deflection or soft spots',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Visual observation of roller pass'
    },
    // Select Material Zone
    {
      description: 'Select material source approval',
      acceptanceCriteria: 'Select fill material approved with test results',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Higher quality material for upper 300-500mm'
    },
    {
      description: 'Select fill CBR verification',
      acceptanceCriteria: 'CBR ≥ 15 (typical select fill requirement)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.6.1.1',
      notes: 'Frequency: 1 per 5000m³ or material change'
    },
    {
      description: 'Select fill compaction testing',
      acceptanceCriteria: '≥ 100% Modified Maximum Dry Density (MMDD)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.2.1',
      notes: 'Modified compaction effort for structural zone'
    },
    // Subgrade Completion
    {
      description: 'Final subgrade density testing',
      acceptanceCriteria: '≥ 100% MMDD or as specified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.2.1',
      notes: 'Complete lot testing before pavement works'
    },
    {
      description: 'Final subgrade proof roll',
      acceptanceCriteria: 'No visible deflection, no pumping, no rutting',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Superintendent/Client inspection required'
    },
    {
      description: 'Final subgrade level survey',
      acceptanceCriteria: '+0mm / -30mm from design (no high spots)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey on 20m grid, high spots must be rectified'
    },
    {
      description: 'Batter slope verification',
      acceptanceCriteria: '±300mm general, ±100mm at structures',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey batter slopes and cross-sections'
    },
    {
      description: 'Lot conformance documentation - close lot',
      acceptanceCriteria: 'All tests passed, documentation complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Lot must be closed before proceeding to pavement'
    }
  ]
};

// =============================================================================
// AUSTROADS UNBOUND GRANULAR PAVEMENT TEMPLATE
// =============================================================================
const austroadsUnboundPavementTemplate = {
  name: 'Unbound Granular Pavement - Austroads Base',
  description: 'Generic unbound granular pavement template for base and subbase layers based on Austroads Guide to Pavement Technology Part 4 and AS 1289/1141.',
  activityType: 'pavement',
  specificationReference: 'Austroads AGPT Part 4 / AS 1141',
  stateSpec: 'Austroads',
  checklistItems: [
    // Pre-Work
    {
      description: 'Approve material source and mix design',
      acceptanceCriteria: 'Quarry source approved, grading envelope verified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include PSD, LA Abrasion, PI test results'
    },
    {
      description: 'Verify subgrade/underlying layer approval',
      acceptanceCriteria: 'Underlying layer lot closed, proof rolled',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cannot proceed without subgrade approval'
    },
    {
      description: 'Aggregate grading test (PSD)',
      acceptanceCriteria: 'Within specified grading envelope',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.11.1',
      notes: 'Test per 1000m³ or daily production'
    },
    {
      description: 'Los Angeles Abrasion value test',
      acceptanceCriteria: 'LA value ≤ 30-35% (typical base course)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.23',
      notes: 'Hardness test for aggregate durability'
    },
    {
      description: 'Flakiness Index test',
      acceptanceCriteria: 'FI ≤ 25-35% (typical)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.15',
      notes: 'Shape requirement for workability and compaction'
    },
    {
      description: 'Plasticity Index test on fines',
      acceptanceCriteria: 'PI ≤ 6 (Class 1 base), PI ≤ 12 (Class 2)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.3.1',
      notes: 'Controls moisture sensitivity'
    },
    // Trial Section
    {
      description: 'Conduct 100m trial pavement section',
      acceptanceCriteria: 'Trial section demonstrates achievable density and surface finish',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Establish rolling pattern (passes and sequence)'
    },
    {
      description: 'Document trial section rolling pattern',
      acceptanceCriteria: 'Rolling pattern documented and approved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Number of passes, roller types, sequence'
    },
    // Placement
    {
      description: 'Verify delivery docket - source and quantity',
      acceptanceCriteria: 'Material from approved source',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check dockets match approved source'
    },
    {
      description: 'Check layer thickness (loose lift)',
      acceptanceCriteria: 'Loose lift ≤ 200mm (or per trial)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Measure loose depth before compaction'
    },
    {
      description: 'Moisture conditioning during spreading',
      acceptanceCriteria: 'Moisture 80-100% of OMC',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.2.1.1',
      notes: 'Water during spreading if required'
    },
    {
      description: 'Visual inspection for segregation',
      acceptanceCriteria: 'No bony patches or fatty patches visible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Use paver on highway projects to prevent segregation'
    },
    // Compaction
    {
      description: 'Compaction per approved rolling pattern',
      acceptanceCriteria: 'Rolling pattern followed as per trial',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Typical: 6-8 passes with vibratory + static'
    },
    {
      description: 'In-situ density testing',
      acceptanceCriteria: '≥ 98% MMDD (base), ≥ 95% (subbase)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.8.1',
      notes: 'Nuclear density test, frequency per lot'
    },
    {
      description: 'Layer proof roll',
      acceptanceCriteria: 'No visible deflection or movement',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Detects soft spots not found by point testing'
    },
    // Surface Finishing
    {
      description: 'Trimming and level control',
      acceptanceCriteria: 'Level tolerance ±10mm (base), ±20mm (subbase)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey levels on 10m grid'
    },
    {
      description: 'Surface texture inspection (slushing if required)',
      acceptanceCriteria: 'Tight surface texture, no loose aggregate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'VicRoads requires slushing for tight seal'
    },
    // Deflection Testing
    {
      description: 'Deflection testing (Benkelman Beam or FWD)',
      acceptanceCriteria: 'Deflection within design limits',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 5101.3',
      notes: 'Verify composite stiffness before sealing'
    },
    // Lot Closure
    {
      description: 'Final level survey',
      acceptanceCriteria: '±10mm from design levels',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey prior to sealing/asphalt'
    },
    {
      description: 'Lot conformance and closure',
      acceptanceCriteria: 'All tests passed, lot documentation complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Close lot before proceeding to surfacing'
    }
  ]
};

// =============================================================================
// AUSTROADS CEMENT STABILISED PAVEMENT TEMPLATE
// =============================================================================
const austroadsStabilisedPavementTemplate = {
  name: 'Cement Stabilised Pavement - Austroads Base',
  description: 'Generic cement treated base (CTB) template based on Austroads Guide to Pavement Technology. Covers insitu and plant mixed stabilisation.',
  activityType: 'pavement',
  specificationReference: 'Austroads AGPT Part 4D',
  stateSpec: 'Austroads',
  checklistItems: [
    // Pre-Work
    {
      description: 'Approve stabilisation mix design',
      acceptanceCriteria: 'Mix design approved with target UCS and cement content',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include 7-day and 28-day UCS targets'
    },
    {
      description: 'Verify cement supply and storage',
      acceptanceCriteria: 'Cement type approved, silos clean and dry',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'GP cement typical, check expiry'
    },
    {
      description: 'Calibrate cement spreader',
      acceptanceCriteria: 'Spreader calibrated to target application rate',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Document spread rate kg/m²'
    },
    // Trial Section
    {
      description: 'Conduct stabilisation trial section (100m)',
      acceptanceCriteria: 'Trial demonstrates achievable density, mixing depth, working time',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Critical: determine achievable working time'
    },
    // Spreading and Mixing
    {
      description: 'Apply cement at specified rate',
      acceptanceCriteria: 'Cement spread uniformly at design rate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check via collection trays'
    },
    {
      description: 'Pre-mixing moisture check',
      acceptanceCriteria: 'Moisture adjusted to OMC-2% to OMC',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.2.1.1',
      notes: 'Slight dry of OMC preferred'
    },
    {
      description: 'Mixing depth verification',
      acceptanceCriteria: 'Full depth mixing to specified depth (±20mm)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check for unmixed pockets'
    },
    {
      description: 'Visual check mixing uniformity',
      acceptanceCriteria: 'Uniform colour, no cement streaks or dry spots',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Multiple passes required for uniform mix'
    },
    // Compaction (Time Critical)
    {
      description: 'Monitor working time',
      acceptanceCriteria: 'Complete compaction within 2-4 hours of mixing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'CRITICAL: Rolling after initial set destroys strength'
    },
    {
      description: 'Initial compaction (breakdown rolling)',
      acceptanceCriteria: 'Material shaped and partially compacted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Vibratory roller first'
    },
    {
      description: 'Intermediate compaction',
      acceptanceCriteria: 'Continued densification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Pad foot or vibratory'
    },
    {
      description: 'Final trimming and compaction',
      acceptanceCriteria: 'Final shape achieved, surface tight',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Steel drum roller to finish'
    },
    {
      description: 'In-situ density testing',
      acceptanceCriteria: '≥ 98% MMDD',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.8.1',
      notes: 'Test before end of working time'
    },
    // Curing
    {
      description: 'Apply curing compound immediately after final roll',
      acceptanceCriteria: 'Curing compound applied at specified rate',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Prevent rapid moisture loss'
    },
    {
      description: 'Traffic control during curing',
      acceptanceCriteria: 'No traffic on fresh CTB for 7 days minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Or until specified strength achieved'
    },
    // Testing
    {
      description: 'Sample beams/cylinders for UCS testing',
      acceptanceCriteria: 'Samples taken from production runs',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 5101.4',
      notes: 'NATA lab testing'
    },
    {
      description: '7-day UCS results',
      acceptanceCriteria: 'UCS ≥ specified 7-day target',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 5101.4',
      notes: 'Early indication of final strength'
    },
    {
      description: '28-day UCS results',
      acceptanceCriteria: 'UCS within specified range (typical 2-5 MPa)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 5101.4',
      notes: 'Final strength verification'
    },
    // Completion
    {
      description: 'Level survey',
      acceptanceCriteria: '±10mm from design levels',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey after curing period'
    },
    {
      description: 'Crack inspection',
      acceptanceCriteria: 'No excessive shrinkage cracking',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Minor cracking acceptable, map extent'
    },
    {
      description: 'Lot conformance and closure',
      acceptanceCriteria: 'All tests passed, documentation complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Close lot before sealing'
    }
  ]
};

// =============================================================================
// AUSTROADS DENSE GRADED ASPHALT TEMPLATE
// =============================================================================
const austroadsAsphaltTemplate = {
  name: 'Dense Graded Asphalt - Austroads Base',
  description: 'Generic dense graded asphalt (DGA) template based on Austroads Guide to Pavement Technology Part 4B. Covers manufacturing, placement and testing.',
  activityType: 'asphalt',
  specificationReference: 'Austroads AGPT Part 4B / AS 2150',
  stateSpec: 'Austroads',
  checklistItems: [
    // Mix Design and Registration
    {
      description: 'Submit and approve Job Mix Formula (JMF)',
      acceptanceCriteria: 'JMF approved with volumetrics and performance data',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'NATA endorsed mix design required'
    },
    {
      description: 'Verify binder type and grade',
      acceptanceCriteria: 'Binder grade per specification (C170, C320, multigrade)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Binder certification from supplier'
    },
    {
      description: 'Aggregate source approval',
      acceptanceCriteria: 'Aggregate from approved source, test certificates current',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'LA value, Flakiness, PSD results'
    },
    {
      description: 'Design air voids verification',
      acceptanceCriteria: 'Design air voids 4-5% (typical DGA)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.8',
      notes: 'Marshall or gyratory design'
    },
    {
      description: 'VMA check',
      acceptanceCriteria: 'Voids in Mineral Aggregate ≥ minimum per mix size',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.8',
      notes: 'Ensures adequate binder film thickness'
    },
    // Pre-Placement
    {
      description: 'Base course approval',
      acceptanceCriteria: 'Underlying layer approved, lot closed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cannot place asphalt on unapproved base'
    },
    {
      description: 'Tack coat application',
      acceptanceCriteria: 'Tack applied at specified rate (0.15-0.25 L/m²)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No uncured tack under paver'
    },
    {
      description: 'Weather conditions check',
      acceptanceCriteria: 'Air temp ≥10°C, no rain, surface dry',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Record temperature and conditions'
    },
    // Manufacturing
    {
      description: 'Plant temperature check',
      acceptanceCriteria: 'Mixing temperature per JMF (typically 150-170°C)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Overheating oxidizes binder'
    },
    {
      description: 'Production sampling for QC',
      acceptanceCriteria: 'Samples taken per production batch',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.2.1',
      notes: 'Grading and binder content checks'
    },
    // Delivery and Placement
    {
      description: 'Delivery docket verification',
      acceptanceCriteria: 'Batch time < 90 mins to placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check mix ID matches JMF'
    },
    {
      description: 'Material temperature at truck',
      acceptanceCriteria: 'Delivery temp within spec (typically 130-160°C)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Reject loads below minimum'
    },
    {
      description: 'Use of Material Transfer Vehicle (MTV) if specified',
      acceptanceCriteria: 'MTV in use for highway wearing course',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Eliminates thermal segregation'
    },
    {
      description: 'Paver screed setup verification',
      acceptanceCriteria: 'Screed heated, extensions set, correct crown',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check auger speed settings'
    },
    {
      description: 'Mat temperature behind paver',
      acceptanceCriteria: 'Mat temp ≥ minimum compaction temp',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Infrared measurement'
    },
    // Joints
    {
      description: 'Longitudinal joint construction',
      acceptanceCriteria: 'Joints offset from lane lines (150mm min)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Out of wheel path'
    },
    {
      description: 'Joint preparation - cold joint cutback',
      acceptanceCriteria: 'Cold joints cut back, tacked',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Waterproof bond essential'
    },
    // Compaction
    {
      description: 'Initial (breakdown) rolling',
      acceptanceCriteria: 'Begin rolling immediately behind paver',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Steel drum vibratory'
    },
    {
      description: 'Intermediate rolling',
      acceptanceCriteria: 'Continued densification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Pneumatic or vibratory'
    },
    {
      description: 'Finish rolling',
      acceptanceCriteria: 'Remove roller marks, tight surface',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Static steel drum'
    },
    // Testing
    {
      description: 'Core extraction for density testing',
      acceptanceCriteria: 'Cores cut after cooling (typically next day)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.9.2',
      notes: 'Frequency per lot area'
    },
    {
      description: 'In-situ air voids result',
      acceptanceCriteria: 'Air voids 3-7% (typical), target 5%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.9.2',
      notes: '>8% = permeable, <2.5% = flushing risk'
    },
    {
      description: 'Thickness verification from cores',
      acceptanceCriteria: 'Average thickness ≥ design, min per core',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.9.2',
      notes: 'Core thickness measurement'
    },
    // Surface Quality
    {
      description: 'Surface texture measurement (if required)',
      acceptanceCriteria: 'Texture depth within spec',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.13.1',
      notes: 'Sand patch or laser texture'
    },
    {
      description: 'Ride quality survey (IRI)',
      acceptanceCriteria: 'IRI < 1.5-2.0 m/km (new construction)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Laser profilometer measurement'
    },
    {
      description: 'Visual inspection for defects',
      acceptanceCriteria: 'No segregation, tearing, checking, or surface defects',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Document and repair any defects'
    },
    // Completion
    {
      description: 'Level survey',
      acceptanceCriteria: '±10mm from design levels',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check crossfall and grade'
    },
    {
      description: 'Lot conformance and closure',
      acceptanceCriteria: 'All tests passed, documentation complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Close lot for payment'
    }
  ]
};

// =============================================================================
// AUSTROADS STRUCTURAL CONCRETE TEMPLATE
// =============================================================================
const austroadsConcreteTemplate = {
  name: 'Structural Concrete - Austroads Base',
  description: 'Generic structural concrete template based on AS 3600 and Austroads guidelines. Covers footings, piers, abutments, and general structural elements.',
  activityType: 'concrete',
  specificationReference: 'AS 3600 / AS 1379 / Austroads',
  stateSpec: 'Austroads',
  checklistItems: [
    // Pre-Pour Planning
    {
      description: 'Approve concrete mix design',
      acceptanceCriteria: 'Mix design approved for specified grade and durability class',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'NATA certified supplier, VPV limits for exposure class'
    },
    {
      description: 'Review pour plan and sequence',
      acceptanceCriteria: 'Pour plan approved with lift heights and joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Construction joint locations approved'
    },
    {
      description: 'Verify reinforcement shop drawings',
      acceptanceCriteria: 'Shop drawings approved by design engineer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check bar schedules match drawings'
    },
    // Formwork
    {
      description: 'Formwork inspection - dimensions',
      acceptanceCriteria: 'Formwork dimensions within tolerance (±5mm typical)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check against drawings'
    },
    {
      description: 'Formwork inspection - alignment and plumb',
      acceptanceCriteria: 'Vertical faces plumb, horizontal levels achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey check critical elements'
    },
    {
      description: 'Formwork structural adequacy check',
      acceptanceCriteria: 'Formwork bracing and ties adequate for pour rate',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Prevent blowouts under hydrostatic pressure'
    },
    {
      description: 'Apply form release agent',
      acceptanceCriteria: 'Release agent applied evenly, no pooling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Before reinforcement placed'
    },
    // Reinforcement
    {
      description: 'Reinforcement delivery check',
      acceptanceCriteria: 'Steel test certificates provided, bar marks correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check mill certs match order'
    },
    {
      description: 'Reinforcement placement - bar sizes',
      acceptanceCriteria: 'Bar sizes per schedule',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Verify bar diameter'
    },
    {
      description: 'Reinforcement placement - spacing',
      acceptanceCriteria: 'Bar spacing within tolerance (±10mm or ±0.1 x spacing)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Measure at multiple locations'
    },
    {
      description: 'Reinforcement placement - lap lengths',
      acceptanceCriteria: 'Lap lengths per drawings and AS 3600',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check tension and compression laps'
    },
    {
      description: 'Cover to reinforcement',
      acceptanceCriteria: 'Cover achieved with approved chairs/spacers',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Critical for durability - measure cover'
    },
    {
      description: 'Pre-pour inspection - complete reinforcement check',
      acceptanceCriteria: 'All reinforcement fixed, secure, clean of rust scale',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Superintendent inspection required'
    },
    // Concrete Placement
    {
      description: 'Verify delivery docket',
      acceptanceCriteria: 'Mix ID correct, batch time < 90 mins, volume correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check every load'
    },
    {
      description: 'Slump test',
      acceptanceCriteria: 'Slump within JMF tolerance (±25mm typical)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1',
      notes: 'Test frequency per spec'
    },
    {
      description: 'Air content test (if air entrained)',
      acceptanceCriteria: 'Air content 4-6% for freeze-thaw exposure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.4',
      notes: 'If specified for durability'
    },
    {
      description: 'Concrete temperature check',
      acceptanceCriteria: 'Temperature < 32°C (hot weather) or > 5°C (cold)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Record temperature'
    },
    {
      description: 'Make test specimens (cylinders)',
      acceptanceCriteria: 'Specimens made per AS 1012.8',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.8',
      notes: 'Standard cured and field cured if required'
    },
    {
      description: 'Placement method - drop height',
      acceptanceCriteria: 'Free fall < 1.5m to avoid segregation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Use tremie or chute for deep pours'
    },
    {
      description: 'Vibration of concrete',
      acceptanceCriteria: 'Full compaction achieved, no honeycombing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Systematic immersion, avoid over-vibration'
    },
    {
      description: 'Surface finishing',
      acceptanceCriteria: 'Surface finish as specified (U3, formed, etc.)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Float, trowel or broomed as required'
    },
    // Curing
    {
      description: 'Initial curing protection',
      acceptanceCriteria: 'Surface protected from moisture loss immediately',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Curing compound or wet cure'
    },
    {
      description: 'Apply curing compound or membrane',
      acceptanceCriteria: 'Curing compound applied at specified rate',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Apply immediately after finishing'
    },
    {
      description: 'Monitor curing duration',
      acceptanceCriteria: 'Minimum 7 days continuous curing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Extended curing for high exposure'
    },
    // Stripping and Inspection
    {
      description: 'Stripping approval',
      acceptanceCriteria: 'Concrete achieved minimum stripping strength',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Typically 70% of characteristic strength'
    },
    {
      description: 'Post-strip inspection',
      acceptanceCriteria: 'No honeycombing, cracks, or damage',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Document any defects for repair'
    },
    // Testing Results
    {
      description: '7-day compressive strength result',
      acceptanceCriteria: 'Strength on track for 28-day target',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Early warning indicator'
    },
    {
      description: '28-day compressive strength result',
      acceptanceCriteria: 'fc ≥ specified characteristic strength',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'NATA certified lab results'
    },
    {
      description: 'VPV test result (if required)',
      acceptanceCriteria: 'VPV < 13-14% for high durability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.21',
      notes: 'Required for marine/aggressive exposure'
    },
    // Completion
    {
      description: 'Lot conformance and closure',
      acceptanceCriteria: 'All tests passed, documentation complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Close lot for payment and records'
    }
  ]
};

// =============================================================================
// AUSTROADS PIPE DRAINAGE TEMPLATE
// =============================================================================
const austroadsDrainageTemplate = {
  name: 'Pipe Drainage Installation - Austroads Base',
  description: 'Generic pipe drainage installation template based on AS/NZS 3725 and Austroads guidelines. Covers rigid and flexible pipe installation.',
  activityType: 'drainage',
  specificationReference: 'AS/NZS 3725 / Austroads',
  stateSpec: 'Austroads',
  checklistItems: [
    // Pre-Work
    {
      description: 'Review drawings and confirm alignment',
      acceptanceCriteria: 'Pipe alignment, grades, and inverts confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey setout checked'
    },
    {
      description: 'Pipe material approval',
      acceptanceCriteria: 'Pipe class and material per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Class for load and cover depth'
    },
    {
      description: 'Verify bedding material',
      acceptanceCriteria: 'Bedding material approved (sand, gravel per spec)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Material certification'
    },
    // Excavation
    {
      description: 'Trench width verification',
      acceptanceCriteria: 'Trench width per AS/NZS 3725 (OD + 300mm min)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Critical for haunch support'
    },
    {
      description: 'Trench battering/shoring',
      acceptanceCriteria: 'Safe trench per WHS requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Shore if > 1.5m depth'
    },
    {
      description: 'Foundation condition inspection',
      acceptanceCriteria: 'Firm natural ground or approved foundation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No soft spots or water'
    },
    // Bedding
    {
      description: 'Place bedding layer',
      acceptanceCriteria: 'Bedding depth per support type (HS3: 100mm min)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Level and compact bedding'
    },
    {
      description: 'Form pipe cradle',
      acceptanceCriteria: 'Cradle formed to support barrel, sockets clear',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Pipe must sit on barrel not joints'
    },
    // Pipe Installation
    {
      description: 'Pipe inspection before installation',
      acceptanceCriteria: 'No damage, cracks, or defects in pipes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reject damaged pipes'
    },
    {
      description: 'Pipe laying and jointing',
      acceptanceCriteria: 'Joints made per manufacturer instructions',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Spigot to socket, proper lubrication'
    },
    {
      description: 'Check grade and alignment during laying',
      acceptanceCriteria: 'Grade per drawings (typical 1:100 - 1:300)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Use laser or batter boards'
    },
    // Haunch and Side Support
    {
      description: 'Place and compact haunch zone material',
      acceptanceCriteria: 'Material compacted under haunches (70-90% of height)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'CRITICAL: Poor haunch support = pipe failure'
    },
    {
      description: 'Side fill placement and compaction',
      acceptanceCriteria: 'Side fill compacted in layers ≤150mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Equal support both sides'
    },
    // Testing Before Backfill
    {
      description: 'Pipe joint inspection',
      acceptanceCriteria: 'All joints properly made, no gaps',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Before overlay zone placed'
    },
    {
      description: 'Invert level check',
      acceptanceCriteria: 'Inverts within tolerance (±10mm typical)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey all structures and changes'
    },
    // Backfill
    {
      description: 'Overlay zone placement',
      acceptanceCriteria: 'Overlay zone to 300mm above pipe crown',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Select material, compact gently'
    },
    {
      description: 'General backfill in layers',
      acceptanceCriteria: 'Backfill in ≤200mm layers, compacted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Standard compaction effort'
    },
    {
      description: 'Backfill density testing',
      acceptanceCriteria: '≥ 95% SMDD (general), ≥ 98% under pavements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.1.1',
      notes: 'Higher density in road formation'
    },
    // Post-Installation Testing
    {
      description: 'CCTV pipe inspection',
      acceptanceCriteria: 'No defects, deflection within limits, joints OK',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Deflection < 5% for flexible pipes'
    },
    {
      description: 'Mandrel test for flexible pipes',
      acceptanceCriteria: 'Mandrel passes full length without obstruction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Mandrel dia = 95% of pipe ID'
    },
    {
      description: 'Water test (if specified)',
      acceptanceCriteria: 'Infiltration/exfiltration within allowable rate',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'For pressure or water table applications'
    },
    // Completion
    {
      description: 'As-built survey',
      acceptanceCriteria: 'Inverts, obvert, location recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'For asset records'
    },
    {
      description: 'Lot conformance and closure',
      acceptanceCriteria: 'All tests passed, documentation complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Close lot for payment'
    }
  ]
};

// =============================================================================
// SEED FUNCTION
// =============================================================================
async function seedTemplate(templateData) {
  const { checklistItems, ...templateFields } = templateData;

  // Check if template already exists
  const existing = await prisma.iTPTemplate.findFirst({
    where: {
      name: templateFields.name,
      stateSpec: templateFields.stateSpec,
      projectId: null
    }
  });

  if (existing) {
    console.log(`  Template "${templateFields.name}" already exists, skipping...`);
    return existing;
  }

  // Create template with checklist items
  const template = await prisma.iTPTemplate.create({
    data: {
      ...templateFields,
      projectId: null, // Global template
      isActive: true,
      checklistItems: {
        create: checklistItems.map((item, index) => ({
          sequenceNumber: index + 1,
          ...item
        }))
      }
    },
    include: {
      checklistItems: true
    }
  });

  console.log(`  Created: ${template.name} (${template.checklistItems.length} items)`);
  return template;
}

async function main() {
  console.log('\n=== Seeding Austroads Base ITP Templates ===\n');

  const templates = [
    austroadsEarthworksTemplate,
    austroadsUnboundPavementTemplate,
    austroadsStabilisedPavementTemplate,
    austroadsAsphaltTemplate,
    austroadsConcreteTemplate,
    austroadsDrainageTemplate
  ];

  let totalItems = 0;
  let totalHoldPoints = 0;
  let totalWitnessPoints = 0;

  for (const template of templates) {
    await seedTemplate(template);
    totalItems += template.checklistItems.length;
    totalHoldPoints += template.checklistItems.filter(i => i.pointType === 'hold_point').length;
    totalWitnessPoints += template.checklistItems.filter(i => i.pointType === 'witness').length;
  }

  console.log('\n=== Austroads Seeding Complete ===');
  console.log(`Total Templates: ${templates.length}`);
  console.log(`Total Checklist Items: ${totalItems}`);
  console.log(`Total Hold Points: ${totalHoldPoints}`);
  console.log(`Total Witness Points: ${totalWitnessPoints}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
