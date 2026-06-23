import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

import { DiarySubmitSection } from './DiarySubmitSection';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import type { DailyDiary } from '../types';

const apiFetchMock = vi.mocked(apiFetch);
const toastMock = vi.mocked(toast);

const draftDiary = {
  id: 'd1',
  status: 'draft',
  personnel: [],
  plant: [],
  activities: [],
  delays: [],
  weatherConditions: null,
  generalNotes: null,
} as unknown as DailyDiary;

function warn422(warnings: string[]): ApiError {
  return new ApiError(
    422,
    JSON.stringify({ error: { details: { requiresAcknowledgement: true, warnings } } }),
  );
}

function renderSection(overrides: Record<string, unknown> = {}) {
  const props = {
    diary: draftDiary,
    projectId: 'p1',
    addendums: [],
    saving: false,
    setSaving: vi.fn(),
    onDiaryUpdate: vi.fn(),
    onRefreshDiaries: vi.fn(),
    onAddendumsChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<DiarySubmitSection {...props} />) };
}

beforeEach(() => {
  apiFetchMock.mockReset();
  toastMock.mockReset();
});

describe('DiarySubmitSection server-422 warning gate (M30)', () => {
  it('submits without acknowledgement first, surfaces the server warnings, then acknowledges on the second confirm', async () => {
    const submitBodies: unknown[] = [];
    apiFetchMock.mockImplementation(((path: string, opts?: { body?: string }) => {
      if (String(path).includes('/submit')) {
        submitBodies.push(opts?.body ? JSON.parse(opts.body) : undefined);
        if (submitBodies.length === 1) {
          return Promise.reject(warn422(['No personnel recorded']));
        }
        return Promise.resolve({ diary: { ...draftDiary, status: 'submitted' } });
      }
      return Promise.resolve({});
    }) as unknown as typeof apiFetch);

    const onDiaryUpdate = vi.fn();
    renderSection({ onDiaryUpdate });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Diary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Submit' }));

    // The server's warning is shown in the still-open confirm modal.
    await screen.findByText('No personnel recorded');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Submit' }));
    await waitFor(() => expect(onDiaryUpdate).toHaveBeenCalled());

    // First attempt carries NO acknowledgement (drives the server gate); the
    // second, post-warning attempt acknowledges.
    expect(submitBodies[0]).toBeUndefined();
    expect(submitBodies[1]).toEqual({ acknowledgeWarnings: true });
  });

  it('submits in a single confirm when the server raises no warnings', async () => {
    const submitBodies: unknown[] = [];
    apiFetchMock.mockImplementation(((path: string, opts?: { body?: string }) => {
      if (String(path).includes('/submit')) {
        submitBodies.push(opts?.body ? JSON.parse(opts.body) : undefined);
        return Promise.resolve({ diary: { ...draftDiary, status: 'submitted' } });
      }
      return Promise.resolve({});
    }) as unknown as typeof apiFetch);

    const onDiaryUpdate = vi.fn();
    renderSection({ onDiaryUpdate });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Diary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Submit' }));

    await waitFor(() => expect(onDiaryUpdate).toHaveBeenCalled());
    expect(submitBodies).toEqual([undefined]);
  });
});
