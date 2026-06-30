import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(() => 'push-token'),
  user: { id: 'user-1', email: 'user@example.com' },
  isPushSupported: vi.fn(() => true),
  getNotificationPermission: vi.fn(() => 'default' as NotificationPermission),
  getPushStatus: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
  sendTestPush: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthToken: mocks.getAuthToken,
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/lib/pushNotifications', () => ({
  isPushSupported: mocks.isPushSupported,
  getNotificationPermission: mocks.getNotificationPermission,
  getPushStatus: mocks.getPushStatus,
  subscribeToPush: mocks.subscribeToPush,
  unsubscribeFromPush: mocks.unsubscribeFromPush,
  sendTestPush: mocks.sendTestPush,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import { PushNotificationSettings } from './PushNotificationSettings';

function pushStatus(overrides: Record<string, unknown> = {}) {
  return {
    supported: true,
    permission: 'default' as NotificationPermission,
    subscribed: false,
    configured: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  mocks.getAuthToken.mockReturnValue('push-token');
  mocks.isPushSupported.mockReturnValue(true);
  mocks.getNotificationPermission.mockReturnValue('default');
  mocks.getPushStatus.mockResolvedValue(pushStatus());
  mocks.subscribeToPush.mockResolvedValue({ success: true });
  mocks.unsubscribeFromPush.mockResolvedValue({ success: true });
  mocks.sendTestPush.mockResolvedValue({ success: true, message: 'Test sent' });
});

describe('PushNotificationSettings', () => {
  it('enables push notifications and exposes the test action', async () => {
    const user = userEvent.setup();
    render(<PushNotificationSettings />);

    await screen.findByText('Push Notifications Disabled');

    await user.click(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() => {
      expect(mocks.subscribeToPush).toHaveBeenCalledWith('push-token');
    });
    expect(screen.getByText('Push Notifications Enabled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Test' })).toBeInTheDocument();
  });

  it('shows subscription failures without marking the device enabled', async () => {
    const user = userEvent.setup();
    mocks.subscribeToPush.mockResolvedValue({ success: false, error: 'Permission denied' });

    render(<PushNotificationSettings />);

    await screen.findByText('Push Notifications Disabled');
    await user.click(screen.getByRole('button', { name: 'Enable' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
    expect(screen.getByText('Push Notifications Disabled')).toBeInTheDocument();
  });

  it('disables the enable action when browser permission is denied', async () => {
    mocks.getPushStatus.mockResolvedValue(
      pushStatus({ permission: 'denied' as NotificationPermission }),
    );

    render(<PushNotificationSettings />);

    await screen.findByText('Notifications Blocked');
    expect(screen.getByRole('button', { name: 'Enable' })).toBeDisabled();
  });

  it('disables an existing subscription', async () => {
    const user = userEvent.setup();
    mocks.getPushStatus.mockResolvedValue(pushStatus({ subscribed: true }));

    render(<PushNotificationSettings />);

    await screen.findByText('Push Notifications Enabled');
    await user.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      expect(mocks.unsubscribeFromPush).toHaveBeenCalledWith('push-token');
    });
    expect(screen.getByText('Push Notifications Disabled')).toBeInTheDocument();
  });

  it('renders successful and failed test-push results with status semantics', async () => {
    const user = userEvent.setup();
    mocks.getPushStatus.mockResolvedValue(pushStatus({ subscribed: true }));

    const { rerender } = render(<PushNotificationSettings />);

    await screen.findByText('Push Notifications Enabled');
    await user.click(screen.getByRole('button', { name: 'Send Test' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Test sent');

    mocks.getPushStatus.mockResolvedValue(pushStatus({ subscribed: true }));
    mocks.sendTestPush.mockResolvedValue({ success: false, error: 'No devices reached' });

    rerender(<PushNotificationSettings />);

    await screen.findByText('Push Notifications Enabled');
    await user.click(screen.getByRole('button', { name: 'Send Test' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No devices reached');
  });
});
