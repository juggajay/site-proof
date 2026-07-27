/**
 * Wave B B2 — the runnable self-check for PDF ITP import.
 *
 * Drives a real PDF upload through the whole pipeline: upload → model read →
 * derived column mapping → dry run → one proposal → apply, plus the page-window
 * chunking, the 10 MB AI sub-cap, the page cap and the upload threat model.
 * The model is the only thing stubbed; everything else is the shipped code.
 *
 * If PDF import breaks, this fails.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../../lib/prisma.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import { registerTestUser } from '../../../test/routeTestHarness.js';
import { authRouter } from '../../auth.js';
import { copilotRouter } from '../index.js';
import { computeLotRegisterDryRun } from './lotRegisterDryRun.js';
import { deriveFieldMapFromHeaders, LOT_IMPORT_TARGETS } from './mappingProfiles.js';
import {
  extractPdfGrid,
  MAX_PDF_AI_BYTES,
  MAX_PDF_PAGES,
  PDF_PAGES_PER_CHUNK,
  pdfSheetName,
} from './pdfExtraction.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', copilotRouter);
app.use(errorHandler);

/** A byte-valid PDF as far as the magic-byte gate is concerned. */
function pdfBuffer(sizeBytes = 2048): Buffer {
  const head = Buffer.from('%PDF-1.4\n% siteproof import fixture\n', 'ascii');
  const tail = Buffer.from('\ntrailer\n<<>>\n%%EOF\n', 'ascii');
  const padding = Buffer.alloc(Math.max(0, sizeBytes - head.length - tail.length), 0x20);
  return Buffer.concat([head, padding, tail]);
}

/** One Anthropic `POST /v1/messages` reply carrying the model's JSON answer. */
function modelReply(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] }),
  } as unknown as Response;
}

const ITP_ROWS = [
  {
    templateName: 'ITP-01 Subgrade',
    templateDescription: 'Subgrade preparation and proof rolling',
    activityType: 'Earthworks',
    stateSpec: 'TfNSW',
    specificationReference: 'R44 5.2',
    description: 'Proof roll the prepared subgrade',
    acceptanceCriteria: 'No visible deformation under a loaded truck',
    pointType: 'Hold Point',
    responsibleParty: 'Superintendent',
    evidenceRequired: 'Inspection record',
    testType: 'Proof roll',
  },
  {
    templateName: 'ITP-01 Subgrade',
    activityType: 'Earthworks',
    stateSpec: 'TfNSW',
    description: 'Survey the subgrade surface level',
    acceptanceCriteria: 'Within +0 / -25 mm of design',
    pointType: 'W',
    responsibleParty: 'Contractor',
    evidenceRequired: 'Survey record',
    testType: 'Level survey',
  },
  {
    // Activity folds to `none` — must be BLOCKED, never defaulted (§4.10d).
    templateName: 'ITP-02 Kerbing',
    activityType: 'Kerbing',
    stateSpec: 'TfNSW',
    description: 'Check kerb line and level before pour',
    acceptanceCriteria: 'Within 10 mm of string line',
    pointType: 'W',
    responsibleParty: 'Contractor',
    evidenceRequired: 'Survey record',
    testType: 'Level survey',
  },
];

describe('Wave B B2 — PDF import', () => {
  let apiKeyBefore: string | undefined;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    apiKeyBefore = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-for-pdf-import';
  });

  afterAll(() => {
    if (apiKeyBefore === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = apiKeyBefore;
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // Reading the PDF (no database)
  // -------------------------------------------------------------------------

  describe('reading a PDF into the shared grid', () => {
    it('§6-B2: emits ONE sheet whose headers are the import targets themselves', async () => {
      fetchMock.mockResolvedValue(modelReply({ totalPages: 4, rows: ITP_ROWS }));

      const grid = await extractPdfGrid(
        {
          buffer: pdfBuffer(),
          originalname: 'MC10 ITP Pack.pdf',
          mimetype: 'application/pdf',
        } as Express.Multer.File,
        'itp_template',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(grid.sheets).toHaveLength(1);
      expect(grid.sheets[0].name).toBe('MC10 ITP Pack');
      expect(grid.sheets[0].headers).toContain('acceptanceCriteria');
      expect(grid.sheets[0].rows).toHaveLength(3);
      // Values arrive verbatim — the shared transforms fold them, not the model.
      expect(grid.sheets[0].rows[0]).toContain('Hold Point');

      // Those headers resolve against the SHIPPED alias table, so no
      // PDF-specific mapping profile has to exist.
      const derived = deriveFieldMapFromHeaders(grid.sheets[0].headers, 'itp_template');
      expect(derived).toHaveLength(grid.sheets[0].headers.length);
      expect(derived.find((entry) => entry.target === 'pointType')?.transform).toBe(
        'whs_to_point_type',
      );
    });

    it('§4.4: reads long documents in page windows, one model call each, merged in order', async () => {
      fetchMock
        .mockResolvedValueOnce(modelReply({ totalPages: 55, rows: [{ description: 'page 1-20' }] }))
        .mockResolvedValueOnce(
          modelReply({ totalPages: 55, rows: [{ description: 'page 21-40' }] }),
        )
        .mockResolvedValueOnce(
          modelReply({ totalPages: 55, rows: [{ description: 'page 41-60' }] }),
        );

      const grid = await extractPdfGrid(
        {
          buffer: pdfBuffer(),
          originalname: 'register.pdf',
          mimetype: 'application/pdf',
        } as Express.Multer.File,
        'itp_template',
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const prompts = fetchMock.mock.calls.map((call) => {
        const body = JSON.parse((call[1] as { body: string }).body);
        return body.messages[0].content[1].text as string;
      });
      expect(prompts[0]).toContain(`pages 1 to ${PDF_PAGES_PER_CHUNK}`);
      expect(prompts[1]).toContain('pages 21 to 40');
      expect(prompts[2]).toContain('pages 41 to 60');

      // Every window is still ONE sheet, so a template spanning a window
      // boundary groups as one template rather than colliding with itself.
      expect(grid.sheets).toHaveLength(1);
      const descriptionIndex = grid.sheets[0].headers.indexOf('description');
      expect(grid.sheets[0].rows.map((row) => row[descriptionIndex])).toEqual([
        'page 1-20',
        'page 21-40',
        'page 41-60',
      ]);

      // Windows after the first read the cached document instead of re-billing it.
      const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(firstBody.messages[0].content[0]).toMatchObject({
        type: 'document',
        cache_control: { type: 'ephemeral' },
      });
    });

    it('§9-D1: refuses a PDF over the 10 MB AI sub-cap before any model call', async () => {
      await expect(
        extractPdfGrid(
          {
            buffer: pdfBuffer(MAX_PDF_AI_BYTES + 1024),
            originalname: 'huge.pdf',
            mimetype: 'application/pdf',
          } as Express.Multer.File,
          'itp_template',
        ),
      ).rejects.toThrow(/split it into smaller files/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('§3.5 grammar: refuses a document past the page cap rather than truncating it', async () => {
      fetchMock.mockResolvedValue(modelReply({ totalPages: MAX_PDF_PAGES + 50, rows: ITP_ROWS }));

      await expect(
        extractPdfGrid(
          {
            buffer: pdfBuffer(),
            originalname: 'book.pdf',
            mimetype: 'application/pdf',
          } as Express.Multer.File,
          'itp_template',
        ),
      ).rejects.toThrow(/Split it into smaller files/i);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reads a lot register from PDF through the same path', async () => {
      fetchMock.mockResolvedValue(
        modelReply({
          totalPages: 2,
          rows: [
            {
              lotNumber: 'LOT-001',
              description: 'Subgrade CH 100 to 200',
              activityType: 'Earthworks',
              chainageStart: '100',
              chainageEnd: '200',
              layer: 'Subgrade',
              itpTemplateName: 'ITP-01 Subgrade',
            },
          ],
        }),
      );

      const grid = await extractPdfGrid(
        {
          buffer: pdfBuffer(),
          originalname: 'lots.pdf',
          mimetype: 'application/pdf',
        } as Express.Multer.File,
        'lot_register',
      );
      expect(grid.sheets[0].headers).toEqual([...LOT_IMPORT_TARGETS]);

      const fieldMap = deriveFieldMapFromHeaders(grid.sheets[0].headers, 'lot_register');
      // Including `itpTemplateName`, which the alias table now covers.
      expect(fieldMap.map((entry) => entry.target)).toContain('itpTemplateName');

      const result = computeLotRegisterDryRun({
        grid,
        fieldMap,
        project: { state: 'NSW', specificationSet: 'TfNSW' },
        existingLots: [],
        templates: [{ id: 'tpl-1', name: 'ITP-01 Subgrade' }],
      });
      expect(result.dryRun.canApply).toBe(true);
      expect(result.lots).toHaveLength(1);
      expect(result.lots[0]).toMatchObject({
        lotNumber: 'LOT-001',
        chainageStart: 100,
        chainageEnd: 200,
        itpTemplateId: 'tpl-1',
      });
    });

    it('names the sheet after the file', () => {
      expect(pdfSheetName('C:/tmp/ITP Pack v2.PDF')).toBe('ITP Pack v2');
      expect(pdfSheetName('.pdf')).toBe('Document');
    });
  });

  // -------------------------------------------------------------------------
  // End to end through the shipped routes
  // -------------------------------------------------------------------------

  describe('end to end', () => {
    let companyId: string;
    let projectId: string;
    let pmToken: string;

    async function upload(file: Buffer, filename = 'itps.pdf', mime = 'application/pdf') {
      return request(app)
        .post(`/api/projects/${projectId}/copilot/imports`)
        .set('Authorization', `Bearer ${pmToken}`)
        .attach('file', file, { filename, contentType: mime });
    }

    beforeAll(async () => {
      const stamp = Date.now();
      companyId = (await prisma.company.create({ data: { name: `Pdf Co ${stamp}` } })).id;
      const pm = await registerTestUser(app, {
        emailPrefix: 'pdf-pm',
        fullName: 'pdf-pm',
        companyId,
        roleInCompany: 'project_manager',
      });
      pmToken = pm.token;
      projectId = (
        await prisma.project.create({
          data: {
            name: `Pdf Project ${stamp}`,
            projectNumber: `PDF-${stamp}`,
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

    beforeEach(async () => {
      await prisma.aiProposal.deleteMany({ where: { projectId } });
      await prisma.iTPTemplate.deleteMany({ where: { projectId } });
      await prisma.importBatch.deleteMany({ where: { projectId } });
      await prisma.document.deleteMany({ where: { projectId } });
    });

    afterAll(async () => {
      await prisma.aiProposal.deleteMany({ where: { projectId } });
      await prisma.iTPTemplate.deleteMany({ where: { projectId } });
      await prisma.importBatch.deleteMany({ where: { projectId } });
      await prisma.document.deleteMany({ where: { projectId } });
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    });

    it('AT1/AT4/AT17: PDF → dry-run counts → one proposal → private-tenant templates', async () => {
      fetchMock.mockResolvedValue(modelReply({ totalPages: 6, rows: ITP_ROWS }));

      // 1. Upload. The source PDF is persisted for provenance, out of the
      //    client-visible register.
      const uploaded = await upload(pdfBuffer());
      expect(uploaded.status).toBe(201);
      const batchId = uploaded.body.batch.id as string;
      expect(uploaded.body.sheets).toEqual([
        { name: 'itps', headers: expect.any(Array), rowCount: 3 },
      ]);

      const batchRow = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
      expect(batchRow.status).toBe('parsed');
      expect(batchRow.sourceFormat).toBe('pdf');
      const sourceDoc = await prisma.document.findUniqueOrThrow({
        where: { id: batchRow.sourceDocumentId! },
      });
      expect(sourceDoc.documentType).toBe('import_source');
      expect(sourceDoc.mimeType).toBe('application/pdf');

      // 2. Dry run on the derived column map — counts BEFORE any write, with the
      //    unresolvable-activity template blocked (§4.10d).
      const dryRunBody = {
        fieldMap: uploaded.body.suggestedFieldMap,
        resolutions: {} as Record<string, unknown>,
      };
      const blocked = await request(app)
        .post(`/api/projects/${projectId}/copilot/imports/${batchId}/dry-run`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send(dryRunBody);
      expect(blocked.status).toBe(200);
      expect(blocked.body.dryRun.unmappedHeaders).toEqual([]);
      expect(blocked.body.dryRun.counts).toMatchObject({ willCreate: 1, blocked: 1 });
      expect(blocked.body.dryRun.canApply).toBe(false);
      expect(
        blocked.body.dryRun.rows.find((row: { key: string }) => row.key === 'itps::ITP-02 Kerbing'),
      ).toMatchObject({ outcome: 'blocked', reason: 'unresolvable_activity' });

      // 3. The reviewer resolves it — never a default.
      const resolutions = { 'itps::ITP-02 Kerbing': { activitySlug: 'kerb_channel' } };
      const resolved = await request(app)
        .post(`/api/projects/${projectId}/copilot/imports/${batchId}/dry-run`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ fieldMap: uploaded.body.suggestedFieldMap, resolutions });
      expect(resolved.status).toBe(200);
      expect(resolved.body.dryRun.canApply).toBe(true);
      expect(resolved.body.dryRun.counts.willCreate).toBe(2);

      // 4. One proposal per batch, then the existing decision route applies it.
      const review = await request(app)
        .post(`/api/projects/${projectId}/copilot/imports/${batchId}/proposal`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ resolutions });
      expect(review.status).toBe(201);
      const proposalId = review.body.proposalId as string;

      const decided = await request(app)
        .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/decision`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ action: 'accept' });
      expect(decided.status).toBe(200);

      const templates = await prisma.iTPTemplate.findMany({
        where: { projectId },
        include: { checklistItems: true },
        orderBy: { name: 'asc' },
      });
      expect(templates.map((t) => t.name)).toEqual(['ITP-01 Subgrade', 'ITP-02 Kerbing']);
      // Private-tenant, never the global library (§1 non-goal).
      expect(templates.every((t) => t.projectId === projectId)).toBe(true);
      const subgrade = templates[0];
      expect(subgrade.activityType).toBe('earthworks_general');
      expect(subgrade.checklistItems).toHaveLength(2);
      expect(subgrade.checklistItems.map((i) => i.pointType).sort()).toEqual([
        'hold_point',
        'witness',
      ]);
      expect(subgrade.checklistItems[0].acceptanceCriteria).toBe(
        'No visible deformation under a loaded truck',
      );
    });

    it('AT15: a renamed non-PDF fails the magic-byte gate, and other formats are refused', async () => {
      // PK\x03\x04 (a zip) wearing a .pdf name and MIME type.
      const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
      const spoofed = await upload(zip, 'itps.pdf', 'application/pdf');
      expect(spoofed.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();

      const wrongFormat = await upload(
        pdfBuffer(),
        'itps.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(wrongFormat.status).toBe(400);
      expect(wrongFormat.body.error.message).toMatch(/\.xlsx spreadsheets and \.pdf documents/);

      expect(await prisma.importBatch.count({ where: { projectId } })).toBe(0);
    });
  });
});
