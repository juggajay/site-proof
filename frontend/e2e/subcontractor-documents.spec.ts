import { expect, test, type Page, type Route } from '@playwright/test';
import { mockAuthenticatedUserState } from './helpers';

const SUBBIE_USER = {
  id: 'e2e-subbie-user',
  email: 'subbie-docs@example.com',
  fullName: 'Sally Subbie',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
  companyId: null,
  hasSubcontractorPortalAccess: true,
  hasPassword: true,
};

const PORTAL_ACCESS = {
  lots: true,
  itps: true,
  holdPoints: true,
  testResults: true,
  ncrs: true,
  documents: true,
};

type JsonRoute = (body: unknown, status?: number) => Promise<void>;

function subcontractorCompanyPayload(url: URL) {
  const requestedProjectId = url.searchParams.get('projectId') || 'project-1';
  return {
    company: {
      id: 'e2e-sub-company',
      companyName: 'E2E Subbie Pty Ltd',
      projectId: requestedProjectId,
      projectName: requestedProjectId === 'project-2' ? 'Second QA Project' : 'Default QA Project',
      availableProjects: [
        {
          id: 'portal-project-1',
          companyName: 'E2E Subbie Pty Ltd',
          projectId: 'project-1',
          projectName: 'Default QA Project',
          status: 'active',
          portalAccess: PORTAL_ACCESS,
        },
        {
          id: 'portal-project-2',
          companyName: 'E2E Subbie Pty Ltd',
          projectId: 'project-2',
          projectName: 'Second QA Project',
          status: 'active',
          portalAccess: PORTAL_ACCESS,
        },
      ],
      employees: [],
      plant: [],
      portalAccess: PORTAL_ACCESS,
    },
  };
}

function documentsPayload() {
  return {
    documents: [
      {
        id: 'subbie-sanitised-doc',
        filename: 'sanitised-specification.pdf',
        category: 'Specification',
        description: 'Shared without a raw storage locator',
        uploadedAt: '2026-06-20T10:00:00.000Z',
        fileSize: 4096,
      },
    ],
  };
}

const API_PAYLOADS: Record<string, (url: URL) => unknown> = {
  '/api/auth/me': () => ({ user: SUBBIE_USER }),
  '/api/notifications': () => ({ notifications: [], unreadCount: 0 }),
  '/api/notifications/unread-count': () => ({ count: 0 }),
  '/api/projects': () => ({ projects: [] }),
  '/api/subcontractors/my-company': subcontractorCompanyPayload,
  '/api/dockets': () => ({ dockets: [] }),
  '/api/lots': () => ({ lots: [] }),
  '/api/documents/project-2': () => documentsPayload(),
};

function routeJson(route: Route): JsonRoute {
  return (body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
}

function postBody(route: Route): unknown {
  try {
    return route.request().postDataJSON();
  } catch {
    return {};
  }
}

async function fulfillSignedUrl(route: Route, json: JsonRoute, signedUrlRequests: unknown[]) {
  signedUrlRequests.push(postBody(route));
  await new Promise((resolve) => setTimeout(resolve, 400));
  await json({ signedUrl: '/signed/subbie-sanitised-doc' });
}

async function mockSubcontractorDocumentsApi(page: Page) {
  const signedUrlRequests: unknown[] = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = routeJson(route);
    const payload = API_PAYLOADS[url.pathname]?.(url);

    if (payload) return json(payload);
    if (url.pathname === '/api/documents/subbie-sanitised-doc/signed-url') {
      return fulfillSignedUrl(route, json, signedUrlRequests);
    }
    return json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, SUBBIE_USER);

  return {
    getSignedUrlRequests: () => signedUrlRequests,
  };
}

test.describe('Subcontractor documents mobile access', () => {
  test('preserves selected project and opens a sanitised document via signed URL', async ({
    page,
  }) => {
    const api = await mockSubcontractorDocumentsApi(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/subcontractor-portal?projectId=project-2');
    await expect(page).toHaveURL(/\/p\?projectId=project-2/);
    await expect(page.getByRole('combobox', { name: 'Project' })).toHaveValue('project-2');
    await page.getByRole('button', { name: 'Documents' }).click();

    await expect(page).toHaveURL(/\/p\/docs\?projectId=project-2/);
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(page.getByText('Second QA Project')).toBeVisible();
    await expect(page.getByText('sanitised-specification.pdf')).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open sanitised-specification.pdf' }).click();
    const popup = await popupPromise;

    await expect.poll(() => popup.url()).toContain('/signed/subbie-sanitised-doc');
    expect(api.getSignedUrlRequests()).toContainEqual(
      expect.objectContaining({ disposition: 'attachment' }),
    );

    await popup.close();
  });
});
