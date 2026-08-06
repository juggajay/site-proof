import { writeFileSync } from 'node:fs';
import { it, vi } from 'vitest';
import { downloadChecklistPdf } from '../../pdfGenerator';
import {
  mixedStateChecklistFixture,
  provenanceChecklistFixture,
  longChecklistFixture,
} from './fixtures';
import { renderPdf, readPdfLayout } from './pdfRenderHarness';

vi.mock('../pdfSave', async () => ({
  savePdf: (await import('./pdfRenderHarness')).captureDoc,
}));

const OUT = process.env.DUMP_DIR!;
const PIN = new Date('2026-07-31T04:00:00.000Z');

function textOf(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const out: string[] = [];
  for (const block of raw.matchAll(/BT\n([\s\S]*?)ET/g)) {
    for (const m of (block[1] ?? '').matchAll(/\((.*?)\)\s*Tj/g)) out.push(m[1]!);
  }
  return out.join('\n');
}

it('dumps', async () => {
  for (const [name, fx] of [
    ['mixed', mixedStateChecklistFixture],
    ['prov', provenanceChecklistFixture],
    ['long', longChecklistFixture],
  ] as const) {
    for (const variant of ['electronic', 'field'] as const) {
      const buf = await renderPdf(() => downloadChecklistPdf(fx, variant, PIN));
      writeFileSync(`${OUT}/cl-${name}-${variant}.pdf`, buf);
      writeFileSync(`${OUT}/cl-${name}-${variant}.txt`, textOf(buf));
      const layout = readPdfLayout(buf);
      writeFileSync(`${OUT}/cl-${name}-${variant}.layout.json`, JSON.stringify(layout, null, 1));
    }
  }
}, 120000);
