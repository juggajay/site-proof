import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLogMobileList } from './AuditLogMobileList';
import type { AuditLog } from '../auditLogDisplay';

afterEach(() => {
  cleanup();
});

// Phone fallback for the results table. Date/time text is deliberately not
// asserted — formatDateTime uses toLocaleString('en-AU'), which is
// timezone/locale dependent.
const baseLog: AuditLog = {
  id: 'log-1',
  action: 'lot_force_conformed',
  entityType: 'Lot',
  entityId: 'abcdef1234567890',
  changes: { reason: 'Survey conformance evidence attached' },
  ipAddress: '203.0.113.10',
  userAgent: 'Mozilla/5.0',
  createdAt: '2026-06-01T03:30:00.000Z',
  user: { id: 'user-1', email: 'qa@example.com', fullName: 'QA Owner' },
  project: { id: 'project-1', name: 'Highway Upgrade', projectNumber: 'P-001' },
};

describe('AuditLogMobileList', () => {
  it('shows every column the desktop table has, without a table', () => {
    render(<AuditLogMobileList logs={[baseLog]} onViewDetails={vi.fn()} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Lot force conformed')).toBeInTheDocument();
    expect(screen.getByText('Reason: Survey conformance evidence attached')).toBeInTheDocument();
    expect(screen.getByText('Lot #abcdef12')).toBeInTheDocument();
    expect(screen.getByText('QA Owner')).toBeInTheDocument();
    expect(screen.getByText(/Highway Upgrade/)).toBeInTheDocument();
  });

  it('renders System when the log has no user', () => {
    const systemLog: AuditLog = { ...baseLog, id: 'log-2', user: null, project: null };
    render(<AuditLogMobileList logs={[systemLog]} onViewDetails={vi.fn()} />);

    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('opens details when the card is tapped', () => {
    const onViewDetails = vi.fn();
    render(<AuditLogMobileList logs={[baseLog]} onViewDetails={onViewDetails} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(onViewDetails).toHaveBeenCalledWith(baseLog);
  });
});
