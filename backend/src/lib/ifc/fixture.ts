import type { DraftLotIfcInput } from './serializer.js';

export function createDraftLotIfcFixture(): DraftLotIfcInput {
  return {
    filename: 'IFC-DRAFT-LOT-042.ifc',
    exportedAt: '2026-08-07T09:00:00.000Z',
    authorName: 'Jayson Ryan',
    project: {
      id: 'project-fixture-1',
      name: 'Pacific Ridge Stage 2',
      description: 'DRAFT coordination model',
    },
    origin: { e: 500_000, n: 6_900_000, epsg: 'EPSG:7856' },
    lot: {
      id: 'lot-fixture-42',
      lotNumber: 'LOT-042',
      description: "O'Brien's backslash \\ and Seán – DRAFT lot",
    },
    gridRing: [
      { easting: 500_010, northing: 6_900_010 },
      { easting: 500_030, northing: 6_900_010 },
      { easting: 500_030, northing: 6_900_020 },
      { easting: 500_010, northing: 6_900_020 },
    ],
    propertySets: {
      project: {
        Datum: 'GDA2020',
        Zone: '56',
        OriginEasting: 500_000,
        OriginNorthing: 6_900_000,
      },
      design: { ControlLine: 'PR2-CL-MAIN', StartCHG: 100, EndCHG: 120 },
      construction: { ConstructionLotNumber: 'LOT-042', ConstructionDate: '2026-08-01' },
      assetManagement: { Offset: 'L5 R5' },
      civosQa: {
        ConformanceStatus: 'conformed',
        ConformedAt: '2026-08-01T04:30:00.000Z',
        ConformedBy: 'Quality Manager',
        ConformanceOverridden: false,
        ConformanceOverrideReason: null,
        ITPItemsCompleted: 4,
        ITPItemsTotal: 4,
        NCRReferences: 'NCR-17',
        HoldPointCount: 1,
        TestResultCount: 2,
        CivosLotId: 'lot-fixture-42',
        CivosUrl: 'https://app.civos.com.au/projects/project-fixture-1/lots/lot-fixture-42',
        GeometrySource: 'LotRecords (not survey)',
        HeightData: 'NoHeightData',
      },
    },
  };
}
