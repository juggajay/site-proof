import { describe, expect, it } from 'vitest';
import { STATUS_LABELS, formatStatusLabel } from './statusLabels';

describe('formatStatusLabel', () => {
  describe('known lot statuses', () => {
    it('maps lot workflow enums to their canonical labels', () => {
      expect(formatStatusLabel('not_started')).toBe('Not Started');
      expect(formatStatusLabel('in_progress')).toBe('In Progress');
      expect(formatStatusLabel('awaiting_test')).toBe('Awaiting Test');
      expect(formatStatusLabel('hold_point')).toBe('Hold Point');
      expect(formatStatusLabel('ncr_raised')).toBe('NCR Raised');
      expect(formatStatusLabel('on_hold')).toBe('On Hold');
      expect(formatStatusLabel('pending')).toBe('Pending');
      expect(formatStatusLabel('completed')).toBe('Completed');
      expect(formatStatusLabel('conformed')).toBe('Conformed');
      expect(formatStatusLabel('claimed')).toBe('Claimed');
    });
  });

  describe('known NCR statuses', () => {
    it('maps NCR workflow enums to their canonical labels', () => {
      expect(formatStatusLabel('open')).toBe('Open');
      expect(formatStatusLabel('investigating')).toBe('Investigating');
      expect(formatStatusLabel('rectification')).toBe('Rectification');
      expect(formatStatusLabel('verification')).toBe('Verification');
      expect(formatStatusLabel('closed')).toBe('Closed');
      expect(formatStatusLabel('closed_concession')).toBe('Closed (Concession)');
    });
  });

  describe('known docket statuses', () => {
    it('maps docket approval enums to their canonical labels', () => {
      expect(formatStatusLabel('draft')).toBe('Draft');
      expect(formatStatusLabel('pending_approval')).toBe('Pending Approval');
      expect(formatStatusLabel('approved')).toBe('Approved');
      expect(formatStatusLabel('rejected')).toBe('Rejected');
      expect(formatStatusLabel('queried')).toBe('Queried');
    });
  });

  describe('known claim, hold-point, and subcontractor statuses', () => {
    it('maps adjacent workflow enums to their canonical labels', () => {
      expect(formatStatusLabel('submitted')).toBe('Submitted');
      expect(formatStatusLabel('partially_paid')).toBe('Partially Paid');
      expect(formatStatusLabel('released')).toBe('Released');
      expect(formatStatusLabel('suspended')).toBe('Suspended');
    });
  });

  describe('lookup normalization', () => {
    it('is case-insensitive and tolerates spaces/hyphens as delimiters', () => {
      expect(formatStatusLabel('OPEN')).toBe('Open');
      expect(formatStatusLabel('Closed_Concession')).toBe('Closed (Concession)');
      expect(formatStatusLabel('closed concession')).toBe('Closed (Concession)');
      expect(formatStatusLabel('closed-concession')).toBe('Closed (Concession)');
      expect(formatStatusLabel('In Progress')).toBe('In Progress');
      expect(formatStatusLabel('  awaiting_test  ')).toBe('Awaiting Test');
    });
  });

  describe('unknown statuses fall back to safe Title Case', () => {
    it('title-cases the words and never leaks an underscore or hyphen', () => {
      expect(formatStatusLabel('awaiting_review')).toBe('Awaiting Review');
      expect(formatStatusLabel('multi_word_thing')).toBe('Multi Word Thing');
      expect(formatStatusLabel('some-weird-status')).toBe('Some Weird Status');
      expect(formatStatusLabel('SHOUTING')).toBe('Shouting');
    });

    it('produces no underscores for any unknown value', () => {
      const result = formatStatusLabel('closed_no_action_required');
      expect(result).toBe('Closed No Action Required');
      expect(result).not.toContain('_');
    });
  });

  describe('empty / nullish handling', () => {
    it('returns the default fallback for empty, null, undefined, or whitespace', () => {
      expect(formatStatusLabel('')).toBe('-');
      expect(formatStatusLabel(null)).toBe('-');
      expect(formatStatusLabel(undefined)).toBe('-');
      expect(formatStatusLabel('   ')).toBe('-');
    });

    it('honors a custom fallback', () => {
      expect(formatStatusLabel('', { fallback: 'Unknown' })).toBe('Unknown');
      expect(formatStatusLabel(null, { fallback: 'Not set' })).toBe('Not set');
    });
  });

  describe('STATUS_LABELS map', () => {
    it('never contains an underscore in any human label', () => {
      for (const label of Object.values(STATUS_LABELS)) {
        expect(label).not.toContain('_');
      }
    });
  });
});
