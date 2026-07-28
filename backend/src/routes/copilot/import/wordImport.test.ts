/**
 * Wave B B3 — the runnable self-check for Word ITP import.
 *
 * Drives a real `.docx` through the whole pipeline against the local test
 * database — upload → parse (in the worker) → map → dry-run → one proposal →
 * apply — and pins the two things that make Word different from Excel: the
 * worker-thread isolation boundary and the macro/format gate.
 *
 * If Word import breaks, this fails.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../../lib/prisma.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import { buildDocxFromBody, buildItpDocx, buildZip } from '../../../test/docxFixture.js';
import { registerTestUser } from '../../../test/routeTestHarness.js';
import { authRouter } from '../../auth.js';
import { copilotRouter } from '../index.js';
import { convertDocxToHtml, parseWordDocument, wordHtmlToGrid } from './wordParser.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', copilotRouter);
app.use(errorHandler);

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const AU_ITP_HEADERS = [
  'Activity',
  'Inspection / Test Activity',
  'Acceptance Criteria',
  'W/H/S',
  'Responsible',
  'Test Type',
];

/**
 * A Word ITP in the near-universal AU layout: a heading naming the ITP, then a
 * table led by a merged title banner above the real column names.
 */
function auItpDocx(): Buffer {
  return buildItpDocx([
    {
      heading: 'ITP-01 Subgrade Preparation',
      rows: [
        ['ITP-01 Subgrade Preparation — Revision 2', '', '', '', '', ''],
        AU_ITP_HEADERS,
        [
          'Earthworks',
          'Proof roll the prepared subgrade',
          'No visible deformation under a loaded truck',
          'H',
          'Superintendent',
          'Proof roll',
        ],
        [
          'Earthworks',
          'Survey the subgrade surface level',
          'Within +0 / -25 mm of design',
          'W',
          'Contractor',
          'Level survey',
        ],
      ],
    },
    {
      heading: 'ITP-02 Stormwater Drainage',
      rows: [
        AU_ITP_HEADERS,
        [
          'Drainage',
          'Check pipe grade before backfill',
          'Within 0.1% of design grade',
          'W',
          'Contractor',
          'Level survey',
        ],
      ],
    },
  ]);
}

describe('Wave B B3 — Word ITP import', () => {
  // -------------------------------------------------------------------------
  // Reading the document (no database)
  // -------------------------------------------------------------------------

  describe('reading a .docx into the shared grid', () => {
    it('§6-B3 / AT1: Word tables parse to the SAME normalized grid as Excel', async () => {
      const grid = await parseWordDocument(auItpDocx(), 'itp_template');

      // One sheet per table, named after the heading printed above it.
      expect(grid.sheets.map((sheet) => sheet.name)).toEqual([
        'ITP-01 Subgrade Preparation',
        'ITP-02 Stormwater Drainage',
      ]);
      // The merged title banner is dropped; the real column names win.
      expect(grid.sheets[0].headers).toEqual(AU_ITP_HEADERS);
      expect(grid.sheets[0].rows).toHaveLength(2);
      expect(grid.sheets[0].rows[0][1]).toBe('Proof roll the prepared subgrade');
      expect(grid.sheets[1].rows[0][0]).toBe('Drainage');
      // Every row is padded to the header width, so downstream indexing is safe.
      for (const sheet of grid.sheets) {
        for (const row of sheet.rows) expect(row).toHaveLength(sheet.headers.length);
      }
    });

    it('expands a horizontally merged cell so the columns to its right do not shift', () => {
      const grid = wordHtmlToGrid(
        '<table>' +
          '<tr><td colspan="2"><p>Activity</p></td><td><p>Acceptance Criteria</p></td></tr>' +
          '<tr><td><p>Earthworks</p></td><td><p>Trim</p></td><td><p>Level</p></td></tr>' +
          '</table>',
        'itp_template',
      );
      expect(grid.sheets[0].headers).toEqual(['Activity', 'Column 2', 'Acceptance Criteria']);
      expect(grid.sheets[0].rows[0]).toEqual(['Earthworks', 'Trim', 'Level']);
    });

    /**
     * M10: a Word ITP merges the Activity column down the checks it governs.
     * In HTML the slave rows simply have no `<td>` for it, so every column to
     * its right shifts LEFT — the acceptance criteria lands in the point-type
     * column and the "H" lands nowhere. Mirror of the colspan handling above.
     */
    it('repeats a vertically merged cell so the columns after it do not shift', () => {
      const grid = wordHtmlToGrid(
        '<table>' +
          '<tr><td><p>Activity</p></td><td><p>Check</p></td><td><p>W/H/S</p></td></tr>' +
          '<tr><td rowspan="3"><p>Earthworks</p></td><td><p>Proof roll</p></td><td><p>H</p></td></tr>' +
          '<tr><td><p>Survey level</p></td><td><p>W</p></td></tr>' +
          '<tr><td><p>Density test</p></td><td><p>S</p></td></tr>' +
          '<tr><td><p>Drainage</p></td><td><p>Pipe bedding</p></td><td><p>W</p></td></tr>' +
          '</table>',
        'itp_template',
      );

      expect(grid.sheets[0].headers).toEqual(['Activity', 'Check', 'W/H/S']);
      expect(grid.sheets[0].rows).toEqual([
        ['Earthworks', 'Proof roll', 'H'],
        ['Earthworks', 'Survey level', 'W'],
        ['Earthworks', 'Density test', 'S'],
        // The merge stops: row 5 keeps its own activity.
        ['Drainage', 'Pipe bedding', 'W'],
      ]);
    });

    it('handles a cell merged both down and across', () => {
      const grid = wordHtmlToGrid(
        '<table>' +
          '<tr><td><p>A</p></td><td><p>B</p></td><td><p>C</p></td><td><p>D</p></td></tr>' +
          '<tr><td rowspan="2" colspan="2"><p>Earthworks</p></td><td><p>Proof roll</p></td><td><p>H</p></td></tr>' +
          '<tr><td><p>Survey</p></td><td><p>W</p></td></tr>' +
          '</table>',
        'itp_template',
      );
      expect(grid.sheets[0].rows).toEqual([
        ['Earthworks', '', 'Proof roll', 'H'],
        ['Earthworks', '', 'Survey', 'W'],
      ]);
    });

    it('refuses a table-less document by name rather than importing nothing', async () => {
      await expect(
        parseWordDocument(
          buildDocxFromBody('<w:p><w:r><w:t>An ITP written as prose.</w:t></w:r></w:p>'),
          'itp_template',
        ),
      ).rejects.toThrow(/No tables could be read/i);
    });
  });

  // -------------------------------------------------------------------------
  // §8.4 worker isolation
  // -------------------------------------------------------------------------

  describe('§8.4 / AT15: the parser runs in a worker with a wall-clock timeout', () => {
    it('fails fast on a pathological document and leaves the process able to parse the next one', async () => {
      // ~40k table rows: enough that the conversion cannot finish inside the
      // 1 ms budget below, so the assertion is about the TIMEOUT, not luck.
      const rows = Array.from(
        { length: 40_000 },
        () => '<w:tr><w:tc><w:p><w:r><w:t>row</w:t></w:r></w:p></w:tc></w:tr>',
      ).join('');
      const pathological = buildDocxFromBody(`<w:tbl>${rows}</w:tbl>`);

      const startedAt = Date.now();
      await expect(convertDocxToHtml(pathological, 1)).rejects.toThrow(/took too long to read/i);
      // Fast, not "eventually": the request does not wait out the parse.
      expect(Date.now() - startedAt).toBeLessThan(5_000);

      // The API process is not wedged — the very next document still parses.
      const grid = await parseWordDocument(auItpDocx(), 'itp_template');
      expect(grid.sheets).toHaveLength(2);
    }, 30_000);

    it('§9-D6: the pinned @xmldom/xmldom floor holds (asserted here so CI catches a drop)', () => {
      // Resolved through MAMMOTH's own tree, which is what the `overrides` pin
      // in backend/package.json is there to control — a transitive bump that
      // dropped below the floor would show up here and nowhere else.
      const mammothEntry = createRequire(import.meta.url).resolve('mammoth');
      const manifest = createRequire(mammothEntry).resolve('@xmldom/xmldom/package.json');
      const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { version: string };
      const [major, minor, patch] = version.split('.').map(Number);
      // >= 0.8.13 — below that floor sit known XML parsing vulnerabilities.
      expect(major > 0 || minor > 8 || (minor === 8 && patch >= 13)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // End to end, against the database
  // -------------------------------------------------------------------------

  describe('through the shipped pipeline', () => {
    let companyId: string;
    let projectId: string;
    let pmToken: string;

    async function upload(file: Buffer, filename = 'itps.docx', mime = DOCX_MIME) {
      return request(app)
        .post(`/api/projects/${projectId}/copilot/imports`)
        .set('Authorization', `Bearer ${pmToken}`)
        .attach('file', file, { filename, contentType: mime });
    }

    async function cleanup() {
      await prisma.aiProposal.deleteMany({ where: { projectId } });
      await prisma.iTPTemplate.deleteMany({ where: { projectId } });
      await prisma.importBatch.deleteMany({ where: { projectId } });
      await prisma.document.deleteMany({ where: { projectId } });
    }

    beforeAll(async () => {
      const stamp = Date.now();
      companyId = (await prisma.company.create({ data: { name: `Word Co ${stamp}` } })).id;
      const pm = await registerTestUser(app, {
        emailPrefix: 'word-pm',
        fullName: 'word-pm',
        companyId,
        roleInCompany: 'project_manager',
      });
      pmToken = pm.token;
      projectId = (
        await prisma.project.create({
          data: {
            name: `Word Project ${stamp}`,
            projectNumber: `WORD-${stamp}`,
            companyId,
            status: 'active',
            state: 'NSW',
            specificationSet: 'TfNSW',
          },
        })
      ).id;
      await prisma.projectUser.create({
        data: { projectId, userId: pm.userId, role: 'project_manager', status: 'active' },
      });
    });

    beforeEach(cleanup);

    afterAll(async () => {
      await cleanup();
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    });

    it('§6-B3 / AT1: a Word ITP lands as private-tenant templates through the Excel path', async () => {
      const uploaded = await upload(auItpDocx());
      expect(uploaded.status).toBe(201);
      const batchId = uploaded.body.batch.id as string;

      const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
      expect(batch.sourceFormat).toBe('word');
      expect(batch.status).toBe('parsed');

      // The alias table resolves the Word columns, so no Word-specific mapping
      // profile has to exist — the same claim B2 makes for PDF.
      const fieldMap = uploaded.body.suggestedFieldMap as { target: string }[];
      expect(fieldMap.map((entry) => entry.target)).toEqual(
        expect.arrayContaining([
          'activityType',
          'description',
          'acceptanceCriteria',
          'pointType',
          'responsibleParty',
          'testType',
        ]),
      );

      const dry = await request(app)
        .post(`/api/projects/${projectId}/copilot/imports/${batchId}/dry-run`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ fieldMap });
      expect(dry.status).toBe(200);
      expect(dry.body.dryRun.canApply).toBe(true);
      // "Earthworks" folds exact -> create; "Drainage" folds to family level ->
      // flagged for a look but still applied. Two templates either way.
      expect(dry.body.dryRun.counts).toMatchObject({ willCreate: 1, ambiguous: 1, blocked: 0 });

      const review = await request(app)
        .post(`/api/projects/${projectId}/copilot/imports/${batchId}/proposal`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({});
      expect(review.status).toBe(201);

      const decided = await request(app)
        .post(`/api/projects/${projectId}/copilot/proposals/${review.body.proposalId}/decision`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ action: 'accept' });
      expect(decided.status).toBe(200);

      const templates = await prisma.iTPTemplate.findMany({
        where: { projectId },
        include: { checklistItems: true },
        orderBy: { name: 'asc' },
      });
      expect(templates.map((template) => template.name)).toEqual([
        'ITP-01 Subgrade Preparation',
        'ITP-02 Stormwater Drainage',
      ]);
      // Private-tenant, never the global library (§1 non-goal).
      expect(templates.every((template) => template.projectId === projectId)).toBe(true);
      expect(templates[0].activityType).toBe('earthworks_general');
      expect(templates[0].checklistItems).toHaveLength(2);
      expect(templates[0].checklistItems.map((item) => item.pointType).sort()).toEqual([
        'hold_point',
        'witness',
      ]);
    }, 30_000);

    it('§8.3 / AT15: macro-enabled Word is refused by extension AND by the macro part', async () => {
      const byExtension = await upload(auItpDocx(), 'macros.docm', DOCX_MIME);
      expect(byExtension.status).toBe(400);
      expect(byExtension.body.error.message).toMatch(/Macro-enabled Office files/);

      // Renamed back to .docx, the archive's own vbaProject.bin still refuses it.
      const macroCarrier = buildZip({
        '[Content_Types].xml': '<Types/>',
        'word/vbaProject.bin': 'MZ payload',
        'word/document.xml': '<w:document/>',
      });
      const byPart = await upload(macroCarrier, 'sneaky.docx', DOCX_MIME);
      expect(byPart.status).toBe(400);
      expect(byPart.body.error.message).toMatch(/Macro-enabled Office files/);

      expect(await prisma.importBatch.count({ where: { projectId } })).toBe(0);
    });
  });
});
