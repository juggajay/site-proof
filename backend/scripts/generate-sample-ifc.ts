import { writeFile } from 'node:fs/promises';

import { createDraftLotIfcFixture } from '../src/lib/ifc/fixture.js';
import { serializeDraftLotIfc } from '../src/lib/ifc/serializer.js';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Usage: tsx scripts/generate-sample-ifc.ts <output.ifc>');
}

await writeFile(outputPath, serializeDraftLotIfc(createDraftLotIfcFixture()), 'ascii');
console.log(`Wrote sample IFC to ${outputPath}`);
