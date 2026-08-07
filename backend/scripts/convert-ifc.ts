import fs from 'node:fs';
import path from 'node:path';

import { convertIfcBuffer } from '../src/lib/models/conversionRunner.js';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  process.stderr.write('Usage: npx tsx scripts/convert-ifc.ts <in.ifc> <out.frag>\n');
  process.exit(1);
}

const source = await fs.promises.readFile(path.resolve(inputPath));
const fragments = await convertIfcBuffer(source);
await fs.promises.writeFile(path.resolve(outputPath), fragments);
process.stdout.write(`Converted ${source.byteLength} bytes to ${fragments.byteLength} bytes\n`);
