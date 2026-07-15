import { render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateMatchResult } from '@/lib/itpTemplateMatch';

const useTemplateMatch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/itpTemplateMatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/itpTemplateMatch')>();
  return { ...actual, useTemplateMatch };
});

import { BulkActivityRows, type ItpTemplateOption } from './BulkActivityRows';

const TEMPLATES: ItpTemplateOption[] = [
  { id: 'exact', name: 'Culvert ITP', activityType: 'culverts' },
  { id: 'other', name: 'Earthworks ITP', activityType: 'earthworks_general' },
];

function matchResult(over: Partial<TemplateMatchResult>): TemplateMatchResult {
  return { tier: 'C', suggestedTemplateId: null, candidates: [], ...over };
}

function renderRows(onChange = vi.fn()) {
  render(
    <BulkActivityRows
      projectId="proj-1"
      activities={[{ activityType: 'culverts', itpTemplateId: '' }]}
      onChange={onChange}
      itpTemplates={TEMPLATES}
      intervalCount={2}
    />,
  );
  return onChange;
}

describe('BulkActivityRows suggested-first picker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Tier A: renders a Suggested group and prefills the row template', async () => {
    useTemplateMatch.mockReturnValue({
      data: matchResult({
        tier: 'A',
        suggestedTemplateId: 'exact',
        candidates: [
          {
            id: 'exact',
            name: 'Culvert ITP',
            scope: 'global',
            stateSpec: null,
            matchKind: 'exact',
            checklistItemCount: 3,
            holdPointCount: 1,
          },
        ],
      }),
    });
    const onChange = renderRows();

    const select = screen.getByLabelText('ITP Template') as HTMLSelectElement;
    expect(within(select).getByRole('group', { name: 'Suggested' })).toBeInTheDocument();

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([{ activityType: 'culverts', itpTemplateId: 'exact' }]),
    );
  });

  it('Tier C: no Suggested group, full list shown, no prefill', () => {
    useTemplateMatch.mockReturnValue({ data: matchResult({ tier: 'C' }) });
    const onChange = renderRows();

    const select = screen.getByLabelText('ITP Template') as HTMLSelectElement;
    expect(within(select).queryByRole('group', { name: 'Suggested' })).not.toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /Culvert ITP/ })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
