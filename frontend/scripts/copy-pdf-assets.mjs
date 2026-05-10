import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(scriptDir, '..');
const pdfjsDistRoot = join(frontendRoot, 'node_modules', 'pdfjs-dist');
const outputRoot = join(frontendRoot, 'public', 'pdfjs');

const assetDirectories = ['cmaps', 'standard_fonts'];

for (const directory of assetDirectories) {
  const source = join(pdfjsDistRoot, directory);
  if (!existsSync(source)) {
    throw new Error(`Missing PDF.js asset directory: ${source}`);
  }
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const directory of assetDirectories) {
  cpSync(join(pdfjsDistRoot, directory), join(outputRoot, directory), {
    recursive: true,
  });
}
