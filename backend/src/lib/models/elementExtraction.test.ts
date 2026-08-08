import { describe, expect, it } from 'vitest';

import { createDraftLotIfcFixture } from '../ifc/fixture.js';
import { ifcGuid } from '../ifc/guid.js';
import { serializeDraftLotIfc } from '../ifc/serializer.js';
import { extractElements } from './elementExtraction.js';

function dataSection(ifc: string): string {
  const start = ifc.indexOf('DATA;') + 'DATA;'.length;
  const end = ifc.indexOf('ENDSEC;', start);
  return ifc.slice(start, end);
}

function combineIfcDocuments(first: string, second: string): string {
  const ids = Array.from(first.matchAll(/^#(\d+)\s*=/gm), (match) => Number(match[1]));
  const offset = Math.max(...ids);
  const renumbered = dataSection(second).replace(/#(\d+)/g, (_match, id: string) => {
    return `#${Number(id) + offset}`;
  });
  const dataStart = first.indexOf('DATA;') + 'DATA;'.length;
  const dataEnd = first.indexOf('ENDSEC;', dataStart);
  return `${first.slice(0, dataEnd)}${renumbered}${first.slice(dataEnd)}`;
}

describe('extractElements', () => {
  it('indexes two serializer-built proxies and their ConstructionLotNumber values', async () => {
    const first = createDraftLotIfcFixture();
    const second = structuredClone(first);
    second.filename = 'IFC-DRAFT-LOT-043.ifc';
    second.lot.id = 'lot-fixture-43';
    second.lot.lotNumber = 'LOT-043';
    second.lot.description = 'Second proxy';
    second.propertySets.construction.ConstructionLotNumber = 'LOT-043';
    second.propertySets.civosQa.CivosLotId = 'lot-fixture-43';

    const source = Buffer.from(
      combineIfcDocuments(serializeDraftLotIfc(first), serializeDraftLotIfc(second)),
      'ascii',
    );
    const result = await extractElements(source);

    expect(result.skippedMissingGuid).toBe(0);
    expect(result.skippedDuplicateGuid).toBe(0);
    expect(result.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ifcGuid: ifcGuid('product:lot-fixture-42'),
          name: 'LOT-042',
          category: 'IfcBuildingElementProxy',
          lotNumberValue: 'LOT-042',
        }),
        expect.objectContaining({
          ifcGuid: ifcGuid('product:lot-fixture-43'),
          name: 'LOT-043',
          category: 'IfcBuildingElementProxy',
          lotNumberValue: 'LOT-043',
        }),
      ]),
    );
  });
});
