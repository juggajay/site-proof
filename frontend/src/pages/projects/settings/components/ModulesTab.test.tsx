import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnabledModules } from '../types';
import { ModulesTab } from './ModulesTab';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

const ENABLED_MODULES: EnabledModules = {
  costTracking: true,
  progressClaims: true,
  subcontractors: true,
  dockets: true,
  dailyDiary: true,
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('ModulesTab', () => {
  it('describes project modules as navigation shortcuts only', () => {
    render(<ModulesTab projectId="project-1" initialEnabledModules={{ ...ENABLED_MODULES }} />);

    expect(screen.getByText('Project Module Shortcuts')).toBeInTheDocument();
    expect(
      screen.getByText(/navigation shortcut setting only; it does not delete data/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Show Docket Approvals in project navigation')).toBeInTheDocument();
  });

  it('persists module shortcut visibility changes', async () => {
    apiFetchMock.mockResolvedValueOnce({});
    render(<ModulesTab projectId="project-1" initialEnabledModules={{ ...ENABLED_MODULES }} />);

    const docketsToggle = screen.getByLabelText(/Docket Approvals/i) as HTMLInputElement;
    fireEvent.click(docketsToggle);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1', {
        method: 'PATCH',
        body: JSON.stringify({
          settings: { enabledModules: { ...ENABLED_MODULES, dockets: false } },
        }),
      });
    });
    expect(docketsToggle).not.toBeChecked();
  });
});
