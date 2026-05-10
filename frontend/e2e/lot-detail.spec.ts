import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_LOT_ID = 'e2e-lot-detail';
const E2E_ITP_INSTANCE_ID = 'e2e-itp-instance';
const E2E_CHECKLIST_ITEM_ID = 'e2e-checklist-item';

const E2E_LOT = {
  id: E2E_LOT_ID,
  lotNumber: 'LOT-ITP-001',
  description: 'Lot detail ITP coverage',
  status: 'in_progress',
  activityType: 'Earthworks',
  chainageStart: 100,
  chainageEnd: 200,
  offset: null,
  layer: null,
  areaZone: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  conformedAt: null,
  conformedBy: null,
  assignedSubcontractorId: null,
  assignedSubcontractor: null,
};

const E2E_ITP_INSTANCE = {
  id: E2E_ITP_INSTANCE_ID,
  template: {
    id: 'e2e-template',
    name: 'E2E Earthworks ITP',
    checklistItems: [
      {
        id: E2E_CHECKLIST_ITEM_ID,
        description: 'Inspect subgrade before fill',
        category: 'Preparation',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
        order: 1,
        acceptanceCriteria: 'Subgrade is proof rolled and accepted',
        testType: null,
      },
    ],
  },
  completions: [],
};

interface MockLotDetailOptions {
  failLotLoadsUntil?: number;
  failItpLoadsUntil?: number;
}

async function mockLotDetailApi(page: Page, options: MockLotDetailOptions = {}) {
  let lotLoadAttempts = 0;
  let itpLoadAttempts = 0;
  let completionRequestCount = 0;
  let completion = null as null | {
    id: string;
    checklistItemId: string;
    isCompleted: boolean;
    isNotApplicable: boolean;
    isFailed: boolean;
    notes: string | null;
    completedAt: string | null;
    completedBy: { id: string; fullName: string; email: string } | null;
    isVerified: boolean;
    verifiedAt: string | null;
    verifiedBy: null;
    attachments: [];
  };

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: E2E_ADMIN_USER });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({
        project: {
          id: E2E_PROJECT_ID,
          name: 'E2E Highway Upgrade',
          projectNumber: 'E2E-001',
        },
      });
      return;
    }

    if (url.pathname === `/api/lots/check-role/${E2E_PROJECT_ID}`) {
      await json({
        role: 'admin',
        isQualityManager: true,
        canConformLots: true,
        canVerifyTestResults: true,
        canCloseNCRs: true,
        canManageITPTemplates: true,
      });
      return;
    }

    if (url.pathname === `/api/lots/${E2E_LOT_ID}`) {
      lotLoadAttempts += 1;
      if (lotLoadAttempts <= (options.failLotLoadsUntil ?? 0)) {
        await json({ message: 'Lot temporarily unavailable' }, 500);
        return;
      }

      await json({ lot: E2E_LOT });
      return;
    }

    if (url.pathname === `/api/lots/${E2E_LOT_ID}/conform-status`) {
      await json({
        canConform: false,
        blockingReasons: ['ITP incomplete'],
        prerequisites: {
          itpAssigned: true,
          itpCompleted: false,
          itpCompletedCount: completion?.isCompleted ? 1 : 0,
          itpTotalCount: 1,
          hasPassingTest: false,
          noOpenNcrs: true,
          openNcrs: [],
        },
      });
      return;
    }

    if (url.pathname === `/api/lots/${E2E_LOT_ID}/subcontractors`) {
      await json([]);
      return;
    }

    if (
      url.pathname === '/api/test-results' &&
      url.searchParams.get('projectId') === E2E_PROJECT_ID
    ) {
      await json({ testResults: [] });
      return;
    }

    if (url.pathname === '/api/ncrs' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({ ncrs: [] });
      return;
    }

    if (url.pathname === `/api/itp/instances/lot/${E2E_LOT_ID}`) {
      itpLoadAttempts += 1;
      if (itpLoadAttempts <= (options.failItpLoadsUntil ?? 0)) {
        await json({ message: 'ITP temporarily unavailable' }, 500);
        return;
      }

      await json({
        instance: {
          ...E2E_ITP_INSTANCE,
          completions: completion ? [completion] : [],
        },
      });
      return;
    }

    if (url.pathname === '/api/itp/completions' && route.request().method() === 'POST') {
      completionRequestCount += 1;
      const request = route.request().postDataJSON() as {
        checklistItemId: string;
        isCompleted?: boolean;
        notes?: string | null;
      };
      completion = {
        id: 'e2e-completion',
        checklistItemId: request.checklistItemId,
        isCompleted: Boolean(request.isCompleted),
        isNotApplicable: false,
        isFailed: false,
        notes: request.notes || null,
        completedAt: request.isCompleted ? '2026-01-15T01:00:00.000Z' : null,
        completedBy: request.isCompleted
          ? {
              id: E2E_ADMIN_USER.id,
              fullName: E2E_ADMIN_USER.fullName,
              email: E2E_ADMIN_USER.email,
            }
          : null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      };
      await new Promise((resolve) => setTimeout(resolve, 250));
      await json({ completion });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getCompletionRequestCount: () => completionRequestCount,
    getItpLoadAttempts: () => itpLoadAttempts,
    getLotLoadAttempts: () => lotLoadAttempts,
  };
}

test.describe('Lot detail ITP workflow', () => {
  test('shows retry instead of a false missing-ITP state when ITP loading fails', async ({
    page,
  }) => {
    const api = await mockLotDetailApi(page, { failItpLoadsUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots/${E2E_LOT_ID}`);

    await expect(page.getByRole('heading', { name: 'LOT-ITP-001' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('ITP temporarily unavailable');
    await expect(page.getByText('No ITP template assigned')).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByText('E2E Earthworks ITP')).toBeVisible();
    expect(api.getItpLoadAttempts()).toBeGreaterThanOrEqual(2);
  });

  test('shows retry for lot detail load failure', async ({ page }) => {
    const api = await mockLotDetailApi(page, { failLotLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots/${E2E_LOT_ID}`);

    await expect(page.getByText('Lot temporarily unavailable')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('heading', { name: 'LOT-ITP-001' })).toBeVisible();
    expect(api.getLotLoadAttempts()).toBeGreaterThanOrEqual(2);
  });

  test('guards duplicate checklist completion submissions', async ({ page }) => {
    const api = await mockLotDetailApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots/${E2E_LOT_ID}`);
    await expect(page.getByText('E2E Earthworks ITP')).toBeVisible();

    await page.getByRole('button', { name: /Preparation/ }).click();
    await page
      .getByRole('button', { name: 'Mark "Inspect subgrade before fill" as complete' })
      .dblclick();

    await expect(page.getByText('Completed by E2E Admin')).toBeVisible();
    expect(api.getCompletionRequestCount()).toBe(1);
  });
});
