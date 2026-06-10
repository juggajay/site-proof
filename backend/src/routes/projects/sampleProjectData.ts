/**
 * Static seed shapes for the one-click example project (POST /api/projects/sample).
 *
 * Everything here is plain data so it can be unit-tested without a database.
 * The route layer (`sampleProjectRoute.ts`) turns these shapes into rows in a
 * single transaction. Design constraints:
 *
 * - Self-contained: the ITP template is owned by the sample project
 *   (`projectId` set), so the seed never depends on operator-seeded global
 *   template libraries that may not exist in a fresh environment.
 * - Clearly labelled: the project name and number mark it as example data, and
 *   `SAMPLE_PROJECT_NUMBER` doubles as the per-company idempotency marker via
 *   the existing `@@unique([companyId, projectNumber])` constraint — no schema
 *   change needed.
 * - Lifecycle spread: lots cover not_started → in_progress → hold_point →
 *   ncr_raised → conformed so the lot register, Evidence Readiness, and the
 *   claim modal's conformed-lot flow all show real content immediately.
 */

export const SAMPLE_PROJECT_NUMBER = 'SAMPLE-001';
export const SAMPLE_PROJECT_NAME = 'Example Project — Riverside Estate Stage 1';

export const SAMPLE_PROJECT = {
  name: SAMPLE_PROJECT_NAME,
  projectNumber: SAMPLE_PROJECT_NUMBER,
  clientName: 'Riverside Shire Council (example)',
  status: 'active',
  state: 'NSW',
  specificationSet: 'TfNSW',
  chainageStart: 0,
  chainageEnd: 500,
  // Marker the frontend (or support tooling) can read without string-matching
  // the project name. Merged into the standard JSON settings column.
  settings: { sampleProject: true },
} as const;

export interface SampleChecklistItemSeed {
  sequenceNumber: number;
  description: string;
  acceptanceCriteria: string;
  pointType: 'standard' | 'witness' | 'hold_point';
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent';
  evidenceRequired: 'none' | 'photo' | 'test' | 'document';
  testType?: string;
}

export const SAMPLE_ITP_TEMPLATE = {
  name: 'Earthworks — Fill Placement & Compaction (Example)',
  description:
    'Example inspection and test plan seeded with the sample project. ' +
    'Edit or delete it freely — it only exists inside this example project.',
  activityType: 'Earthworks',
  specificationReference: 'TfNSW R44',
} as const;

export const SAMPLE_CHECKLIST_ITEMS: SampleChecklistItemSeed[] = [
  {
    sequenceNumber: 1,
    description: 'Survey set-out verified against design',
    acceptanceCriteria: 'Set-out within ±25 mm of design alignment',
    pointType: 'standard',
    responsibleParty: 'contractor',
    evidenceRequired: 'none',
  },
  {
    sequenceNumber: 2,
    description: 'Subgrade inspected and proof rolled',
    acceptanceCriteria: 'No visible deflection or heave under proof roller',
    pointType: 'witness',
    responsibleParty: 'contractor',
    evidenceRequired: 'photo',
  },
  {
    sequenceNumber: 3,
    description: 'Compaction testing completed for each layer',
    acceptanceCriteria: 'Dry density ratio ≥ 95% (AS 1289.5.4.1)',
    pointType: 'standard',
    responsibleParty: 'contractor',
    evidenceRequired: 'test',
    testType: 'density_ratio',
  },
  {
    sequenceNumber: 4,
    description: 'Hold point — superintendent release of subgrade',
    acceptanceCriteria: 'Written release received before fill placement continues',
    pointType: 'hold_point',
    responsibleParty: 'superintendent',
    evidenceRequired: 'document',
  },
  {
    sequenceNumber: 5,
    description: 'Final surface level conformance',
    acceptanceCriteria: 'Finished levels within +0 / −50 mm of design',
    pointType: 'standard',
    responsibleParty: 'contractor',
    evidenceRequired: 'document',
  },
];

/** Index (into SAMPLE_CHECKLIST_ITEMS) of the hold-point item. */
export const SAMPLE_HOLD_POINT_ITEM_INDEX = SAMPLE_CHECKLIST_ITEMS.findIndex(
  (item) => item.pointType === 'hold_point',
);

export interface SampleLotSeed {
  lotNumber: string;
  description: string;
  lotType: 'chainage' | 'area' | 'structure';
  activityType: string;
  status:
    | 'not_started'
    | 'in_progress'
    | 'awaiting_test'
    | 'hold_point'
    | 'ncr_raised'
    | 'completed'
    | 'conformed';
  budgetAmount: number;
  chainageStart?: number;
  chainageEnd?: number;
  areaZone?: string;
  /**
   * ITP assignment for this lot: 'complete' marks every checklist item
   * completed; 'partial' completes items up to (not including) the hold point.
   */
  itp?: 'complete' | 'partial';
  /** Seed a hold point on this lot's hold-point checklist item. */
  holdPoint?: 'released' | 'awaiting';
}

export const SAMPLE_LOTS: SampleLotSeed[] = [
  {
    lotNumber: 'LOT-001',
    description: 'Bulk earthworks — Ch 0 to Ch 250',
    lotType: 'chainage',
    activityType: 'Earthworks',
    status: 'conformed',
    budgetAmount: 48500,
    chainageStart: 0,
    chainageEnd: 250,
    itp: 'complete',
    holdPoint: 'released',
  },
  {
    lotNumber: 'LOT-002',
    description: 'Bulk earthworks — Ch 250 to Ch 500',
    lotType: 'chainage',
    activityType: 'Earthworks',
    status: 'hold_point',
    budgetAmount: 52000,
    chainageStart: 250,
    chainageEnd: 500,
    itp: 'partial',
    holdPoint: 'awaiting',
  },
  {
    lotNumber: 'LOT-003',
    description: 'Stormwater trunk drainage — Ch 0 to Ch 180',
    lotType: 'chainage',
    activityType: 'Drainage',
    status: 'in_progress',
    budgetAmount: 36400,
    chainageStart: 0,
    chainageEnd: 180,
  },
  {
    lotNumber: 'LOT-004',
    description: 'Kerb and channel — northern access road',
    lotType: 'area',
    activityType: 'Concrete',
    status: 'ncr_raised',
    budgetAmount: 18750,
    areaZone: 'Northern access road',
  },
  {
    lotNumber: 'LOT-005',
    description: 'Pavement base course — Ch 0 to Ch 250',
    lotType: 'chainage',
    activityType: 'Pavements',
    status: 'not_started',
    budgetAmount: 61200,
    chainageStart: 0,
    chainageEnd: 250,
  },
];

export const SAMPLE_NCR = {
  /** Linked to this lot via NCRLot. */
  lotNumber: 'LOT-004',
  ncrNumber: 'NCR-0001',
  description:
    'Kerb alignment on the northern access road deviates up to 35 mm from design ' +
    'over a 12 m section. Proposed rectification: saw cut, remove, and re-pour ' +
    'the affected section to design alignment.',
  category: 'workmanship',
  severity: 'minor',
  status: 'open',
  specificationReference: 'TfNSW R145',
} as const;

export interface SampleTestResultSeed {
  lotNumber: string;
  testType: string;
  status: 'requested' | 'verified';
  passFail: 'pass' | 'pending';
  resultValue?: number;
  resultUnit?: string;
  specificationMin?: number;
  specificationMax?: number;
  laboratoryName: string;
  sampleLocation: string;
}

export const SAMPLE_TEST_RESULTS: SampleTestResultSeed[] = [
  {
    lotNumber: 'LOT-001',
    testType: 'density_ratio',
    status: 'verified',
    passFail: 'pass',
    resultValue: 98.2,
    resultUnit: '% DDR',
    specificationMin: 95,
    specificationMax: 100,
    laboratoryName: 'Riverside Geotechnics (example)',
    sampleLocation: 'Ch 120, layer 3',
  },
  {
    lotNumber: 'LOT-002',
    testType: 'density_ratio',
    status: 'requested',
    passFail: 'pending',
    laboratoryName: 'Riverside Geotechnics (example)',
    sampleLocation: 'Ch 360, layer 2',
  },
];
