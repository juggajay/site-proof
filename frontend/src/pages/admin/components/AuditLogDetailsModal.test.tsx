import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLogDetailsModal } from './AuditLogDetailsModal';
import type { AuditLog } from '../auditLogDisplay';

afterEach(() => {
  cleanup();
});

// Date/time fields are deliberately not asserted — formatDateTime uses
// toLocaleString('en-AU'), which is timezone/locale dependent.
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

describe('AuditLogDetailsModal', () => {
  it('shows the formatted action, entity, and change payload', () => {
    render(<AuditLogDetailsModal log={baseLog} onClose={vi.fn()} />);

    expect(screen.getByText('Audit Log Details')).toBeInTheDocument();
    expect(screen.getByText('Lot force conformed')).toBeInTheDocument();
    expect(screen.getByText('abcdef1234567890')).toBeInTheDocument();
    expect(screen.getByText('QA Owner')).toBeInTheDocument();
    expect(screen.getByText('Highway Upgrade')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.10')).toBeInTheDocument();
    expect(screen.getByText('Reason: Survey conformance evidence attached')).toBeInTheDocument();
    // formatChanges pretty-prints the captured JSON payload.
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName === 'PRE' &&
          content.includes('"reason": "Survey conformance evidence attached"')
        );
      }),
    ).toBeInTheDocument();
  });

  it('falls back to System and - when user and project are missing', () => {
    render(
      <AuditLogDetailsModal
        log={{ ...baseLog, user: null, project: null, ipAddress: null, changes: null }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('calls onClose from the footer Close button', () => {
    const onClose = vi.fn();
    render(<AuditLogDetailsModal log={baseLog} onClose={onClose} />);

    // The dialog also renders Radix's built-in X button (sr-only "Close");
    // pin the explicit footer button, which has plain text content.
    const footerClose = screen
      .getAllByRole('button', { name: 'Close' })
      .find((button) => !button.querySelector('.sr-only'));
    expect(footerClose).toBeDefined();
    fireEvent.click(footerClose!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
