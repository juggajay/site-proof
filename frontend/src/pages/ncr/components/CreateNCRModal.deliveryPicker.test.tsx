/**
 * C5.4a — the optional "Linked Delivery" picker on the NCR create form.
 *
 * The picker is the only place a delivery can be attached to an NCR (there is
 * no delivery register page), so what matters is that the chosen id reaches the
 * create payload and that an absent choice sends nothing at all.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateNCRModal } from './CreateNCRModal';

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock('@/lib/auth', () => ({ getAuthToken: () => 'test-token' }));

vi.mock('../hooks/useResponsiblePartyOptions', () => ({
  useResponsiblePartyOptions: () => ({
    users: [],
    subcontractors: [],
    subcontractorsUnavailable: false,
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

const DELIVERIES = [
  {
    id: 'delivery-1',
    description: '32 MPa concrete',
    supplier: 'Boral',
    docketNumber: 'DK-1180',
    diary: { id: 'diary-1', date: '2026-08-11T00:00:00.000Z' },
  },
  {
    id: 'delivery-2',
    description: 'Class 2 base',
    supplier: null,
    docketNumber: null,
    diary: { id: 'diary-2', date: '2026-08-12T00:00:00.000Z' },
  },
];

function renderModal(onSubmit = vi.fn()) {
  render(
    <CreateNCRModal
      isOpen
      onClose={vi.fn()}
      onSubmit={onSubmit}
      loading={false}
      projectId="proj-1"
    />,
  );
  return onSubmit;
}

async function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Description/i), {
    target: { value: 'Delivered concrete did not match the approved mix' },
  });
  fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'materials' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchMock.mockImplementation((path: string) => {
    if (path.includes('/deliveries')) {
      return Promise.resolve({ deliveries: DELIVERIES });
    }
    return Promise.resolve({ lots: [] });
  });
});

describe('CreateNCRModal — linked delivery picker', () => {
  it("lists the project's deliveries by supplier, material, docket and date", async () => {
    renderModal();

    const picker = await screen.findByLabelText(/Linked Delivery/i);
    expect(picker).toBeInTheDocument();

    expect(
      screen.getByRole('option', { name: 'Boral — 32 MPa concrete · docket DK-1180 · 11/08/2026' }),
    ).toBeInTheDocument();
    // A delivery with no supplier and no docket still reads.
    expect(screen.getByRole('option', { name: 'Class 2 base · 12/08/2026' })).toBeInTheDocument();
  });

  it('sends the chosen delivery id in the create payload', async () => {
    const onSubmit = renderModal();

    const picker = await screen.findByLabelText(/Linked Delivery/i);
    fireEvent.change(picker, { target: { value: 'delivery-1' } });
    await fillRequiredFields();
    fireEvent.submit(document.getElementById('create-ncr-form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ linkedDeliveryId: 'delivery-1' });
  });

  it('sends no delivery when none is chosen', async () => {
    const onSubmit = renderModal();

    await screen.findByLabelText(/Linked Delivery/i);
    await fillRequiredFields();
    fireEvent.submit(document.getElementById('create-ncr-form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].linkedDeliveryId).toBeUndefined();
  });

  it('hides the picker entirely when the project has no deliveries', async () => {
    apiFetchMock.mockImplementation((path: string) =>
      Promise.resolve(path.includes('/deliveries') ? { deliveries: [] } : { lots: [] }),
    );
    renderModal();

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(screen.queryByLabelText(/Linked Delivery/i)).not.toBeInTheDocument();
  });
});
