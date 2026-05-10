import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

async function mockSupportApi(page: Page, options: { failSubmit?: boolean } = {}) {
  let supportRequest: unknown = null;

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

    if (url.pathname === '/api/support/contact') {
      await json({
        email: 'helpdesk@example.com',
        phone: '+61 2 5555 0000',
        phoneLabel: '02 5555 0000',
        emergencyPhone: '+61 400 111 222',
        address: 'Level 4, 10 Support Street, Sydney NSW',
        hours: 'Mon-Fri, 7am-7pm AEST',
        responseTime: {
          critical: 'Within 1 hour',
          standard: 'Same business day',
          general: 'Within 2 business days',
        },
      });
      return;
    }

    if (url.pathname === '/api/support/request') {
      supportRequest = route.request().postDataJSON();
      if (options.failSubmit) {
        await json({ message: 'Support delivery unavailable' }, 502);
        return;
      }
      await json({
        success: true,
        message: 'Support request submitted successfully',
        ticketId: 'SP-20260509-E2E0001',
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getSupportRequest: () => supportRequest,
  };
}

test.describe('Support seeded account contract', () => {
  test('renders configured contact details and submits a support request', async ({ page }) => {
    const api = await mockSupportApi(page);

    await page.goto('/support');

    await expect(page.getByRole('heading', { name: 'Help & Support' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'helpdesk@example.com' })).toHaveAttribute(
      'href',
      'mailto:helpdesk@example.com',
    );
    await expect(page.getByRole('link', { name: '02 5555 0000' })).toHaveAttribute(
      'href',
      'tel:+61255550000',
    );
    await expect(page.getByText('Level 4, 10 Support Street, Sydney NSW')).toBeVisible();
    await expect(page.getByText('Critical issues: Within 1 hour')).toBeVisible();

    await page.getByLabel('Category').selectOption('technical');
    await page.getByLabel('Subject').fill('Cannot submit hold point');
    await page
      .getByLabel('Message')
      .fill('The hold point release workflow fails after I upload evidence.');
    await page.getByRole('button', { name: 'Submit Request' }).click();

    await expect(page.getByText('Request submitted successfully!')).toBeVisible();
    await expect(page.getByText('SP-20260509-E2E0001')).toBeVisible();
    expect(api.getSupportRequest()).toMatchObject({
      subject: 'Cannot submit hold point',
      message: 'The hold point release workflow fails after I upload evidence.',
      category: 'technical',
      userEmail: E2E_ADMIN_USER.email,
      userName: E2E_ADMIN_USER.fullName,
    });
    await expect(page.getByLabel('Subject')).toHaveValue('');
    await expect(page.getByLabel('Message')).toHaveValue('');
  });

  test('validates required fields and surfaces submission failures', async ({ page }) => {
    const api = await mockSupportApi(page, { failSubmit: true });

    await page.goto('/support');

    await expect(page.getByRole('button', { name: 'Submit Request' })).toBeDisabled();
    await page.getByLabel('Subject').fill('Billing issue');
    await page.getByLabel('Message').fill('Invoice export is failing for this month.');
    const submitButton = page.getByRole('button', { name: 'Submit Request' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.getByText('Support delivery unavailable')).toBeVisible();
    expect(api.getSupportRequest()).toMatchObject({
      subject: 'Billing issue',
      message: 'Invoice export is failing for this month.',
      category: 'general',
    });
  });
});
