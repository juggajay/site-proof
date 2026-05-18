import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const seedDir = resolve(process.cwd(), 'scripts/seeds/itp-templates');

describe('ITP template seeder locking', () => {
  it('guards every executable ITP template seeder with the shared advisory lock', async () => {
    const files = (await readdir(seedDir))
      .filter((file) => file.startsWith('seed-itp-templates-') && file.endsWith('.js'))
      .sort();

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = await readFile(resolve(seedDir, file), 'utf8');
      expect(source, file).toContain("from './seed-lock.mjs'");
      expect(source, file).toContain('withItpTemplateSeedLock(prisma, main)');
    }
  });

  it('orchestrates only seeders that are directly guarded by the shared lock', async () => {
    const source = await readFile(resolve(seedDir, 'index.mjs'), 'utf8');
    const guardedFiles = (await readdir(seedDir))
      .filter((file) => file.startsWith('seed-itp-templates-') && file.endsWith('.js'))
      .sort();
    const orchestratedFiles = [...source.matchAll(/file: '(seed-itp-templates-[^']+\.js)'/g)]
      .map((match) => match[1])
      .sort();

    expect(orchestratedFiles).toEqual(guardedFiles);
  });
});
