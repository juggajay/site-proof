import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLogTable } from './AuditLogTable';
import type { AuditLog } from '../auditLogDisplay';

afterEach(() => {
  cleanup();
});

// Wiring tests for the results table moved out of AuditLogPage. Date/time cells
// are deliberately not asserted — formatDateTime uses toLocaleString('en-AU'),
// which is timezone/locale dependent.
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

describe('AuditLogTable', () => {
  it('renders System when the log has no user', () => {
    const systemLog: AuditLog = { ...baseLog, id: 'log-2', user: null, project: null };
    render(<AuditLogTable logs={[baseLog, systemLog]} onViewDetails={vi.fn()} />);

    expect(screen.getByText('QA Owner')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('shows the formatted action label and change summary', () => {
    render(<AuditLogTable logs={[baseLog]} onViewDetails={vi.fn()} />);

    expect(screen.getByText('Lot force conformed')).toBeInTheDocument();
    expect(screen.getByText('Reason: Survey conformance evidence attached')).toBeInTheDocument();
  });

  it('calls the details callback with the selected row', () => {
    const onViewDetails = vi.fn();
    render(<AuditLogTable logs={[baseLog]} onViewDetails={onViewDetails} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'View details for Lot force conformed Lot abcdef12' }),
    );

    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(onViewDetails).toHaveBeenCalledWith(baseLog);
  });

  it('wraps the table in horizontal overflow so details remain reachable on narrow screens', () => {
    render(<AuditLogTable logs={[baseLog]} onViewDetails={vi.fn()} />);

    const table = screen.getByRole('table');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
    expect(table.className).toContain('min-w-');
  });
});
