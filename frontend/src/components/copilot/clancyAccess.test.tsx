import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClancyEnabled } from './clancyAccess';

const aiState = vi.hoisted(() => ({ configured: true }));
const authState = vi.hoisted(() => ({ roleInCompany: 'owner' }));

vi.mock('@/hooks/useAiStatus', () => ({
  useAiStatus: () => ({ aiConfigured: aiState.configured }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { roleInCompany: authState.roleInCompany } }),
}));

// Probe: renders "on" only when the header entry point should show.
function Probe() {
  return <span>{useClancyEnabled() ? 'on' : 'off'}</span>;
}

beforeEach(() => {
  aiState.configured = true;
  authState.roleInCompany = 'owner';
});

describe('useClancyEnabled', () => {
  it('is on for office roles', () => {
    for (const role of ['owner', 'admin', 'project_manager']) {
      authState.roleInCompany = role;
      const { unmount } = render(<Probe />);
      expect(screen.getByText('on')).toBeInTheDocument();
      unmount();
    }
  });

  it('is off for field roles', () => {
    for (const role of ['foreman', 'site_manager', 'quality_manager', 'subcontractor', 'viewer']) {
      authState.roleInCompany = role;
      const { unmount } = render(<Probe />);
      expect(screen.getByText('off')).toBeInTheDocument();
      unmount();
    }
  });

  it('is off when AI is unconfigured, even for an owner', () => {
    aiState.configured = false;
    render(<Probe />);
    expect(screen.getByText('off')).toBeInTheDocument();
  });
});
