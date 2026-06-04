import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

// Mock only the network boundary; everything else in the hook stays real.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '@/lib/api';
import { useMfaSettings } from './useMfaSettings';

const apiFetchMock = vi.mocked(apiFetch) as unknown as MockInstance<
  (path: string, options?: RequestInit) => Promise<unknown>
>;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockMfaApi(routes: Record<string, () => Promise<unknown>>) {
  apiFetchMock.mockImplementation((path: string) => {
    const route = routes[path];
    if (!route) {
      return Promise.reject(new Error(`Unexpected apiFetch call: ${path}`));
    }
    return route();
  });
}

function setupCallCount(): number {
  return apiFetchMock.mock.calls.filter(([path]) => path === '/api/mfa/setup').length;
}

async function renderLoadedHook() {
  const rendered = renderHook(() => useMfaSettings());
  await waitFor(() => expect(rendered.result.current.isLoadingMfa).toBe(false));
  return rendered;
}

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

describe('useMfaSettings', () => {
  beforeEach(() => {
    mockMfaApi({
      '/api/mfa/status': () => Promise.resolve({ mfaEnabled: false }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it('loads MFA status on mount', async () => {
    mockMfaApi({
      '/api/mfa/status': () => Promise.resolve({ mfaEnabled: true }),
    });

    const { result } = renderHook(() => useMfaSettings());

    expect(result.current.isLoadingMfa).toBe(true);
    await waitFor(() => expect(result.current.isLoadingMfa).toBe(false));

    expect(apiFetchMock).toHaveBeenCalledWith('/api/mfa/status');
    expect(result.current.mfaEnabled).toBe(true);
    expect(result.current.mfaLoadError).toBe('');
  });

  it('surfaces a status load failure and recovers on reload', async () => {
    mockMfaApi({
      '/api/mfa/status': () => Promise.reject(new Error('MFA service unavailable')),
    });

    const { result } = await renderLoadedHook();
    expect(result.current.mfaLoadError).toBe('MFA service unavailable');

    mockMfaApi({
      '/api/mfa/status': () => Promise.resolve({ mfaEnabled: true }),
    });
    await act(async () => {
      await result.current.loadMfaStatus();
    });

    expect(result.current.mfaLoadError).toBe('');
    expect(result.current.mfaEnabled).toBe(true);
  });

  it('opens the setup dialog with the server secret and QR code', async () => {
    const { result } = await renderLoadedHook();

    mockMfaApi({
      '/api/mfa/setup': () => Promise.resolve({ secret: 'SECRET123', qrCode: 'data:image/png' }),
    });
    await act(async () => {
      await result.current.handleMfaSetup();
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/mfa/setup', { method: 'POST' });
    expect(result.current.showMfaSetup).toBe(true);
    expect(result.current.mfaSetupData).toEqual({ secret: 'SECRET123', qrCode: 'data:image/png' });
  });

  it('reports a setup failure with the fallback message', async () => {
    const { result } = await renderLoadedHook();

    mockMfaApi({
      '/api/mfa/setup': () => Promise.reject({ status: 500 }),
    });
    await act(async () => {
      await result.current.handleMfaSetup();
    });

    expect(result.current.showMfaSetup).toBe(false);
    expect(result.current.mfaMessage).toEqual({
      type: 'error',
      text: 'Failed to start MFA setup',
    });
  });

  it('only sends one setup request for a same-tick double submit', async () => {
    const { result } = await renderLoadedHook();

    const setupDeferred = deferred<{ secret: string; qrCode: string }>();
    mockMfaApi({
      '/api/mfa/setup': () => setupDeferred.promise,
    });

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.handleMfaSetup();
      second = result.current.handleMfaSetup();
    });

    setupDeferred.resolve({ secret: 'S', qrCode: 'qr' });
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(setupCallCount()).toBe(1);
    expect(result.current.showMfaSetup).toBe(true);
  });

  it('rejects verification codes that are not 6 digits without calling the API', async () => {
    const { result } = await renderLoadedHook();

    act(() => {
      result.current.setMfaVerifyCode('123');
    });
    await act(async () => {
      await result.current.handleMfaVerify();
    });

    expect(result.current.mfaMessage).toEqual({
      type: 'error',
      text: 'Please enter a 6-digit code',
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/mfa/verify-setup', expect.anything());
  });

  it('enables MFA and shows backup codes after a successful verify', async () => {
    const { result } = await renderLoadedHook();

    mockMfaApi({
      '/api/mfa/setup': () => Promise.resolve({ secret: 'S', qrCode: 'qr' }),
      '/api/mfa/verify-setup': () => Promise.resolve({ backupCodes: ['code-1', 'code-2'] }),
    });
    await act(async () => {
      await result.current.handleMfaSetup();
    });
    act(() => {
      result.current.setMfaVerifyCode('123456');
    });
    await act(async () => {
      await result.current.handleMfaVerify();
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/mfa/verify-setup', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
    expect(result.current.mfaEnabled).toBe(true);
    expect(result.current.backupCodes).toEqual(['code-1', 'code-2']);
    expect(result.current.showBackupCodes).toBe(true);
    expect(result.current.showMfaSetup).toBe(false);
    expect(result.current.mfaSetupData).toBeNull();
    expect(result.current.mfaVerifyCode).toBe('');
    expect(result.current.mfaMessage).toEqual({
      type: 'success',
      text: 'Two-factor authentication enabled!',
    });
  });

  it('reports a failed verify with the fallback message', async () => {
    const { result } = await renderLoadedHook();

    mockMfaApi({
      '/api/mfa/verify-setup': () => Promise.reject({ status: 400 }),
    });
    act(() => {
      result.current.setMfaVerifyCode('123456');
    });
    await act(async () => {
      await result.current.handleMfaVerify();
    });

    expect(result.current.mfaEnabled).toBe(false);
    expect(result.current.mfaMessage).toEqual({ type: 'error', text: 'Failed to verify code' });
  });

  it('disables MFA with the entered password and resets the dialog', async () => {
    mockMfaApi({
      '/api/mfa/status': () => Promise.resolve({ mfaEnabled: true }),
    });
    const { result } = await renderLoadedHook();

    act(() => {
      result.current.openDisableMfa();
      result.current.setDisableMfaPassword('CorrectHorse123!');
    });
    expect(result.current.showDisableMfa).toBe(true);

    mockMfaApi({
      '/api/mfa/disable': () => Promise.resolve({}),
    });
    await act(async () => {
      await result.current.handleMfaDisable();
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password: 'CorrectHorse123!' }),
    });
    expect(result.current.mfaEnabled).toBe(false);
    expect(result.current.showDisableMfa).toBe(false);
    expect(result.current.disableMfaPassword).toBe('');
    expect(result.current.mfaMessage).toEqual({
      type: 'success',
      text: 'Two-factor authentication disabled',
    });
  });

  it('refuses to close the setup dialog while a request is in flight', async () => {
    const { result } = await renderLoadedHook();

    const verifyDeferred = deferred<{ backupCodes?: string[] }>();
    mockMfaApi({
      '/api/mfa/setup': () => Promise.resolve({ secret: 'S', qrCode: 'qr' }),
      '/api/mfa/verify-setup': () => verifyDeferred.promise,
    });
    await act(async () => {
      await result.current.handleMfaSetup();
    });
    act(() => {
      result.current.setMfaVerifyCode('123456');
    });

    let verifyPromise!: Promise<void>;
    await act(async () => {
      verifyPromise = result.current.handleMfaVerify();
    });
    expect(result.current.isMfaLoading).toBe(true);

    act(() => {
      result.current.closeMfaSetup();
    });
    expect(result.current.showMfaSetup).toBe(true);

    verifyDeferred.resolve({ backupCodes: [] });
    await act(async () => {
      await verifyPromise;
    });
    expect(result.current.showMfaSetup).toBe(false);
  });

  it('copies the setup secret and marks it copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const { result } = await renderLoadedHook();

    mockMfaApi({
      '/api/mfa/setup': () => Promise.resolve({ secret: 'SECRET123', qrCode: 'qr' }),
    });
    await act(async () => {
      await result.current.handleMfaSetup();
    });
    await act(async () => {
      await result.current.copySecret();
    });

    expect(writeText).toHaveBeenCalledWith('SECRET123');
    expect(result.current.copiedSecret).toBe(true);
    expect(result.current.mfaMessage).toBeNull();
  });

  it('reports when the clipboard is unavailable instead of copying', async () => {
    stubClipboard(undefined);

    const { result } = await renderLoadedHook();

    mockMfaApi({
      '/api/mfa/setup': () => Promise.resolve({ secret: 'SECRET123', qrCode: 'qr' }),
    });
    await act(async () => {
      await result.current.handleMfaSetup();
    });
    await act(async () => {
      await result.current.copySecret();
    });

    expect(result.current.copiedSecret).toBe(false);
    expect(result.current.mfaMessage).toEqual({
      type: 'error',
      text: 'Clipboard is not available in this browser',
    });
  });

  it('clears backup codes when their dialog is closed', async () => {
    const { result } = await renderLoadedHook();

    mockMfaApi({
      '/api/mfa/setup': () => Promise.resolve({ secret: 'S', qrCode: 'qr' }),
      '/api/mfa/verify-setup': () => Promise.resolve({ backupCodes: ['code-1'] }),
    });
    await act(async () => {
      await result.current.handleMfaSetup();
    });
    act(() => {
      result.current.setMfaVerifyCode('123456');
    });
    await act(async () => {
      await result.current.handleMfaVerify();
    });
    expect(result.current.showBackupCodes).toBe(true);

    act(() => {
      result.current.closeBackupCodes();
    });

    expect(result.current.showBackupCodes).toBe(false);
    expect(result.current.backupCodes).toEqual([]);
  });
});
