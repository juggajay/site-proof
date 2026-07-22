import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';
import { ClancyWidget } from './ClancyWidget';
import { openClancy, resetClancyStore } from './clancyChatState';

const INTRO_FLAG = 'clancy-intro-seen';

const navigateMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());
const aiState = vi.hoisted(() => ({ configured: true }));
const authState = vi.hoisted(() => ({ roleInCompany: 'owner' }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));
vi.mock('@/hooks/useAiStatus', () => ({
  useAiStatus: () => ({ aiConfigured: aiState.configured }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jayson Ryan', roleInCompany: authState.roleInCompany } }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiFetch: apiFetchMock,
}));

function renderWidget() {
  return render(
    <MemoryRouter initialEntries={['/projects/project-1/lots']}>
      {/* Stand-in for the header entry point the drawer returns focus to. */}
      <button id="clancy-header-button" type="button" data-testid="header-button" />
      <ClancyWidget />
    </MemoryRouter>,
  );
}

function pressCmdJ() {
  fireEvent.keyDown(document, { key: 'j', metaKey: true });
}

beforeEach(() => {
  resetClancyStore();
  removeLocalStorageItem(INTRO_FLAG);
  navigateMock.mockReset();
  toastMock.mockReset();
  apiFetchMock.mockReset();
  aiState.configured = true;
  authState.roleInCompany = 'owner';
});

afterEach(() => {
  vi.useRealTimers();
  resetClancyStore();
});

describe('ClancyWidget', () => {
  it('⌘J does not open the drawer when AI is unconfigured', () => {
    writeLocalStorageItem(INTRO_FLAG, '1'); // suppress auto-open
    aiState.configured = false;
    renderWidget();
    pressCmdJ();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('⌘J does not open the drawer for field roles', () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    for (const role of ['foreman', 'site_manager', 'quality_manager', 'subcontractor']) {
      authState.roleInCompany = role;
      const { unmount } = renderWidget();
      pressCmdJ();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('⌘J toggles the drawer for office roles', () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    for (const role of ['owner', 'admin', 'project_manager']) {
      authState.roleInCompany = role;
      const { unmount } = renderWidget();

      pressCmdJ();
      const dialog = screen.getByRole('dialog');
      // The drawer container carries the (renamed) animation class.
      expect(dialog.className).toContain('clancy-drawer');
      // The "C" monogram now lives on the avatar in the drawer header.
      expect(within(dialog).getByText('C')).toBeInTheDocument();

      pressCmdJ();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      unmount();
      resetClancyStore();
    }
  });

  it('auto-opens the drawer once for a first-run user and sets the seen flag on close', () => {
    vi.useFakeTimers();
    renderWidget();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/I'm Clancy, your CIVOS copilot/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close Clancy'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readLocalStorageItem(INTRO_FLAG)).toBe('1');
  });

  it('does not auto-open the first-run intro for a non-office role', () => {
    vi.useFakeTimers();
    authState.roleInCompany = 'foreman';
    renderWidget();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the header button', () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    renderWidget();
    act(() => openClancy());

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.getElementById('clancy-header-button'));
  });

  it('sends a suggested prompt as a user message', async () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    apiFetchMock.mockResolvedValue({ message: 'Start with the control line.' });
    renderWidget();

    act(() => openClancy());
    fireEvent.click(screen.getByText('What should I do first?'));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const [, opts] = apiFetchMock.mock.calls[0];
    expect(JSON.parse(opts.body).messages.at(-1).content).toBe('What should I do first?');
    expect(await screen.findByText('Start with the control line.')).toBeInTheDocument();
  });

  it('executes a navigate action with a toast when Clancy replies', async () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    apiFetchMock.mockResolvedValue({
      message: 'Opening plan sheets.',
      actions: [{ type: 'navigate', to: '/projects/project-1/plan-sheets' }],
    });
    renderWidget();

    act(() => openClancy());
    fireEvent.click(screen.getByText('Read my drawings for me'));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/projects/project-1/plan-sheets'),
    );
    expect(toastMock).toHaveBeenCalledWith({ description: 'Taking you to Plan Sheets' });
  });

  it('renders an open_stage chip that navigates to the copilot stage URL', async () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    apiFetchMock.mockResolvedValue({
      message: 'Ready when you are.',
      actions: [{ type: 'open_stage', stage: 'control_line', projectId: 'project-1' }],
    });
    renderWidget();

    act(() => openClancy());
    fireEvent.click(screen.getByText('What should I do first?'));

    const chip = await screen.findByText(/Open: Read setout sheets/);
    fireEvent.click(chip);
    expect(navigateMock).toHaveBeenCalledWith('/projects/project-1/copilot?stage=control_line');
  });
});
