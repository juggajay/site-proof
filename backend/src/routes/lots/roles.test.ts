import { describe, expect, it } from 'vitest';
import {
  LOT_CONFORMERS,
  LOT_CREATORS,
  LOT_DELETERS,
  LOT_FORCE_CONFORMERS,
  STATUS_OVERRIDERS,
} from './roles.js';

// These are pure authorization role lists — freeze the exact arrays so an
// accidental edit cannot silently widen or narrow who may act on lots.
describe('lots role constants (pure)', () => {
  it('LOT_CREATORS is exactly owner/admin/project_manager/site_manager/foreman', () => {
    expect(LOT_CREATORS).toEqual(['owner', 'admin', 'project_manager', 'site_manager', 'foreman']);
  });

  it('LOT_DELETERS is exactly owner/admin/project_manager', () => {
    expect(LOT_DELETERS).toEqual(['owner', 'admin', 'project_manager']);
  });

  it('LOT_CONFORMERS adds quality_manager to the management roles', () => {
    expect(LOT_CONFORMERS).toEqual(['owner', 'admin', 'project_manager', 'quality_manager']);
    expect(LOT_CONFORMERS).toContain('quality_manager');
  });

  it('LOT_FORCE_CONFORMERS is restricted to owner/admin', () => {
    expect(LOT_FORCE_CONFORMERS).toEqual(['owner', 'admin']);
  });

  it('STATUS_OVERRIDERS is exactly owner/admin/project_manager/quality_manager', () => {
    expect(STATUS_OVERRIDERS).toEqual(['owner', 'admin', 'project_manager', 'quality_manager']);
    // Same membership as LOT_CONFORMERS today, but a distinct authorization gate
    // (status override vs conform) — kept as its own constant, not an alias.
    expect(STATUS_OVERRIDERS).toEqual(LOT_CONFORMERS);
    expect(STATUS_OVERRIDERS).not.toBe(LOT_CONFORMERS);
  });

  it('encodes the expected role relationships', () => {
    // Force-conform is the strictest set; deleters are a subset of conformers.
    expect(LOT_FORCE_CONFORMERS.every((role) => LOT_CONFORMERS.includes(role))).toBe(true);
    expect(LOT_DELETERS.every((role) => LOT_CONFORMERS.includes(role))).toBe(true);
    // Field roles can create lots but not delete or conform them.
    expect(LOT_CREATORS).toContain('site_manager');
    expect(LOT_CREATORS).toContain('foreman');
    expect(LOT_DELETERS).not.toContain('site_manager');
    expect(LOT_DELETERS).not.toContain('foreman');
    expect(LOT_CONFORMERS).not.toContain('site_manager');
    expect(LOT_CONFORMERS).not.toContain('foreman');
    // quality_manager can conform but cannot create or delete.
    expect(LOT_CREATORS).not.toContain('quality_manager');
    expect(LOT_DELETERS).not.toContain('quality_manager');
  });
});
