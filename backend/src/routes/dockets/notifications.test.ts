import { describe, expect, it } from 'vitest';
import {
  buildDocketApprovedNotifications,
  buildDocketQueriedNotifications,
  buildDocketQueryResponseNotification,
  buildDocketRejectedNotifications,
  buildDocketSubmittedNotifications,
} from './notifications.js';

const LINK = '/projects/proj-1/dockets';
const base = {
  projectId: 'proj-1',
  projectName: 'Test Project',
  docketNumber: 'DKT-ABC123',
  docketDate: '2026-01-15',
};

describe('dockets notification builders (pure)', () => {
  describe('buildDocketSubmittedNotifications', () => {
    it('builds the in-app and email payloads (plural pending count)', () => {
      const { inApp, email } = buildDocketSubmittedNotifications({
        ...base,
        subcontractorName: 'Acme Pty Ltd',
        pendingCount: 3,
      });
      expect(inApp).toStrictEqual({
        projectId: 'proj-1',
        type: 'docket_pending',
        title: 'Docket Pending Approval',
        message:
          'Acme Pty Ltd has submitted docket DKT-ABC123 (2026-01-15) for approval. 3 dockets pending.',
        linkUrl: LINK,
      });
      expect(email).toStrictEqual({
        title: 'Docket Pending Approval',
        message:
          'Acme Pty Ltd has submitted docket DKT-ABC123 (2026-01-15) for approval.\n\nProject: Test Project\nPending Dockets: 3\n\nPlease review and approve at your earliest convenience.',
        projectName: 'Test Project',
        linkUrl: LINK,
      });
    });

    it('uses the singular "docket" when exactly one is pending', () => {
      const { inApp } = buildDocketSubmittedNotifications({
        ...base,
        subcontractorName: 'Acme Pty Ltd',
        pendingCount: 1,
      });
      expect(inApp.message).toBe(
        'Acme Pty Ltd has submitted docket DKT-ABC123 (2026-01-15) for approval. 1 docket pending.',
      );
    });
  });

  describe('buildDocketApprovedNotifications', () => {
    it('includes adjustment hints when an adjustment reason and notes are present', () => {
      const { inApp, email } = buildDocketApprovedNotifications({
        ...base,
        approverName: 'Alice',
        foremanNotes: 'Good work',
        adjustmentReason: 'Rounded down',
      });
      expect(inApp.message).toBe(
        'Your docket DKT-ABC123 (2026-01-15) has been approved by Alice. Status: Approved (with adjustments).',
      );
      expect(email.message).toBe(
        'Your docket DKT-ABC123 (2026-01-15) has been approved by Alice.\n\nProject: Test Project\nStatus: Approved\nNotes: Good work\nAdjustment Reason: Rounded down',
      );
      expect(inApp.type).toBe('docket_approved');
    });

    it('omits adjustment hints (and leaves the blank note lines) when null', () => {
      const { inApp, email } = buildDocketApprovedNotifications({
        ...base,
        approverName: 'Alice',
        foremanNotes: null,
        adjustmentReason: null,
      });
      expect(inApp.message).toBe(
        'Your docket DKT-ABC123 (2026-01-15) has been approved by Alice. Status: Approved.',
      );
      expect(email.message).toBe(
        'Your docket DKT-ABC123 (2026-01-15) has been approved by Alice.\n\nProject: Test Project\nStatus: Approved\n\n',
      );
    });
  });

  describe('buildDocketRejectedNotifications', () => {
    it('appends the reason when present', () => {
      const { inApp, email } = buildDocketRejectedNotifications({
        ...base,
        rejectorName: 'Bob',
        reason: 'Hours look wrong',
      });
      expect(inApp.message).toBe(
        'Your docket DKT-ABC123 (2026-01-15) has been rejected by Bob. Reason: Hours look wrong',
      );
      expect(email.message).toBe(
        'Your docket DKT-ABC123 (2026-01-15) has been rejected by Bob.\n\nProject: Test Project\nStatus: Rejected\nReason: Hours look wrong\n\nPlease review and resubmit if necessary.',
      );
      expect(inApp.type).toBe('docket_rejected');
    });

    it('uses "No reason provided." in the email when reason is null', () => {
      const { inApp, email } = buildDocketRejectedNotifications({
        ...base,
        rejectorName: 'Bob',
        reason: null,
      });
      expect(inApp.message).toBe('Your docket DKT-ABC123 (2026-01-15) has been rejected by Bob.');
      expect(email.message).toBe(
        'Your docket DKT-ABC123 (2026-01-15) has been rejected by Bob.\n\nProject: Test Project\nStatus: Rejected\nNo reason provided.\n\nPlease review and resubmit if necessary.',
      );
    });
  });

  describe('buildDocketQueriedNotifications', () => {
    it('builds in-app/email payloads with a short question', () => {
      const { inApp, email } = buildDocketQueriedNotifications({
        ...base,
        querierName: 'Carol',
        questions: 'Why 8 hours?',
      });
      expect(inApp).toStrictEqual({
        projectId: 'proj-1',
        type: 'docket_queried',
        title: 'Docket Query',
        message:
          'Carol has raised a query on docket DKT-ABC123 (2026-01-15).\n\nQuestions: Why 8 hours?\n\nPlease review and respond or amend the docket.',
        linkUrl: LINK,
      });
      expect(email.title).toBe('Docket Query - Response Required');
      expect(email.message).toBe(
        'Carol has raised a query on docket DKT-ABC123 (2026-01-15).\n\nProject: Test Project\n\nQuestions/Issues:\nWhy 8 hours?\n\nPlease review and respond or amend the docket.',
      );
    });

    it('truncates the in-app questions to 200 chars with an ellipsis but keeps the email full', () => {
      const questions = 'q'.repeat(250);
      const { inApp, email } = buildDocketQueriedNotifications({
        ...base,
        querierName: 'Carol',
        questions,
      });
      expect(inApp.message).toContain(`Questions: ${'q'.repeat(200)}...`);
      expect(inApp.message).not.toContain('q'.repeat(201));
      expect(email.message).toContain(`Questions/Issues:\n${'q'.repeat(250)}`);
    });
  });

  describe('buildDocketQueryResponseNotification', () => {
    it('builds only an in-app payload (no email)', () => {
      const result = buildDocketQueryResponseNotification({
        projectId: 'proj-1',
        docketNumber: 'DKT-ABC123',
        docketDate: '2026-01-15',
        responderName: 'Dave',
        response: 'Fixed the hours',
      });
      expect('email' in result).toBe(false);
      expect(result.inApp).toStrictEqual({
        projectId: 'proj-1',
        type: 'docket_query_response',
        title: 'Docket Query Response',
        message:
          'Dave has responded to the query on docket DKT-ABC123 (2026-01-15).\n\nResponse: Fixed the hours\n\nThe docket is ready for review.',
        linkUrl: LINK,
      });
    });

    it('truncates the response to 200 chars with an ellipsis', () => {
      const { inApp } = buildDocketQueryResponseNotification({
        projectId: 'proj-1',
        docketNumber: 'DKT-ABC123',
        docketDate: '2026-01-15',
        responderName: 'Dave',
        response: 'r'.repeat(250),
      });
      expect(inApp.message).toContain(`Response: ${'r'.repeat(200)}...`);
      expect(inApp.message).not.toContain('r'.repeat(201));
    });
  });
});
