import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { zonedDateParts } from '../../lib/projectTimeZone.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import diaryRouter from './index.js';

// DB-backed route test: guards the WIRING of the diary QA auto-events pipeline
// end to end. diaryQaSync.test.ts unit-tests syncDiaryQaEvents in isolation; this
// asserts the diary READ routes actually invoke it and that the mapping carries
// `source: 'qa'` all the way through to the JSON the frontend consumes. Because
// the sync swallows its own errors, a broken endpoint→sync wiring would ship
// green without this coverage.
const SYDNEY = 'Australia/Sydney';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/diary', diaryRouter);
app.use(errorHandler);

describe('diary QA auto-events wiring (route level)', () => {
  let companyId: string;
  let projectId: string;
  let lotId: string;
  let diaryId: string;
  let foremanToken: string;
  let dateKey: string; // YYYY-MM-DD in the project's (Sydney) day

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `QA-Wire Co ${stamp}` } })).id;

    const foreman = await registerTestUser(app, {
      emailPrefix: 'qa-wire-foreman',
      fullName: 'QA Wire Foreman',
      companyId,
      roleInCompany: 'foreman',
    });
    foremanToken = foreman.token;

    const project = await prisma.project.create({
      data: {
        name: `QA-Wire Project ${stamp}`,
        projectNumber: `QW-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `QW-LOT-${stamp}`,
        lotType: 'roadworks',
        description: 'QA wiring lot',
        status: 'in_progress',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    // ITP activity: one passed + one failed checklist item completed TODAY.
    const template = await prisma.iTPTemplate.create({
      data: { name: 'Earthworks ITP', projectId },
    });
    const items = [];
    for (let i = 0; i < 2; i++) {
      items.push(
        await prisma.iTPChecklistItem.create({
          data: { templateId: template.id, sequenceNumber: i + 1, description: `Item ${i + 1}` },
        }),
      );
    }
    const instance = await prisma.iTPInstance.create({
      data: { lotId, templateId: template.id },
    });
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instance.id,
        checklistItemId: items[0].id,
        status: 'completed',
        completedAt: new Date(),
      },
    });
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instance.id,
        checklistItemId: items[1].id,
        status: 'failed',
        completedAt: new Date(),
      },
    });

    // An NCR raised today, linked to the lot.
    const ncr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: `NCR-${stamp}`,
        description: 'Compaction below spec',
        category: 'workmanship',
        severity: 'major',
        status: 'open',
        raisedAt: new Date(),
      },
    });
    await prisma.nCRLot.create({ data: { ncrId: ncr.id, lotId } });

    // Draft diary for today's project-local (Sydney) day. The sync only runs on
    // draft/unlocked diaries and scopes activity to the project time zone, so the
    // diary date must be the Sydney "today" midnight-UTC row.
    const parts = zonedDateParts(new Date(), SYDNEY);
    dateKey = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    const diary = await prisma.dailyDiary.create({
      data: {
        projectId,
        date: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)),
        status: 'draft',
      },
    });
    diaryId = diary.id;
  });

  afterAll(async () => {
    await prisma.diaryEvent.deleteMany({ where: { diary: { projectId } } });
    await prisma.dailyDiary.deleteMany({ where: { projectId } });
    await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lot: { projectId } } } });
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
    await prisma.iTPChecklistItem.deleteMany({ where: { template: { projectId } } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.nCRLot.deleteMany({ where: { lot: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('GET /:projectId/:date auto-compiles QA events with source "qa" and the ITP rollup', async () => {
    const res = await request(app)
      .get(`/api/diary/${projectId}/${dateKey}`)
      .set('Authorization', `Bearer ${foremanToken}`);

    expect(res.status).toBe(200);
    const events = res.body.events as Array<{
      eventType: string;
      description: string;
      source: string;
      lotId: string | null;
    }>;
    expect(Array.isArray(events)).toBe(true);

    // Wiring assertion: the endpoint invoked syncDiaryQaEvents and the mapping
    // carried `source` through to the response.
    const qaEvents = events.filter((e) => e.source === 'qa');
    expect(qaEvents.length).toBeGreaterThan(0);

    const rollup = events.find((e) => e.eventType === 'itp_progress');
    expect(rollup).toBeDefined();
    expect(rollup!.source).toBe('qa');
    expect(rollup!.description).toBe('ITP: 1 passed, 1 failed — Earthworks ITP');
    expect(rollup!.lotId).toBe(lotId);

    const ncrRaised = events.find((e) => e.eventType === 'ncr_raised');
    expect(ncrRaised).toBeDefined();
    expect(ncrRaised!.source).toBe('qa');
  });

  it('GET /:diaryId/timeline carries source "qa" through the timeline mapping', async () => {
    const res = await request(app)
      .get(`/api/diary/${diaryId}/timeline`)
      .set('Authorization', `Bearer ${foremanToken}`);

    expect(res.status).toBe(200);
    const timeline = res.body.timeline as Array<{
      type: string;
      description: string;
      data: { source?: string; eventType?: string };
    }>;
    expect(Array.isArray(timeline)).toBe(true);

    // The frontend Auto badge keys off entry.data.source !== 'manual'; assert the
    // timeline endpoint surfaces at least one auto-compiled event that way.
    const autoEvent = timeline.find((t) => t.type === 'event' && t.data.source === 'qa');
    expect(autoEvent).toBeDefined();
    expect(autoEvent!.data.eventType).toBe('itp_progress');
  });
});
