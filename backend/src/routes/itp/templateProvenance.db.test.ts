/**
 * Wave G G2 §2.4 — the DB-backed acceptance tests.
 *
 * AT-G9  clone lineage (template AND item level) plus the `notes` fix
 * AT-G10 an imported template resolves to its source document in one join
 * AT-G13 `/compare` returns what `diffChecklistItems` returns
 * AT-G14 superseding a global template leaves every snapshot byte-identical
 * AT-G15 cross-tenant compare is 404, not 403 — no existence disclosure
 */

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { seedGlobalTemplate } from '../../../scripts/seeds/itp-templates/seed-writer.mjs';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { diffChecklistItems } from '../copilot/import/itpImportDryRun.js';
import {
  IMPORT_ITP_TEMPLATES_STAGE,
  importItpTemplatesPayloadSchema,
} from '../copilot/import/itpTemplateImportExecutor.js';
import { applyHandlers } from '../copilot/proposalService.js';
import { itpRouter } from './index.js';
import { buildTemplateSnapshot } from './helpers/templateSnapshot.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/itp', itpRouter);
app.use(errorHandler);

// The provenance module knows this template, which is what makes the supersede
// branch reachable without inventing a second provenance table for tests.
const MRWA_EARTHWORKS = 'Earthworks (MRWA Spec 302)';
const MRWA_EARTHWORKS_EDITION = '04/10099-03';

const tag = `g2-${Date.now()}`;

describe('Wave G G2 — ITP template provenance, lineage and compare', () => {
  let companyId: string;
  let otherCompanyId: string;
  let projectId: string;
  let otherProjectId: string;
  let userId: string;
  let token: string;
  let foremanToken: string;
  let sourceTemplateId: string;

  beforeAll(async () => {
    process.env.ITP_PROVENANCE_ENABLED = 'true';

    const company = await prisma.company.create({ data: { name: `G2 Co ${tag}` } });
    companyId = company.id;
    const otherCompany = await prisma.company.create({ data: { name: `G2 Other Co ${tag}` } });
    otherCompanyId = otherCompany.id;

    const admin = await registerTestUser(app, {
      emailPrefix: `g2-admin-${tag}`,
      fullName: 'G2 Admin',
      companyId,
      roleInCompany: 'admin',
    });
    token = admin.token;
    userId = admin.userId;

    const foreman = await registerTestUser(app, {
      emailPrefix: `g2-foreman-${tag}`,
      fullName: 'G2 Foreman',
      companyId,
      roleInCompany: 'member',
    });
    foremanToken = foreman.token;

    const project = await prisma.project.create({
      data: {
        name: `G2 Project ${tag}`,
        projectNumber: `G2-${tag}`,
        companyId,
        status: 'active',
        state: 'WA',
        specificationSet: 'MRWA',
      },
    });
    projectId = project.id;

    const otherProject = await prisma.project.create({
      data: {
        name: `G2 Other Project ${tag}`,
        projectNumber: `G2O-${tag}`,
        companyId: otherCompanyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    otherProjectId = otherProject.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    });

    const source = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: `Corporate Master ${tag}`,
        activityType: 'earthworks_general',
        specificationReference: 'MRWA Spec 302',
        stateSpec: 'MRWA',
        authority: 'MRWA',
        specEdition: MRWA_EARTHWORKS_EDITION,
        checklistItems: {
          create: [
            {
              sequenceNumber: 1,
              description: 'Proof roll the subgrade',
              acceptanceCriteria: 'No visible deflection',
              pointType: 'hold_point',
              notes: 'MRWA Spec 302.09 HOLD.',
            },
            {
              sequenceNumber: 2,
              description: 'Density testing',
              acceptanceCriteria: '98% Rc',
              pointType: 'standard',
              notes: 'WA 133.1.',
            },
          ],
        },
      },
    });
    sourceTemplateId = source.id;
  });

  afterAll(async () => {
    delete process.env.ITP_PROVENANCE_ENABLED;
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId: otherProjectId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId: null, name: MRWA_EARTHWORKS } });
    await prisma.aiProposal.deleteMany({ where: { projectId } });
    await prisma.importBatch.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  // ------------------------------------------------------------------ AT-G9

  describe('AT-G9 clone lineage', () => {
    it('AT-G9 preserves notes and records template- and item-level lineage', async () => {
      const res = await request(app)
        .post(`/api/itp/templates/${sourceTemplateId}/clone`)
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId, name: `Controlled Copy ${tag}` });

      expect(res.status).toBe(201);

      const clone = await prisma.iTPTemplate.findUniqueOrThrow({
        where: { id: res.body.template.id },
        include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
      });

      expect(clone.sourceTemplateId).toBe(sourceTemplateId);
      // The provenance travels with the controlled copy.
      expect(clone.authority).toBe('MRWA');
      expect(clone.specEdition).toBe(MRWA_EARTHWORKS_EDITION);

      // The clause citations that vanished on every copy before G2.
      expect(clone.checklistItems.map((item) => item.notes)).toEqual([
        'MRWA Spec 302.09 HOLD.',
        'WA 133.1.',
      ]);

      const source = await prisma.iTPChecklistItem.findMany({
        where: { templateId: sourceTemplateId },
        orderBy: { sequenceNumber: 'asc' },
      });
      expect(clone.checklistItems.map((item) => item.sourceChecklistItemId)).toEqual(
        source.map((item) => item.id),
      );
    }, 60_000);

    it('AT-G9 resolves a clone of a clone to the same root item id', async () => {
      const first = await request(app)
        .post(`/api/itp/templates/${sourceTemplateId}/clone`)
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId, name: `Chain A ${tag}` });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/itp/templates/${first.body.template.id}/clone`)
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId, name: `Chain B ${tag}` });
      expect(second.status).toBe(201);

      const leaf = await prisma.iTPChecklistItem.findFirstOrThrow({
        where: { templateId: second.body.template.id, sequenceNumber: 1 },
      });

      // Walk to the root. Each hop is the IMMEDIATE parent, never a
      // description match — identity is never guessed from text.
      let current = leaf;
      const seen = new Set<string>([current.id]);
      while (current.sourceChecklistItemId && !seen.has(current.sourceChecklistItemId)) {
        seen.add(current.sourceChecklistItemId);
        current = await prisma.iTPChecklistItem.findUniqueOrThrow({
          where: { id: current.sourceChecklistItemId },
        });
      }

      const rootSource = await prisma.iTPChecklistItem.findFirstOrThrow({
        where: { templateId: sourceTemplateId, sequenceNumber: 1 },
      });
      expect(current.id).toBe(rootSource.id);
      expect(seen.size).toBe(3);
    }, 60_000);

    it('AT-G9 refuses a second copy of the same edition under the same name', async () => {
      const name = `Duplicate Edition ${tag}`;
      const first = await request(app)
        .post(`/api/itp/templates/${sourceTemplateId}/clone`)
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId, name });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/itp/templates/${sourceTemplateId}/clone`)
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId, name });
      expect(second.status).toBe(400);
      expect(second.body.error.message).toMatch(/already has a template named/);
      expect(await prisma.iTPTemplate.count({ where: { projectId, name } })).toBe(1);
    }, 60_000);
  });

  // ----------------------------------------------------------------- AT-G10

  describe('AT-G10 import lineage', () => {
    it('AT-G10 carries importBatchId resolving to the batch whose sourceDocumentId is the upload', async () => {
      const document = await prisma.document.create({
        data: {
          projectId,
          documentType: 'itp',
          filename: `register-${tag}.xlsx`,
          fileUrl: `supabase://documents/${tag}.xlsx`,
          uploadedById: userId,
        },
      });
      const batch = await prisma.importBatch.create({
        data: {
          kind: 'itp_template',
          status: 'review',
          projectId,
          sourceFormat: 'excel',
          sourceDocumentId: document.id,
          createdById: userId,
        },
      });
      const proposal = await prisma.aiProposal.create({
        data: {
          projectId,
          stage: IMPORT_ITP_TEMPLATES_STAGE,
          requestedById: userId,
          model: 'test',
          sourceRefs: [],
          payload: {},
          importBatchId: batch.id,
        },
      });

      const payload = importItpTemplatesPayloadSchema.parse({
        templates: [
          {
            key: `imported::${tag}`,
            name: `Imported ITP ${tag}`,
            activityType: 'earthworks_general',
            specAffirmed: false,
            checklistItems: [{ description: 'An imported inspection item' }],
          },
        ],
      });

      const groups = await prisma.$transaction((tx) =>
        applyHandlers[IMPORT_ITP_TEMPLATES_STAGE](tx, proposal, payload, { userId }),
      );

      const createdId = groups[0].ids[0];
      const created = await prisma.iTPTemplate.findUniqueOrThrow({
        where: { id: createdId },
        include: { importBatch: { select: { sourceDocumentId: true } } },
      });

      expect(created.importBatchId).toBe(batch.id);
      expect(created.importBatch?.sourceDocumentId).toBe(document.id);
      // An import has no source TEMPLATE — its rows came from a spreadsheet.
      expect(created.sourceTemplateId).toBeNull();
    }, 60_000);
  });

  // ----------------------------------------------------------- AT-G13/AT-G15

  describe('compare endpoint', () => {
    let againstId: string;

    beforeAll(async () => {
      const against = await prisma.iTPTemplate.create({
        data: {
          projectId,
          name: `Compare Target ${tag}`,
          activityType: 'earthworks_general',
          stateSpec: 'MRWA',
          authority: 'MRWA',
          specEdition: '04/10099-04',
          changeSummary: 'Proof-roll acceptance tightened.',
          checklistItems: {
            create: [
              {
                sequenceNumber: 1,
                description: 'Proof roll the subgrade',
                acceptanceCriteria: 'No deflection above 5mm',
                pointType: 'hold_point',
              },
              { sequenceNumber: 2, description: 'Moisture conditioning', pointType: 'standard' },
            ],
          },
        },
      });
      againstId = against.id;
    });

    it('AT-G13 returns a ChecklistDiff matching diffChecklistItems on the same inputs', async () => {
      const res = await request(app)
        .get(`/api/itp/templates/${sourceTemplateId}/compare`)
        .query({ against: againstId, projectId })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const [base, against] = await Promise.all(
        [sourceTemplateId, againstId].map((id) =>
          prisma.iTPChecklistItem.findMany({
            where: { templateId: id },
            orderBy: { sequenceNumber: 'asc' },
            select: { description: true, acceptanceCriteria: true, pointType: true },
          }),
        ),
      );
      const expected = diffChecklistItems(base, against);

      expect(res.body.checklist).toEqual(expected);
      expect(res.body.checklist.changed).toBe(1);
      expect(res.body.checklist.added).toBe(1);
      expect(res.body.checklist.removed).toBe(1);

      const metadata = Object.fromEntries(
        res.body.metadata.map((row: { field: string; against: unknown }) => [
          row.field,
          row.against,
        ]),
      );
      expect(metadata.specEdition).toBe('04/10099-04');
      expect(metadata.changeSummary).toBe('Proof-roll acceptance tightened.');
      // The inherited pairing limitation is STATED, not silently carried.
      expect(res.body.descriptionPairing).toMatch(/paired by description/);
    }, 60_000);

    it('AT-G15 returns 404, not 403, when comparing against another company template', async () => {
      const foreign = await prisma.iTPTemplate.create({
        data: {
          projectId: otherProjectId,
          name: `Foreign ${tag}`,
          activityType: 'earthworks_general',
        },
      });

      const res = await request(app)
        .get(`/api/itp/templates/${sourceTemplateId}/compare`)
        .query({ against: foreign.id, projectId })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain(foreign.name);
    }, 60_000);

    it('AT-G15 refuses a foreman, per the §2.3 permission matrix', async () => {
      const res = await request(app)
        .get(`/api/itp/templates/${sourceTemplateId}/compare`)
        .query({ against: againstId, projectId })
        .set('Authorization', `Bearer ${foremanToken}`);

      expect(res.status).toBe(403);
    }, 60_000);

    it('404s entirely while ITP_PROVENANCE_ENABLED is off', async () => {
      delete process.env.ITP_PROVENANCE_ENABLED;
      try {
        const res = await request(app)
          .get(`/api/itp/templates/${sourceTemplateId}/compare`)
          .query({ against: againstId, projectId })
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
      } finally {
        process.env.ITP_PROVENANCE_ENABLED = 'true';
      }
    }, 60_000);
  });

  // ----------------------------------------------------------------- AT-G14

  describe('AT-G14 seeder supersession', () => {
    beforeEach(async () => {
      await prisma.iTPTemplate.deleteMany({ where: { projectId: null, name: MRWA_EARTHWORKS } });
      delete process.env.ITP_SEED_SUPERSEDE;
      delete process.env.ITP_SEED_RUN_LABEL;
    });

    const templateData = {
      name: MRWA_EARTHWORKS,
      description: 'MRWA earthworks',
      activityType: 'earthworks_general',
      specificationReference: 'MRWA Spec 302',
      stateSpec: 'MRWA',
      checklistItems: [
        {
          description: 'Proof roll the subgrade',
          acceptanceCriteria: 'No visible deflection',
          pointType: 'hold_point',
          responsibleParty: 'contractor',
          evidenceRequired: 'inspection',
          testType: null,
          notes: 'MRWA Spec 302.09 HOLD.',
        },
      ],
    };

    it('writes the provenance its own header cites, and is idempotent without --supersede', async () => {
      const first = await seedGlobalTemplate(prisma, templateData);
      expect(first.authority).toBe('MRWA');
      expect(first.specEdition).toBe(MRWA_EARTHWORKS_EDITION);
      expect(first.specIssuedOn?.toISOString()).toBe('2024-06-28T00:00:00.000Z');

      const second = await seedGlobalTemplate(prisma, templateData);
      expect(second.id).toBe(first.id);
      expect(
        await prisma.iTPTemplate.count({ where: { projectId: null, name: MRWA_EARTHWORKS } }),
      ).toBe(1);
    }, 60_000);

    it('AT-G14 leaves every existing ITPInstance.templateSnapshot byte-identical', async () => {
      // An older edition is already in the library, and a lot has been
      // inspected against it.
      const old = await prisma.iTPTemplate.create({
        data: {
          projectId: null,
          name: MRWA_EARTHWORKS,
          activityType: 'earthworks_general',
          stateSpec: 'MRWA',
          authority: 'MRWA',
          specEdition: '04/10099-02',
          checklistItems: {
            create: [{ sequenceNumber: 1, description: 'Proof roll', pointType: 'hold_point' }],
          },
        },
        include: { checklistItems: true },
      });

      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `L-${tag}`,
          lotType: 'roadworks',
          activityType: 'Earthworks',
        },
      });
      const frozen = JSON.stringify(buildTemplateSnapshot(old));
      await prisma.iTPInstance.create({
        data: { lotId: lot.id, templateId: old.id, templateSnapshot: frozen },
      });

      process.env.ITP_SEED_SUPERSEDE = '1';
      process.env.ITP_SEED_RUN_LABEL = `itp-seed-${tag}`;
      const created = await seedGlobalTemplate(prisma, templateData);

      expect(created.id).not.toBe(old.id);
      expect(created.specEdition).toBe(MRWA_EARTHWORKS_EDITION);

      const retired = await prisma.iTPTemplate.findUniqueOrThrow({ where: { id: old.id } });
      expect(retired.supersededById).toBe(created.id);
      expect(retired.supersededAt).not.toBeNull();
      expect(retired.supersededBySeedRun).toBe(`itp-seed-${tag}`);

      // The whole point: the conformed lot keeps exactly the bytes it had.
      const instance = await prisma.iTPInstance.findFirstOrThrow({ where: { lotId: lot.id } });
      expect(instance.templateSnapshot).toBe(frozen);
      expect(instance.templateId).toBe(old.id);

      await prisma.iTPInstance.deleteMany({ where: { lotId: lot.id } });
      await prisma.lot.delete({ where: { id: lot.id } });
    }, 60_000);

    it('AT-G14 supersedes at most once — a repeat run finds the new edition current', async () => {
      await prisma.iTPTemplate.create({
        data: {
          projectId: null,
          name: MRWA_EARTHWORKS,
          activityType: 'earthworks_general',
          stateSpec: 'MRWA',
          specEdition: '04/10099-02',
        },
      });

      process.env.ITP_SEED_SUPERSEDE = '1';
      const first = await seedGlobalTemplate(prisma, templateData);
      const second = await seedGlobalTemplate(prisma, templateData);

      expect(second.id).toBe(first.id);
      expect(
        await prisma.iTPTemplate.count({ where: { projectId: null, name: MRWA_EARTHWORKS } }),
      ).toBe(2);
    }, 60_000);
  });
});
