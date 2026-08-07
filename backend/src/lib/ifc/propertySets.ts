export const DRAFT_LOT_PROPERTY_SETS = [
  {
    name: 'Project',
    source: 'project',
    properties: ['Datum', 'Zone', 'OriginEasting', 'OriginNorthing'],
  },
  {
    name: 'Design',
    source: 'design',
    properties: ['ControlLine', 'StartCHG', 'EndCHG'],
  },
  {
    name: 'Construction',
    source: 'construction',
    properties: ['ConstructionLotNumber', 'ConstructionDate'],
  },
  {
    name: 'Asset Management',
    source: 'assetManagement',
    properties: ['Offset'],
  },
  {
    name: 'CIVOS_QA',
    source: 'civosQa',
    properties: [
      'ConformanceStatus',
      'ConformedAt',
      'ConformedBy',
      'ConformanceOverridden',
      'ConformanceOverrideReason',
      'ITPItemsCompleted',
      'ITPItemsTotal',
      'NCRReferences',
      'HoldPointCount',
      'TestResultCount',
      'CivosLotId',
      'CivosUrl',
      'GeometrySource',
      'HeightData',
    ],
  },
] as const;

export type DraftPropertyValue = string | number | boolean | null | undefined;
export type DraftPropertySetSource = (typeof DRAFT_LOT_PROPERTY_SETS)[number]['source'];
export type DraftLotPropertyData = Record<
  DraftPropertySetSource,
  Record<string, DraftPropertyValue>
>;
