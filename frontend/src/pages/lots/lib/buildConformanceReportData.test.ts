import { describe, expect, it } from 'vitest';
import { buildConformanceReportData } from './buildConformanceReportData';
import type { ITPChecklistItem, ITPCompletion, ITPInstance, Lot } from '../types';
import type { ConformanceReportData } from '@/lib/pdfGenerator';

const baseLot = {
  lotNumber: 'LOT-001',
  description: 'Subgrade preparation',
  status: 'conformed',
  activityType: 'Earthworks',
  chainageStart: 100,
  chainageEnd: 250,
  layer: 'Layer 1',
  areaZone: 'Zone A',
  conformedAt: '2026-05-30T00:00:00.000Z',
  conformedBy: { fullName: 'Jane Foreman', email: 'jane@example.com' },
} as Lot;

const person = (fullName: string | null, email: string) =>
  ({ id: `u-${email}`, fullName, email }) as ITPCompletion['completedBy'];

function checklistItem(partial: Partial<ITPChecklistItem>): ITPChecklistItem {
  return {
    id: 'item',
    description: 'Item',
    category: 'general',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'none',
    order: 0,
    ...partial,
  };
}

function completion(partial: Partial<ITPCompletion>): ITPCompletion {
  return {
    id: 'completion',
    checklistItemId: 'item',
    isCompleted: true,
    notes: null,
    completedAt: null,
    completedBy: null,
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
    attachments: [],
    ...partial,
  };
}

const attachments = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `att-${i}` })) as ITPCompletion['attachments'];

describe('buildConformanceReportData', () => {
  it('maps the core lot and project fields verbatim', () => {
    const report = buildConformanceReportData({
      lot: baseLot,
      project: { name: 'Pacific Highway Upgrade', projectNumber: 'PRJ-42' },
      itpInstance: null,
    });

    expect(report.lot).toEqual({
      lotNumber: 'LOT-001',
      description: 'Subgrade preparation',
      status: 'conformed',
      activityType: 'Earthworks',
      chainageStart: 100,
      chainageEnd: 250,
      layer: 'Layer 1',
      areaZone: 'Zone A',
      conformedAt: '2026-05-30T00:00:00.000Z',
      conformedBy: { fullName: 'Jane Foreman', email: 'jane@example.com' },
    });
    expect(report.project).toEqual({ name: 'Pacific Highway Upgrade', projectNumber: 'PRJ-42' });
  });

  it('defaults a missing project number to null', () => {
    const report = buildConformanceReportData({
      lot: baseLot,
      project: { name: 'No Number Project' },
      itpInstance: null,
    });

    expect(report.project).toEqual({ name: 'No Number Project', projectNumber: null });
  });

  it('sums photo count across completion attachments', () => {
    const itpInstance: ITPInstance = {
      id: 'itp-1',
      template: { id: 't-1', name: 'Earthworks ITP', checklistItems: [] },
      completions: [
        completion({ id: 'c1', attachments: attachments(2) }),
        completion({ id: 'c2', attachments: attachments(3) }),
        completion({ id: 'c3', attachments: [] }),
      ],
    };

    const report = buildConformanceReportData({
      lot: baseLot,
      project: { name: 'P' },
      itpInstance,
    });

    expect(report.photoCount).toBe(5);
  });

  it('maps only verified hold-point completions, preserving release fallbacks and order', () => {
    const checklistItems: ITPChecklistItem[] = [
      checklistItem({ id: 'hp1', description: 'Subgrade hold point', pointType: 'hold_point' }),
      checklistItem({ id: 'std', description: 'Standard check', pointType: 'standard' }),
      checklistItem({ id: 'hp2', description: 'Compaction hold point', pointType: 'hold_point' }),
      checklistItem({ id: 'hp3', description: 'Unverified hold point', pointType: 'hold_point' }),
    ];
    const completions: ITPCompletion[] = [
      // verified HP: verifiedAt + verifiedBy win over completed* fallbacks
      completion({
        id: 'cHp1',
        checklistItemId: 'hp1',
        isVerified: true,
        verifiedAt: '2026-01-02T00:00:00.000Z',
        verifiedBy: person('Verifier One', 'v1@example.com'),
        completedAt: '2026-01-01T00:00:00.000Z',
        completedBy: person('Completer One', 'c1@example.com'),
      }),
      // verified standard item — must be excluded (not a hold point)
      completion({ id: 'cStd', checklistItemId: 'std', isVerified: true }),
      // verified HP missing verifiedAt/verifiedBy → falls back to completedAt/completedBy
      completion({
        id: 'cHp2',
        checklistItemId: 'hp2',
        isVerified: true,
        verifiedAt: null,
        verifiedBy: null,
        completedAt: '2026-01-03T00:00:00.000Z',
        completedBy: person('Completer Two', 'c2@example.com'),
      }),
      // hold point with an unverified completion — must be excluded
      completion({ id: 'cHp3', checklistItemId: 'hp3', isVerified: false }),
    ];
    const itpInstance: ITPInstance = {
      id: 'itp-1',
      template: { id: 't-1', name: 'Earthworks ITP', checklistItems },
      completions,
    };

    const report = buildConformanceReportData({
      lot: baseLot,
      project: { name: 'P' },
      itpInstance,
    });

    expect(report.holdPointReleases).toEqual([
      {
        checklistItemDescription: 'Subgrade hold point',
        releasedAt: '2026-01-02T00:00:00.000Z',
        releasedBy: { id: 'u-v1@example.com', fullName: 'Verifier One', email: 'v1@example.com' },
      },
      {
        checklistItemDescription: 'Compaction hold point',
        releasedAt: '2026-01-03T00:00:00.000Z',
        releasedBy: { id: 'u-c2@example.com', fullName: 'Completer Two', email: 'c2@example.com' },
      },
    ]);
  });

  it('falls back to an empty release timestamp when none is present', () => {
    const itpInstance: ITPInstance = {
      id: 'itp-1',
      template: {
        id: 't-1',
        name: 'ITP',
        checklistItems: [
          checklistItem({
            id: 'hp1',
            description: 'HP without timestamps',
            pointType: 'hold_point',
          }),
        ],
      },
      completions: [
        completion({
          id: 'c1',
          checklistItemId: 'hp1',
          isVerified: true,
          verifiedAt: null,
          completedAt: null,
          verifiedBy: null,
          completedBy: null,
        }),
      ],
    };

    const report = buildConformanceReportData({
      lot: baseLot,
      project: { name: 'P' },
      itpInstance,
    });

    expect(report.holdPointReleases).toEqual([
      { checklistItemDescription: 'HP without timestamps', releasedAt: '', releasedBy: null },
    ]);
  });

  it('passes test results and NCRs through unchanged and maps the itp block', () => {
    const testResults = [
      { id: 'tr-1' },
      { id: 'tr-2' },
    ] as unknown as ConformanceReportData['testResults'];
    const ncrs = [{ id: 'ncr-1' }] as unknown as ConformanceReportData['ncrs'];
    const checklistItems: ITPChecklistItem[] = [checklistItem({ id: 'i1' })];
    const completions: ITPCompletion[] = [completion({ id: 'c1', checklistItemId: 'i1' })];
    const itpInstance: ITPInstance = {
      id: 'itp-1',
      template: { id: 't-1', name: 'Pavement ITP', checklistItems },
      completions,
    };

    const report = buildConformanceReportData({
      lot: baseLot,
      project: { name: 'P' },
      itpInstance,
      testResults,
      ncrs,
    });

    expect(report.testResults).toBe(testResults);
    expect(report.ncrs).toBe(ncrs);
    expect(report.itp).toEqual({
      templateName: 'Pavement ITP',
      checklistItems,
      completions,
    });
  });

  it('handles the null itp instance and missing arrays exactly like the inline code', () => {
    const report = buildConformanceReportData({
      lot: baseLot,
      project: { name: 'P' },
      itpInstance: null,
    });

    expect(report.itp).toBeNull();
    expect(report.photoCount).toBe(0);
    expect(report.holdPointReleases).toEqual([]);
    expect(report.testResults).toEqual([]);
    expect(report.ncrs).toEqual([]);
  });

  it('substitutes "Unknown Template" when the template name is blank', () => {
    const itpInstance: ITPInstance = {
      id: 'itp-1',
      template: { id: 't-1', name: '', checklistItems: [] },
      completions: [],
    };

    const report = buildConformanceReportData({
      lot: baseLot,
      project: { name: 'P' },
      itpInstance,
    });

    expect(report.itp?.templateName).toBe('Unknown Template');
  });
});
