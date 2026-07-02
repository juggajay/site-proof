import { test, expect, type Page, type Route } from '@playwright/test';
import type { Company, CompanyMember } from '../src/pages/company/companySettingsData';
import type { CompanyApiKey } from '../src/pages/company/companyApiKeysData';
import type { CompanyWebhook } from '../src/pages/company/companyWebhooksData';
import {
  createJsonResponder,
  E2E_ADMIN_USER,
  mockAuthenticatedUserState,
  type JsonResponder,
} from './helpers';

const E2E_OWNER_USER = {
  ...E2E_ADMIN_USER,
  id: 'e2e-owner-user',
  role: 'admin',
  roleInCompany: 'owner',
};

const seededCompany: Company = {
  id: 'e2e-company',
  name: 'E2E Civil Pty Ltd',
  abn: '12 345 678 901',
  address: '1 Test Street, Sydney NSW',
  logoUrl: null,
  subscriptionTier: 'professional',
  projectCount: 8,
  projectLimit: 10,
  userCount: 20,
  userLimit: 25,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z',
};

const seededMembers: CompanyMember[] = [
  {
    id: E2E_OWNER_USER.id,
    email: E2E_OWNER_USER.email,
    fullName: E2E_OWNER_USER.fullName,
    roleInCompany: 'owner',
    hasPassword: true,
    status: 'active',
  },
  {
    id: 'e2e-company-admin',
    email: 'company.admin@example.com',
    fullName: 'E2E Company Admin',
    roleInCompany: 'admin',
    hasPassword: true,
    status: 'active',
  },
  {
    id: 'e2e-site-engineer',
    email: 'site.engineer@example.com',
    fullName: 'E2E Site Engineer',
    roleInCompany: 'site_engineer',
    hasPassword: true,
    status: 'active',
  },
];

const seededApiKeys: CompanyApiKey[] = [
  {
    id: 'e2e-api-key-own',
    name: 'Owner reporting key',
    keyPrefix: 'sp_e2eown',
    scopes: 'read',
    lastUsedAt: null,
    expiresAt: null,
    isActive: true,
    createdAt: '2026-05-05T00:00:00.000Z',
    owner: {
      id: E2E_OWNER_USER.id,
      fullName: E2E_OWNER_USER.fullName,
      email: E2E_OWNER_USER.email,
    },
  },
  {
    id: 'e2e-api-key-other',
    name: 'Estimator integration',
    keyPrefix: 'sp_e2eoth',
    scopes: 'write',
    lastUsedAt: '2026-05-08T00:00:00.000Z',
    expiresAt: null,
    isActive: true,
    createdAt: '2026-05-06T00:00:00.000Z',
    owner: {
      id: 'e2e-company-admin',
      fullName: 'E2E Company Admin',
      email: 'company.admin@example.com',
    },
  },
];

const seededWebhooks: CompanyWebhook[] = [
  {
    id: 'e2e-webhook-1',
    url: 'https://hooks.example.com/siteproof',
    events: ['*'],
    enabled: true,
    createdAt: '2026-05-07T00:00:00.000Z',
  },
];

type MockCompanySettingsApiOptions = {
  failCompanyLoadsUntil?: number;
  failMemberLoadsUntil?: number;
  userOverride?: Partial<typeof E2E_OWNER_USER>;
  companyOverride?: Partial<Company>;
  membersOverride?: CompanyMember[];
  apiKeysOverride?: CompanyApiKey[];
  webhooksOverride?: CompanyWebhook[];
  patchDelayMs?: number;
  transferDelayMs?: number;
  logoUploadFailure?: boolean;
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

type CompanySettingsApiState = {
  company: Company;
  members: CompanyMember[];
  apiKeys: CompanyApiKey[];
  webhooks: CompanyWebhook[];
  patchRequests: unknown[];
  transferRequests: unknown[];
  inviteRequests: unknown[];
  roleChangeRequests: unknown[];
  removeMemberRequests: string[];
  apiKeyCreateRequests: unknown[];
  apiKeyRevokeRequests: string[];
  webhookCreateRequests: unknown[];
  webhookPatchRequests: unknown[];
  webhookDeleteRequests: string[];
  webhookTestRequests: string[];
  webhookRegenerateRequests: string[];
  companyLoadCount: number;
  memberLoadCount: number;
};

async function respondStaticSettingsRoute(
  url: URL,
  json: JsonResponder,
  user: typeof E2E_OWNER_USER,
): Promise<boolean> {
  switch (url.pathname) {
    case '/api/auth/me':
      await json({ user });
      return true;
    case '/api/notifications':
      await json({ notifications: [], unreadCount: 0 });
      return true;
    case '/api/projects':
      await json({ projects: [] });
      return true;
    case '/api/support/contact':
      await json({
        email: 'configured-support@example.com',
        phone: null,
        phoneLabel: null,
        emergencyPhone: null,
        address: null,
        hours: 'Mon-Fri, 8am-6pm AEST',
        responseTime: {
          critical: 'Within 2 hours',
          standard: 'Within 24 hours',
          general: 'Within 48 hours',
        },
      });
      return true;
    default:
      return false;
  }
}

async function handleCompanyProfileRoute(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
  options: MockCompanySettingsApiOptions,
): Promise<boolean> {
  return (
    (await respondCompanyRead(route, url, json, state, options)) ||
    (await respondCompanyUpdate(route, url, json, state, options)) ||
    (await respondCompanyLogoUpload(route, url, json, state, options))
  );
}

async function respondCompanyRead(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
  options: MockCompanySettingsApiOptions,
): Promise<boolean> {
  if (url.pathname !== '/api/company' || route.request().method() !== 'GET') {
    return false;
  }

  state.companyLoadCount += 1;
  if (state.companyLoadCount <= (options.failCompanyLoadsUntil ?? 0)) {
    await json({ message: 'Company service unavailable' }, 500);
    return true;
  }

  await json({ company: state.company });
  return true;
}

async function respondCompanyUpdate(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
  options: MockCompanySettingsApiOptions,
): Promise<boolean> {
  if (url.pathname !== '/api/company' || route.request().method() !== 'PATCH') {
    return false;
  }

  if (options.patchDelayMs) {
    await delay(options.patchDelayMs);
  }

  const body = route.request().postDataJSON();
  state.patchRequests.push(body);
  state.company = {
    ...state.company,
    ...(body as Partial<Company>),
    updatedAt: '2026-05-09T00:00:00.000Z',
  };
  await json({ company: state.company, message: 'Company updated successfully' });
  return true;
}

async function respondCompanyLogoUpload(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
  options: MockCompanySettingsApiOptions,
): Promise<boolean> {
  if (url.pathname !== '/api/company/logo' || route.request().method() !== 'POST') {
    return false;
  }

  if (options.logoUploadFailure) {
    await json({ error: { message: 'Logo rejected by server' } }, 400);
    return true;
  }

  state.company = {
    ...state.company,
    logoUrl: '/uploads/logos/e2e-logo.png',
    updatedAt: '2026-05-09T00:00:00.000Z',
  };
  await json({ company: state.company, logoUrl: state.company.logoUrl });
  return true;
}

async function handleCompanyMembersRoute(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
  options: MockCompanySettingsApiOptions,
): Promise<boolean> {
  return (
    (await respondMemberInvite(route, url, json, state)) ||
    (await respondMemberRoleUpdate(route, url, json, state)) ||
    (await respondMemberDelete(route, url, json, state)) ||
    (await respondMemberList(route, url, json, state, options))
  );
}

async function respondMemberInvite(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  if (url.pathname !== '/api/company/members/invite' || route.request().method() !== 'POST') {
    return false;
  }

  const body = route.request().postDataJSON() as {
    email: string;
    fullName?: string;
    roleInCompany: string;
  };
  state.inviteRequests.push(body);
  const member: CompanyMember = {
    id: `e2e-invited-${state.inviteRequests.length}`,
    email: body.email,
    fullName: body.fullName ?? null,
    roleInCompany: body.roleInCompany,
    hasPassword: false,
    status: 'pending',
  };
  state.members = [...state.members.filter((entry) => entry.email !== member.email), member];
  await json({
    message: 'Company invitation sent successfully',
    member,
    invitation: {
      setupRequired: true,
      expiresAt: '2026-06-30T00:00:00.000Z',
    },
  });
  return true;
}

async function respondMemberRoleUpdate(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/company/members/') || route.request().method() !== 'PATCH') {
    return false;
  }

  const memberId = decodeURIComponent(url.pathname.replace('/api/company/members/', ''));
  const body = route.request().postDataJSON() as { roleInCompany: string };
  const previous = state.members.find((member) => member.id === memberId);
  state.roleChangeRequests.push({ memberId, ...body });
  state.members = state.members.map((member) =>
    member.id === memberId ? { ...member, roleInCompany: body.roleInCompany } : member,
  );
  await json({
    message: 'Company member role updated successfully',
    member: { id: memberId, roleInCompany: body.roleInCompany },
    previousRole: previous?.roleInCompany ?? null,
  });
  return true;
}

async function respondMemberDelete(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/company/members/') || route.request().method() !== 'DELETE') {
    return false;
  }

  const memberId = decodeURIComponent(url.pathname.replace('/api/company/members/', ''));
  const target = state.members.find((member) => member.id === memberId);
  state.removeMemberRequests.push(memberId);
  state.members = state.members.filter((member) => member.id !== memberId);
  await json({
    memberId,
    status: target?.status === 'pending' || target?.hasPassword === false ? 'cancelled' : 'removed',
  });
  return true;
}

async function respondMemberList(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
  options: MockCompanySettingsApiOptions,
): Promise<boolean> {
  if (url.pathname !== '/api/company/members' || route.request().method() !== 'GET') {
    return false;
  }

  state.memberLoadCount += 1;
  if (state.memberLoadCount <= (options.failMemberLoadsUntil ?? 0)) {
    await json({ message: 'Company members service unavailable' }, 500);
    return true;
  }

  await json({ members: state.members });
  return true;
}

async function handleCompanyApiKeyRoute(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  return (
    (await respondApiKeyInventory(route, url, json, state)) ||
    (await respondApiKeyCreate(route, url, json, state)) ||
    (await respondApiKeyRevoke(route, url, json, state))
  );
}

async function respondApiKeyInventory(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  if (url.pathname !== '/api/company/api-keys' || route.request().method() !== 'GET') {
    return false;
  }

  await json({ apiKeys: state.apiKeys, count: state.apiKeys.length });
  return true;
}

async function respondApiKeyCreate(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  if (url.pathname !== '/api/api-keys' || route.request().method() !== 'POST') {
    return false;
  }

  const body = route.request().postDataJSON() as { name: string; scopes?: string };
  state.apiKeyCreateRequests.push(body);
  const apiKey: CompanyApiKey = {
    id: `e2e-api-key-created-${state.apiKeyCreateRequests.length}`,
    name: body.name,
    keyPrefix: `sp_e2enew${state.apiKeyCreateRequests.length}`,
    scopes: body.scopes ?? 'read',
    lastUsedAt: null,
    expiresAt: null,
    isActive: true,
    createdAt: '2026-05-09T00:00:00.000Z',
    owner: {
      id: E2E_OWNER_USER.id,
      fullName: E2E_OWNER_USER.fullName,
      email: E2E_OWNER_USER.email,
    },
  };
  state.apiKeys = [...state.apiKeys, apiKey];
  await json({
    message: 'created',
    apiKey: {
      ...apiKey,
      key: 'sp_e2e_full_key_revealed_once',
    },
  });
  return true;
}

async function respondApiKeyRevoke(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/company/api-keys/') || route.request().method() !== 'DELETE') {
    return false;
  }

  const keyId = decodeURIComponent(url.pathname.replace('/api/company/api-keys/', ''));
  state.apiKeyRevokeRequests.push(keyId);
  state.apiKeys = state.apiKeys.map((key) =>
    key.id === keyId ? { ...key, isActive: false } : key,
  );
  await json({ message: 'revoked' });
  return true;
}

async function handleWebhookRoute(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  return (
    (await respondWebhookList(route, url, json, state)) ||
    (await respondWebhookCreate(route, url, json, state)) ||
    (await respondWebhookRegenerate(route, url, json, state)) ||
    (await respondWebhookTest(route, url, json, state)) ||
    (await respondWebhookPatch(route, url, json, state)) ||
    (await respondWebhookDelete(route, url, json, state))
  );
}

function getWebhookPathParts(url: URL): { webhookId: string; action: string | undefined } | null {
  if (!url.pathname.startsWith('/api/webhooks/')) {
    return null;
  }
  const pathParts = url.pathname.split('/').filter(Boolean);
  return { webhookId: decodeURIComponent(pathParts[2]), action: pathParts[3] };
}

async function respondWebhookList(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  if (url.pathname !== '/api/webhooks' || route.request().method() !== 'GET') {
    return false;
  }

  await json({ webhooks: state.webhooks });
  return true;
}

async function respondWebhookCreate(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  if (url.pathname !== '/api/webhooks' || route.request().method() !== 'POST') {
    return false;
  }

  const body = route.request().postDataJSON() as { url: string; events: string[] };
  state.webhookCreateRequests.push(body);
  const webhook: CompanyWebhook = {
    id: `e2e-webhook-created-${state.webhookCreateRequests.length}`,
    url: body.url,
    events: body.events,
    enabled: true,
    createdAt: '2026-05-09T00:00:00.000Z',
  };
  state.webhooks = [...state.webhooks, webhook];
  await json({
    ...webhook,
    message: 'created',
    secret: 'whsec_e2e_revealed_once',
  });
  return true;
}

async function respondWebhookRegenerate(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  const parts = getWebhookPathParts(url);
  if (!parts || parts.action !== 'regenerate-secret' || route.request().method() !== 'POST') {
    return false;
  }

  state.webhookRegenerateRequests.push(parts.webhookId);
  await json({
    id: parts.webhookId,
    secret: 'whsec_e2e_regenerated_once',
    message: 'rotated',
  });
  return true;
}

async function respondWebhookTest(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  const parts = getWebhookPathParts(url);
  if (!parts || parts.action !== 'test' || route.request().method() !== 'POST') {
    return false;
  }

  state.webhookTestRequests.push(parts.webhookId);
  await json({
    success: true,
    deliveryId: 'e2e-delivery-1',
    responseStatus: 200,
    responseBody: null,
    error: null,
  });
  return true;
}

async function respondWebhookPatch(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  const parts = getWebhookPathParts(url);
  if (!parts || route.request().method() !== 'PATCH') {
    return false;
  }

  const body = route.request().postDataJSON() as { enabled?: boolean };
  state.webhookPatchRequests.push({ webhookId: parts.webhookId, ...body });
  state.webhooks = state.webhooks.map((webhook) =>
    webhook.id === parts.webhookId && typeof body.enabled === 'boolean'
      ? { ...webhook, enabled: body.enabled }
      : webhook,
  );
  await json(state.webhooks.find((webhook) => webhook.id === parts.webhookId));
  return true;
}

async function respondWebhookDelete(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
): Promise<boolean> {
  const parts = getWebhookPathParts(url);
  if (!parts || route.request().method() !== 'DELETE') {
    return false;
  }

  state.webhookDeleteRequests.push(parts.webhookId);
  state.webhooks = state.webhooks.filter((webhook) => webhook.id !== parts.webhookId);
  await json({ message: 'deleted' });
  return true;
}

async function handleTransferOwnershipRoute(
  route: Route,
  url: URL,
  json: JsonResponder,
  state: CompanySettingsApiState,
  options: MockCompanySettingsApiOptions,
): Promise<boolean> {
  if (url.pathname !== '/api/company/transfer-ownership') {
    return false;
  }

  if (options.transferDelayMs) {
    await delay(options.transferDelayMs);
  }

  state.transferRequests.push(route.request().postDataJSON());
  await json({ success: true });
  return true;
}

async function mockCompanySettingsApi(page: Page, options: MockCompanySettingsApiOptions = {}) {
  const user = { ...E2E_OWNER_USER, ...options.userOverride };
  const state: CompanySettingsApiState = {
    company: { ...structuredClone(seededCompany), ...options.companyOverride },
    members: structuredClone(options.membersOverride ?? seededMembers),
    apiKeys: structuredClone(options.apiKeysOverride ?? seededApiKeys),
    webhooks: structuredClone(options.webhooksOverride ?? seededWebhooks),
    patchRequests: [],
    transferRequests: [],
    inviteRequests: [],
    roleChangeRequests: [],
    removeMemberRequests: [],
    apiKeyCreateRequests: [],
    apiKeyRevokeRequests: [],
    webhookCreateRequests: [],
    webhookPatchRequests: [],
    webhookDeleteRequests: [],
    webhookTestRequests: [],
    webhookRegenerateRequests: [],
    companyLoadCount: 0,
    memberLoadCount: 0,
  };

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = createJsonResponder(route);

    if (await respondStaticSettingsRoute(url, json, user)) return;
    if (await handleCompanyProfileRoute(route, url, json, state, options)) return;
    if (await handleCompanyMembersRoute(route, url, json, state, options)) return;
    if (await handleCompanyApiKeyRoute(route, url, json, state)) return;
    if (await handleWebhookRoute(route, url, json, state)) return;
    if (await handleTransferOwnershipRoute(route, url, json, state, options)) return;

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, user);

  return {
    getPatchRequests: () => state.patchRequests,
    getTransferRequests: () => state.transferRequests,
    getInviteRequests: () => state.inviteRequests,
    getRoleChangeRequests: () => state.roleChangeRequests,
    getRemoveMemberRequests: () => state.removeMemberRequests,
    getApiKeyCreateRequests: () => state.apiKeyCreateRequests,
    getApiKeyRevokeRequests: () => state.apiKeyRevokeRequests,
    getWebhookCreateRequests: () => state.webhookCreateRequests,
    getWebhookPatchRequests: () => state.webhookPatchRequests,
    getWebhookDeleteRequests: () => state.webhookDeleteRequests,
    getWebhookTestRequests: () => state.webhookTestRequests,
    getWebhookRegenerateRequests: () => state.webhookRegenerateRequests,
    getCompanyLoadCount: () => state.companyLoadCount,
    getMemberLoadCount: () => state.memberLoadCount,
  };
}

test.describe('Company settings seeded owner contract', () => {
  test('saves company profile details and shows owner-only billing controls', async ({ page }) => {
    const api = await mockCompanySettingsApi(page);

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'Company Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Company Information' })).toBeVisible();
    await expect(page.getByLabel('ABN')).toHaveAttribute('placeholder', '51 824 753 556');
    await expect(page.getByRole('heading', { name: 'Billing & Subscription' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Transfer Ownership' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contact Us to Add Capacity' })).toHaveAttribute(
      'href',
      'mailto:configured-support@example.com?subject=Add%20CIVOS%20capacity',
    );
    await expect(page.getByRole('link', { name: 'Manage Payment Method' })).toHaveAttribute(
      'href',
      'mailto:configured-support@example.com?subject=CIVOS%20billing%20inquiry',
    );

    await page.getByLabel(/Company Name/).fill('');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByText('Company name is required')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(0);

    await page.getByLabel(/Company Name/).fill('E2E Civil Group');
    await page.getByLabel('ABN').fill('98 765 432 109');
    await page.getByLabel('Address').fill('22 Verified Road, Melbourne VIC');
    await page.getByRole('button', { name: 'Save Settings' }).click();

    await expect(page.getByText('Settings saved successfully!')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(1);
    expect(api.getPatchRequests()[0]).toMatchObject({
      name: 'E2E Civil Group',
      abn: '98 765 432 109',
      address: '22 Verified Road, Melbourne VIC',
      logoUrl: null,
    });
  });

  test('prevents duplicate company profile saves and trims payload fields', async ({ page }) => {
    const api = await mockCompanySettingsApi(page, { patchDelayMs: 250 });

    await page.goto('/company-settings');

    await page.getByLabel(/Company Name/).fill('  E2E Civil Trimmed  ');
    await page.getByLabel('ABN').fill('  11 222 333 444  ');
    const saveButton = page.getByRole('button', { name: 'Save Settings' });
    await saveButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText('Settings saved successfully!')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(1);
    expect(api.getPatchRequests()[0]).toMatchObject({
      name: 'E2E Civil Trimmed',
      abn: '11 222 333 444',
    });
  });

  test('shows nested backend logo upload errors as readable messages', async ({ page }) => {
    await mockCompanySettingsApi(page, { logoUploadFailure: true });

    await page.goto('/company-settings');
    await page.locator('#company-logo-upload').setInputFiles({
      name: 'company-logo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-real-image'),
    });

    await expect(page.getByText('Logo rejected by server')).toBeVisible();
  });

  test('renders unlimited plan billing without falling back to free/basic labels', async ({
    page,
  }) => {
    await mockCompanySettingsApi(page, {
      companyOverride: {
        subscriptionTier: 'unlimited',
        projectLimit: null,
        userLimit: null,
      },
    });

    await page.goto('/company-settings');

    const billingSection = page.getByTestId('billing-section');
    await expect(billingSection).toContainText('unlimited');
    await expect(billingSection).toContainText('Custom pricing');
    await expect(billingSection).toContainText('Unlimited');
    await expect(billingSection.getByText('Free', { exact: true })).toHaveCount(0);
    await expect(billingSection.getByText('1 GB', { exact: true })).toHaveCount(0);
  });

  test('allows company admins to manage team and integrations without owner-only controls', async ({
    page,
  }) => {
    await mockCompanySettingsApi(page, {
      userOverride: {
        id: 'e2e-company-admin',
        email: 'company.admin@example.com',
        fullName: 'E2E Company Admin',
        role: 'admin',
        roleInCompany: 'admin',
      },
    });

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'Company Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Company Information' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team Members' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'API keys' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Billing & Subscription' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Transfer Ownership' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Invite Member' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create API key' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add webhook' })).toBeVisible();
  });

  test('denies company settings to company members before loading settings data', async ({
    page,
  }) => {
    const memberUser = {
      ...E2E_ADMIN_USER,
      id: 'e2e-company-member',
      email: 'company.member@example.com',
      fullName: 'E2E Company Member',
      role: 'member',
      roleInCompany: 'member',
    };
    let companySettingsRequests = 0;

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const json = createJsonResponder(route);

      if (url.pathname === '/api/auth/me') {
        await json({ user: memberUser });
        return;
      }
      if (url.pathname === '/api/notifications') {
        await json({ notifications: [], unreadCount: 0 });
        return;
      }
      if (url.pathname === '/api/projects') {
        await json({ projects: [] });
        return;
      }
      if (
        url.pathname.startsWith('/api/company') ||
        url.pathname.startsWith('/api/webhooks') ||
        url.pathname === '/api/api-keys'
      ) {
        companySettingsRequests += 1;
        await json({ message: `Unexpected company settings API route: ${url.pathname}` }, 500);
        return;
      }

      await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
    });
    await mockAuthenticatedUserState(page, memberUser);

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to access this page.")).toBeVisible();
    expect(companySettingsRequests).toBe(0);
  });

  test('transfers ownership to another company member', async ({ page }) => {
    const api = await mockCompanySettingsApi(page);

    await page.goto('/company-settings');
    await page.getByRole('button', { name: 'Transfer Ownership' }).click();

    const transferDialog = page.getByRole('dialog').filter({ hasText: 'Transfer Ownership' });
    await expect(transferDialog.getByText('Choose another company member')).toBeVisible();
    await transferDialog.getByLabel('Select New Owner').selectOption('e2e-company-admin');
    await expect(transferDialog.getByText('E2E Company Admin', { exact: true })).toBeVisible();
    await transferDialog.getByRole('button', { name: 'Transfer Ownership' }).click();

    await expect(page.getByText('Ownership transferred successfully.')).toBeVisible();
    expect(api.getTransferRequests()).toHaveLength(1);
    expect(api.getTransferRequests()[0]).toMatchObject({
      newOwnerId: 'e2e-company-admin',
    });
  });

  test('manages team members from the owner company settings page', async ({ page }) => {
    const api = await mockCompanySettingsApi(page);

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'Team Members' })).toBeVisible();
    await page.getByRole('button', { name: 'Invite Member' }).click();

    const inviteDialog = page.getByRole('dialog').filter({ hasText: 'Invite Company Member' });
    await inviteDialog.getByLabel('Email *').fill('New.QM@Example.com');
    await inviteDialog.getByLabel('Full Name').fill('New Quality Manager');
    await inviteDialog.getByLabel('Company Role').selectOption('quality_manager');
    await inviteDialog.getByRole('button', { name: 'Send Invite' }).click();

    await expect(
      page.getByText(
        "Invitation sent to new.qm@example.com. They'll appear as pending until they set a password.",
      ),
    ).toBeVisible();
    await expect(page.getByText('New Quality Manager')).toBeVisible();
    expect(api.getInviteRequests()).toHaveLength(1);
    expect(api.getInviteRequests()[0]).toMatchObject({
      email: 'new.qm@example.com',
      fullName: 'New Quality Manager',
      roleInCompany: 'quality_manager',
    });
    await inviteDialog.getByRole('button', { name: 'Close' }).first().click();

    await page.getByLabel('Change role for E2E Site Engineer').selectOption('site_manager');
    await expect
      .poll(() => api.getRoleChangeRequests())
      .toContainEqual({ memberId: 'e2e-site-engineer', roleInCompany: 'site_manager' });

    const siteEngineerRow = page
      .getByText('E2E Site Engineer')
      .locator(
        'xpath=ancestor::div[contains(@class, "grid") and contains(@class, "items-center")][1]',
      );
    await siteEngineerRow.getByRole('button', { name: 'Remove' }).click();
    const removeDialog = page.getByRole('dialog').filter({ hasText: 'Remove Company Member' });
    await removeDialog.getByRole('button', { name: 'Remove Member' }).click();

    await expect(page.getByText('E2E Site Engineer was removed from the company.')).toBeVisible();
    await expect(page.getByLabel('Change role for E2E Site Engineer')).toHaveCount(0);
    expect(api.getRemoveMemberRequests()).toContain('e2e-site-engineer');

    const pendingInviteRow = page
      .getByText('New Quality Manager')
      .locator(
        'xpath=ancestor::div[contains(@class, "grid") and contains(@class, "items-center")][1]',
      );
    await pendingInviteRow.getByRole('button', { name: 'Cancel' }).click();
    const cancelDialog = page.getByRole('dialog').filter({ hasText: 'Cancel Company Invitation' });
    await cancelDialog.getByRole('button', { name: 'Cancel Invitation' }).click();

    await expect(page.getByText('Invitation cancelled for new.qm@example.com.')).toBeVisible();
    await expect(page.getByText('New Quality Manager')).toHaveCount(0);
    expect(api.getRemoveMemberRequests()).toContain('e2e-invited-1');
  });

  test('manages owner integrations from the company settings page', async ({ page }) => {
    const api = await mockCompanySettingsApi(page);

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'API keys' })).toBeVisible();
    await expect(page.getByText('Owner reporting key')).toBeVisible();
    await page.getByRole('button', { name: 'Create API key' }).click();

    const createKeyDialog = page.getByRole('dialog').filter({ hasText: 'Create API key' });
    await createKeyDialog.getByLabel('Name').fill('Power BI export');
    await createKeyDialog.getByLabel('Access').selectOption('write');
    await createKeyDialog.getByRole('button', { name: 'Create key' }).click();

    await expect(page.getByText('sp_e2e_full_key_revealed_once')).toBeVisible();
    expect(api.getApiKeyCreateRequests()).toContainEqual({
      name: 'Power BI export',
      scopes: 'write',
      expiresInDays: 90,
    });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Power BI export')).toBeVisible();

    await page.getByRole('button', { name: 'Revoke' }).first().click();
    await expect(page.getByRole('alertdialog', { name: 'Revoke API key' })).toContainText(
      'Owner reporting key',
    );
    expect(api.getApiKeyRevokeRequests()).toHaveLength(0);
    await page.getByRole('button', { name: 'Keep key' }).click();
    expect(api.getApiKeyRevokeRequests()).toHaveLength(0);

    await page.getByRole('button', { name: 'Revoke' }).first().click();
    await page.getByRole('button', { name: 'Revoke API key' }).click();
    expect(api.getApiKeyRevokeRequests()).toContain('e2e-api-key-own');
    await expect(page.getByText('Revoked', { exact: true })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible();
    await expect(page.getByText('https://hooks.example.com/siteproof')).toBeVisible();
    await page.getByRole('button', { name: 'Test' }).click();
    await expect(page.getByText('Test delivered (HTTP 200)')).toBeVisible();
    expect(api.getWebhookTestRequests()).toContain('e2e-webhook-1');

    await page.getByRole('button', { name: 'Disable' }).click();
    await expect(page.getByRole('button', { name: 'Enable' })).toBeVisible();
    expect(api.getWebhookPatchRequests()).toContainEqual({
      webhookId: 'e2e-webhook-1',
      enabled: false,
    });

    await page.getByRole('button', { name: 'Regenerate secret' }).click();
    await expect(
      page.getByRole('alertdialog', { name: 'Regenerate signing secret' }),
    ).toContainText('old signing secret stops working');
    expect(api.getWebhookRegenerateRequests()).toHaveLength(0);
    await page.getByRole('button', { name: 'Keep current secret' }).click();
    expect(api.getWebhookRegenerateRequests()).toHaveLength(0);

    await page.getByRole('button', { name: 'Regenerate secret' }).click();
    await page.getByRole('button', { name: 'Regenerate signing secret' }).click();
    await expect(page.getByText('whsec_e2e_regenerated_once')).toBeVisible();
    await expect(page.getByText('The old signing secret no longer works.')).toBeVisible();
    expect(api.getWebhookRegenerateRequests()).toContain('e2e-webhook-1');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Delete webhook' })).toContainText(
      'https://hooks.example.com/siteproof',
    );
    expect(api.getWebhookDeleteRequests()).toHaveLength(0);
    await page.getByRole('button', { name: 'Keep webhook' }).click();
    expect(api.getWebhookDeleteRequests()).toHaveLength(0);

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete webhook' }).click();
    await expect(page.getByText('https://hooks.example.com/siteproof')).toHaveCount(0);
    expect(api.getWebhookDeleteRequests()).toContain('e2e-webhook-1');

    await page.getByRole('button', { name: 'Add webhook' }).click();
    const createWebhookDialog = page.getByRole('dialog').filter({ hasText: 'Endpoint URL' });
    await createWebhookDialog
      .getByLabel('Endpoint URL')
      .fill('https://hooks.example.com/siteproof-new');
    await createWebhookDialog.getByRole('button', { name: 'Add webhook' }).click();

    await expect(page.getByText('whsec_e2e_revealed_once')).toBeVisible();
    expect(api.getWebhookCreateRequests()).toContainEqual({
      url: 'https://hooks.example.com/siteproof-new',
      events: ['*'],
    });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('https://hooks.example.com/siteproof-new')).toBeVisible();
  });

  test('keeps company settings integration actions reachable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockCompanySettingsApi(page);

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'Team Members' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invite Member' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revoke' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Regenerate secret' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('prevents duplicate ownership transfer submissions', async ({ page }) => {
    const api = await mockCompanySettingsApi(page, { transferDelayMs: 250 });

    await page.goto('/company-settings');
    await page.getByRole('button', { name: 'Transfer Ownership' }).click();

    const transferDialog = page.getByRole('dialog').filter({ hasText: 'Transfer Ownership' });
    await transferDialog.getByLabel('Select New Owner').selectOption('e2e-company-admin');
    const transferButton = transferDialog.getByRole('button', { name: 'Transfer Ownership' });
    await transferButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText('Ownership transferred successfully.')).toBeVisible();
    expect(api.getTransferRequests()).toHaveLength(1);
  });

  test('shows member load failure before empty transfer state and retries', async ({ page }) => {
    const api = await mockCompanySettingsApi(page, { failMemberLoadsUntil: 3 });

    await page.goto('/company-settings');
    await page.getByRole('button', { name: 'Transfer Ownership' }).click();

    const transferDialog = page.getByRole('dialog').filter({ hasText: 'Transfer Ownership' });
    await expect(transferDialog.getByRole('alert')).toContainText(
      'Company members service unavailable',
    );
    await expect(transferDialog.getByText('No other members in your company')).toBeHidden();

    const tryAgainButton = transferDialog.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (
        await transferDialog
          .getByLabel('Select New Owner')
          .isVisible()
          .catch(() => false)
      )
        break;
      if (await tryAgainButton.isVisible().catch(() => false)) {
        await tryAgainButton.click();
      }
      await page.waitForTimeout(100);
    }

    await expect(transferDialog.getByLabel('Select New Owner')).toBeVisible();
    await expect.poll(() => api.getMemberLoadCount()).toBeGreaterThan(3);
  });

  test('recovers from company settings load failure without false settings content', async ({
    page,
  }) => {
    const api = await mockCompanySettingsApi(page, { failCompanyLoadsUntil: 4 });

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'Company Settings' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Company service unavailable');
    await expect(page.getByRole('heading', { name: 'Company Information' })).toBeHidden();

    const tryAgainButton = page.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (
        await page
          .getByRole('heading', { name: 'Company Information' })
          .isVisible()
          .catch(() => false)
      )
        break;
      if (await tryAgainButton.isVisible().catch(() => false)) {
        await tryAgainButton.click();
      }
      await page.waitForTimeout(100);
    }

    await expect(page.getByRole('heading', { name: 'Company Information' })).toBeVisible();
    await expect.poll(() => api.getCompanyLoadCount()).toBeGreaterThan(4);
  });
});
