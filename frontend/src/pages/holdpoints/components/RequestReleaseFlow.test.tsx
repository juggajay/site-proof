/**
 * RequestReleaseFlow — the one request-release path, shared by the hold point
 * register and the lot ITP checklist row (benchmark T1).
 *
 * The point of these tests is that a request raised from the checklist hits the
 * SAME endpoint with the same body as one raised from the register: the row
 * only ever supplies a lot and a checklist item, which is all the endpoint
 * keys on.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { RequestReleaseFlow } from './RequestReleaseFlow';
import type { HoldPoint, HoldPointDetails } from '../types';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});

// jsdom has no matchMedia; the sheet renders in its desktop form.
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => false };
});

const apiFetchMock = vi.mocked(apiFetch);

const holdPoint: HoldPoint = {
  id: 'virtual-item-1',
  lotId: 'lot-1',
  lotNumber: 'LOT-001',
  itpChecklistItemId: 'item-1',
  description: 'Subgrade proof roll',
  pointType: 'hold_point',
  status: 'pending',
  notificationSentAt: null,
  scheduledDate: null,
  releasedAt: null,
  releasedByName: null,
  releaseNotes: null,
  sequenceNumber: 0,
  isCompleted: false,
  isVerified: false,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const readyDetails: HoldPointDetails = {
  holdPoint,
  prerequisites: [],
  incompletePrerequisites: [],
  canRequestRelease: true,
  defaultRecipients: ['super@example.com'],
};

beforeEach(() => {
  apiFetchMock.mockReset();
});

/**
 * The date input is `min`-bound to today, so a literal date would silently
 * start failing validation the day it went past (see tasks/lessons.md).
 */
function futureDateInputValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

async function fillAndSubmit() {
  await screen.findByText(/All prerequisites completed/i);
  await userEvent.type(screen.getByLabelText(/Scheduled Date/i), futureDateInputValue());
  await userEvent.type(screen.getByLabelText(/Scheduled Time/i), '09:30');
  await userEvent.click(screen.getByRole('button', { name: /^request release$/i }));
}

describe('RequestReleaseFlow', () => {
  it('loads the prerequisites for the lot + checklist item it was handed', async () => {
    apiFetchMock.mockResolvedValue(readyDetails as never);

    render(<RequestReleaseFlow holdPoint={holdPoint} onClose={vi.fn()} onRequested={vi.fn()} />);

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/holdpoints/lot/lot-1/item/item-1'),
    );
    expect(await screen.findByText(/All prerequisites completed/i)).toBeInTheDocument();
  });

  it('posts the request to the register endpoint and closes on success', async () => {
    apiFetchMock.mockImplementation((path: string) =>
      path.startsWith('/api/holdpoints/lot/')
        ? (Promise.resolve(readyDetails) as never)
        : (Promise.resolve({}) as never),
    );
    const onClose = vi.fn();
    const onRequested = vi.fn();

    render(
      <RequestReleaseFlow holdPoint={holdPoint} onClose={onClose} onRequested={onRequested} />,
    );

    await fillAndSubmit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const requestCall = apiFetchMock.mock.calls.find(
      ([path]) => path === '/api/holdpoints/request-release',
    );
    expect(requestCall).toBeDefined();
    expect(JSON.parse((requestCall![1] as RequestInit).body as string)).toMatchObject({
      lotId: 'lot-1',
      itpChecklistItemId: 'item-1',
      evidenceDocumentIds: [],
      noticePeriodOverride: false,
    });
    // The caller refreshes its own caches before the sheet disappears.
    expect(onRequested).toHaveBeenCalled();
  });

  it('maps the required refusal response to responseToPriorRejection', async () => {
    const refusedHoldPoint: HoldPoint = {
      ...holdPoint,
      id: 'hp-refused',
      latestRound: {
        outcome: 'rejected',
        decidedAt: '2026-08-02T00:00:00.000Z',
        decisionReason: 'Proof roll failed.',
        ncrId: 'ncr-42',
        ncrNumber: 'NCR-0042',
        ncrStatus: 'closed',
        openConditionCount: 0,
      },
    };
    apiFetchMock.mockImplementation((path: string) =>
      path.startsWith('/api/holdpoints/lot/')
        ? (Promise.resolve({ ...readyDetails, holdPoint: refusedHoldPoint }) as never)
        : (Promise.resolve({}) as never),
    );

    render(
      <RequestReleaseFlow holdPoint={refusedHoldPoint} onClose={vi.fn()} onRequested={vi.fn()} />,
    );

    await screen.findByText(/All prerequisites completed/i);
    await userEvent.type(screen.getByLabelText(/Scheduled Date/i), futureDateInputValue());
    await userEvent.type(screen.getByLabelText(/Scheduled Time/i), '09:30');
    await userEvent.type(
      screen.getByLabelText(/Response to the refusal/),
      'The failed section was excavated and recompacted.',
    );
    await userEvent.click(screen.getByRole('button', { name: /^re-request release$/i }));

    const requestCall = apiFetchMock.mock.calls.find(
      ([path]) => path === '/api/holdpoints/request-release',
    );
    expect(JSON.parse((requestCall![1] as RequestInit).body as string)).toMatchObject({
      responseToPriorRejection: 'The failed section was excavated and recompacted.',
    });
  });

  it('surfaces the missing prerequisites the API names, without closing', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith('/api/holdpoints/lot/')) return Promise.resolve(readyDetails) as never;
      return Promise.reject(
        Object.assign(new Error('Complete the preceding items first'), {
          body: JSON.stringify({
            error: {
              message: 'Complete the preceding items first',
              details: {
                incompleteItems: [
                  { id: 'item-0', description: 'Trim to level', sequenceNumber: 1 },
                ],
              },
            },
          }),
        }),
      ) as never;
    });
    const onClose = vi.fn();

    render(<RequestReleaseFlow holdPoint={holdPoint} onClose={onClose} onRequested={vi.fn()} />);

    await fillAndSubmit();

    expect(await screen.findByText(/Complete the preceding items first/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports a details lookup that fails rather than showing an empty form', async () => {
    apiFetchMock.mockRejectedValue(new Error('boom') as never);

    render(<RequestReleaseFlow holdPoint={holdPoint} onClose={vi.fn()} onRequested={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/boom/);
  });
});
