import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { AI_EXTRACTION_TIMEOUT_MS } from '../testResults/certificateExtraction.js';
import { createProposal, decideProposal, rollbackProposal } from './proposalService.js';
import {
  PROJECT_FACTS_STAGE,
  cleanProjectFactsCandidate,
  extractProjectFactsRawCandidate,
} from './projectFactsExtraction.js';

vi.mock('../../lib/fetchWithTimeout.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';

describe('cleanProjectFactsCandidate', () => {
  it('trims facts, derives the spec set from a valid state, and reports the page', () => {
    const { candidate, warnings, page } = cleanProjectFactsCandidate({
      projectName: '  Pacific Highway Upgrade  ',
      projectNumber: 'PH-2024-118',
      clientName: 'Transport for NSW',
      state: 'nsw',
      page: 1,
    });

    expect(candidate).toEqual({
      projectName: 'Pacific Highway Upgrade',
      projectNumber: 'PH-2024-118',
      clientName: 'Transport for NSW',
      state: 'NSW',
      specificationSet: 'TfNSW',
    });
    expect(warnings).toEqual([]);
    expect(page).toBe(1);
  });

  it('nulls an unrecognised state with a warning and falls back to the neutral spec set', () => {
    const { candidate, warnings } = cleanProjectFactsCandidate({
      projectName: 'Ring Road',
      state: 'Auckland',
    });

    expect(candidate.state).toBeNull();
    expect(candidate.specificationSet).toBe('Austroads');
    expect(warnings.some((w) => w.includes('Auckland'))).toBe(true);
  });

  it('caps overly long strings and treats sentinel values as null', () => {
    const longName = 'x'.repeat(300);
    const { candidate } = cleanProjectFactsCandidate({
      projectName: longName,
      projectNumber: 'N/A',
      clientName: 'unknown',
      state: 'QLD',
    });

    expect(candidate.projectName).toHaveLength(120);
    expect(candidate.projectNumber).toBeNull();
    expect(candidate.clientName).toBeNull();
    expect(candidate.specificationSet).toBe('MRTS');
  });

  it('warns and tolerates a garbage root when nothing is readable', () => {
    const { candidate, warnings } = cleanProjectFactsCandidate('not-an-object');
    expect(candidate.projectName).toBeNull();
    expect(candidate.state).toBeNull();
    expect(warnings.some((w) => w.includes('No project facts'))).toBe(true);
  });
});

describe('extractProjectFactsRawCandidate', () => {
  const file = {
    buffer: Buffer.from('%PDF-fake'),
    mimetype: 'application/pdf',
    originalname: 'cover.pdf',
  } as Express.Multer.File;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    vi.mocked(fetchWithTimeout).mockReset();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('calls Anthropic with the long AI-extraction timeout, not the 15 s default', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"projectName":"A","state":"NSW"}' }],
      }),
    } as unknown as Response);

    await extractProjectFactsRawCandidate(file);

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    const [url, , timeoutMs] = vi.mocked(fetchWithTimeout).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(timeoutMs).toBe(AI_EXTRACTION_TIMEOUT_MS);
    expect(AI_EXTRACTION_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('maps a fetch abort/failure to the 502 AI_REQUEST_FAILED contract', async () => {
    vi.mocked(fetchWithTimeout).mockRejectedValue(new Error('Fetch timed out after 120000ms'));

    await expect(extractProjectFactsRawCandidate(file)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_REQUEST_FAILED',
    });
  });

  it('returns 503 AI_UNAVAILABLE when no Anthropic key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(extractProjectFactsRawCandidate(file)).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_UNAVAILABLE',
    });
  });
});

describe('project_facts apply/rollback (DB-backed)', () => {
  let companyId: string;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `PF Co ${stamp}` } })).id;
    const user = await prisma.user.create({
      data: {
        email: `pf-user-${stamp}@example.com`,
        fullName: 'PF User',
        passwordHash: 'x',
        companyId,
        roleInCompany: 'project_manager',
      },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        name: 'Old Name',
        projectNumber: `OLD-${stamp}`,
        clientName: 'Old Client',
        companyId,
        status: 'active',
        state: 'VIC',
        specificationSet: 'VicRoads',
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.aiProposal.deleteMany({ where: { projectId } });
    await prisma.auditLog.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  async function seed(payload: unknown) {
    return createProposal({
      projectId,
      stage: PROJECT_FACTS_STAGE,
      requestedById: userId,
      model: 'claude-sonnet-5',
      sourceRefs: [{ fileName: 'cover.pdf', page: 1, note: 'Read from title block' }],
      payload,
    });
  }

  it('accept applies only provided non-null fields, derives spec set, and rollback restores', async () => {
    const proposal = await seed({
      projectName: 'New Name',
      projectNumber: null,
      clientName: 'New Client',
      state: 'NSW',
      specificationSet: 'TfNSW',
    });

    const decided = await decideProposal({
      proposalId: proposal.id,
      projectId,
      userId,
      action: 'accept',
    });
    expect(decided.status).toBe('accepted');

    const afterApply = await prisma.project.findUnique({ where: { id: projectId } });
    expect(afterApply?.name).toBe('New Name');
    expect(afterApply?.clientName).toBe('New Client');
    expect(afterApply?.state).toBe('NSW');
    expect(afterApply?.specificationSet).toBe('TfNSW');
    // projectNumber was null in the payload → untouched.
    expect(afterApply?.projectNumber?.startsWith('OLD-')).toBe(true);

    // prior values captured for rollback.
    const stored = await prisma.aiProposal.findUnique({ where: { id: proposal.id } });
    const groups = stored?.appliedRecordIds as unknown as Array<{ meta?: { prior?: unknown } }>;
    expect(groups[0].meta).toMatchObject({
      prior: {
        name: 'Old Name',
        clientName: 'Old Client',
        state: 'VIC',
        specificationSet: 'VicRoads',
      },
    });

    await rollbackProposal({ proposalId: proposal.id, projectId, userId });
    const afterRollback = await prisma.project.findUnique({ where: { id: projectId } });
    expect(afterRollback?.name).toBe('Old Name');
    expect(afterRollback?.clientName).toBe('Old Client');
    expect(afterRollback?.state).toBe('VIC');
    expect(afterRollback?.specificationSet).toBe('VicRoads');
  });

  it('accept-with-edits applies the edited state and re-derives the spec set', async () => {
    const proposal = await seed({
      projectName: 'AI Name',
      state: 'NSW',
      specificationSet: 'TfNSW',
    });

    // Human edited the state to QLD and dropped specificationSet — server derives it.
    const decided = await decideProposal({
      proposalId: proposal.id,
      projectId,
      userId,
      action: 'accept',
      editedPayload: { projectName: 'Edited Name', state: 'QLD' },
    });
    expect(decided.status).toBe('edited');

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    expect(project?.name).toBe('Edited Name');
    expect(project?.state).toBe('QLD');
    expect(project?.specificationSet).toBe('MRTS');

    // reset for isolation from other tests
    await rollbackProposal({ proposalId: proposal.id, projectId, userId });
  });

  it('rejects an accept whose payload carries an unsupported state', async () => {
    const proposal = await seed({ projectName: 'X', state: 'NSW' });
    await expect(
      decideProposal({
        proposalId: proposal.id,
        projectId,
        userId,
        action: 'accept',
        editedPayload: { state: 'ZZ' },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
