import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';
import { ClancyWidget } from './ClancyWidget';
import { resetClancyStore } from './clancyChatState';

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
      <ClancyWidget />
    </MemoryRouter>,
  );
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
  it('renders the bubble only when AI is configured', () => {
    writeLocalStorageItem(INTRO_FLAG, '1'); // suppress auto-open
    const { unmount } = renderWidget();
    const bubble = screen.getByLabelText('Open Clancy, your copilot');
    expect(bubble).toBeInTheDocument();
    // Rename regression (live browser test): the bubble hardcoded "J" and
    // referenced a CSS class that no longer existed, losing its fixed
    // positioning. Pin the monogram and the class the stylesheet defines.
    expect(bubble).toHaveTextContent('C');
    expect(bubble.className).toContain('clancy-bubble');
    unmount();

    aiState.configured = false;
    renderWidget();
    expect(screen.queryByLabelText('Open Clancy, your copilot')).not.toBeInTheDocument();
  });

  it('renders only for office roles — field roles never see Clancy', () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    for (const role of ['foreman', 'site_manager', 'quality_manager', 'subcontractor']) {
      authState.roleInCompany = role;
      const { unmount } = renderWidget();
      expect(screen.queryByLabelText('Open Clancy, your copilot')).not.toBeInTheDocument();
      unmount();
    }

    for (const role of ['admin', 'project_manager']) {
      authState.roleInCompany = role;
      const { unmount } = renderWidget();
      expect(screen.getByLabelText('Open Clancy, your copilot')).toBeInTheDocument();
      unmount();
    }
  });

  it('does not auto-open the first-run intro for a non-admin role', () => {
    vi.useFakeTimers();
    authState.roleInCompany = 'foreman';
    renderWidget();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('auto-opens once for a first-run user and sets the seen flag on close', () => {
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

  it('sends a suggested prompt as a user message', async () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    apiFetchMock.mockResolvedValue({ message: 'Start with the control line.' });
    renderWidget();

    fireEvent.click(screen.getByLabelText('Open Clancy, your copilot'));
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

    fireEvent.click(screen.getByLabelText('Open Clancy, your copilot'));
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

    fireEvent.click(screen.getByLabelText('Open Clancy, your copilot'));
    fireEvent.click(screen.getByText('What should I do first?'));

    const chip = await screen.findByText(/Open: Read setout sheets/);
    fireEvent.click(chip);
    expect(navigateMock).toHaveBeenCalledWith('/projects/project-1/copilot?stage=control_line');
  });

  it('closes on Escape and returns focus to the bubble', () => {
    writeLocalStorageItem(INTRO_FLAG, '1');
    renderWidget();
    const bubble = screen.getByLabelText('Open Clancy, your copilot');

    fireEvent.click(bubble);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(bubble);
  });
});
