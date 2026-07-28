import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateTestModal } from './CreateTestModal';
import type { Lot } from '../types';

// ── C3 Phase B2: the pick map is React.lazy'd (Leaflet stays out of this bundle).
// Stub it with a button that reports a pick, so the capture contract is testable
// without a real map. ──
vi.mock('./SamplePointPicker', () => ({
  default: ({ onPick, lotId }: { onPick: (lat: number, lng: number) => void; lotId?: string }) => (
    <button
      type="button"
      data-testid="fake-pick"
      data-lot-id={lotId ?? ''}
      onClick={() => onPick(-33.5, 151.5)}
    >
      pick
    </button>
  ),
}));

// ── Mock BottomSheet so the module graph is light (desktop path renders Modal) ──
vi.mock('@/components/foreman/sheets/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

// ── Desktop by default so ResponsiveSheet renders the Modal ──
const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: useIsMobileMock };
});

// ── Control the lot ITP items hook ──
const useLotItpTestItemsMock = vi.hoisted(() =>
  vi.fn(() => ({
    items: [] as { id: string; description: string; testType: string | null }[],
    isLoading: false,
  })),
);
vi.mock('../hooks/useLotItpTestItems', () => ({
  useLotItpTestItems: useLotItpTestItemsMock,
}));

const LOTS: Lot[] = [{ id: 'lot-1', lotNumber: 'L-001' }];
const TODAY = new Date().toISOString().slice(0, 10);

// ── Real `useGeoLocation` against a fake device, so the `immediate: false` guard
// [C3R-B4] is under test rather than mocked away. ──
type GeoSuccess = (position: {
  coords: { latitude: number; longitude: number; accuracy: number };
}) => void;
const getCurrentPosition = vi.fn((_success: GeoSuccess) => {});

/** Deliver a fix to the pending getCurrentPosition call. */
async function deliverFix(latitude: number, longitude: number, accuracy: number) {
  const success = getCurrentPosition.mock.calls.at(-1)![0];
  await act(async () => {
    success({ coords: { latitude, longitude, accuracy } });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useIsMobileMock.mockReturnValue(false);
  useLotItpTestItemsMock.mockReturnValue({ items: [], isLoading: false });
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
});

function renderModal(props: Partial<React.ComponentProps<typeof CreateTestModal>> = {}) {
  const onSuccess = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <CreateTestModal
      isOpen
      onClose={onClose}
      onSuccess={onSuccess}
      lots={LOTS}
      projectState="NSW"
      {...props}
    />,
  );
  return { onSuccess, onClose };
}

describe('CreateTestModal — slim create form', () => {
  it('does not render the result-block fields (Result Value / Pass-Fail / Spec Min-Max)', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Result Value/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Pass\/Fail Status/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Pass/Fail Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Spec Min/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Spec Max/i)).not.toBeInTheDocument();
  });

  it('hides lab & sample details behind the accordion until expanded', async () => {
    const user = userEvent.setup();
    renderModal();

    // Trigger is present but details are collapsed initially
    const trigger = screen.getByRole('button', { name: /Add lab & sample details/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByLabelText(/Laboratory Name/i)).not.toBeInTheDocument();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByLabelText(/Laboratory Name/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Lab Report Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Specification Reference/i)).toBeInTheDocument();
  });

  it('defaults Sample Date to today', () => {
    renderModal();
    expect(screen.getByLabelText(/Sample Date/i)).toHaveValue(TODAY);
  });

  it('submits the free-text Test Type for the no-lot case (no itpChecklistItemId)', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal();

    await user.type(screen.getByLabelText(/Test Type/i), 'CBR Laboratory');
    await user.click(screen.getByRole('button', { name: /Create Test Result/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const payload = onSuccess.mock.calls[0][0];
    expect(payload.testType).toBe('CBR Laboratory');
    expect(payload.itpChecklistItemId).toBeUndefined();
  });

  it('shows the satisfiesItem banner and always submits its item id', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal({
      satisfiesItem: { id: 'item-9', description: 'Compaction to 95% DDR' },
      initialValues: { testType: 'Density Ratio' },
    });

    expect(screen.getByText(/This test will satisfy/i)).toHaveTextContent('Compaction to 95% DDR');
    // Free-text Test Type is prefilled from initialValues (picker is hidden)
    expect(screen.getByLabelText(/Test Type/i)).toHaveValue('Density Ratio');

    await user.click(screen.getByRole('button', { name: /Create Test Result/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const payload = onSuccess.mock.calls[0][0];
    expect(payload.testType).toBe('Density Ratio');
    expect(payload.itpChecklistItemId).toBe('item-9');
  });

  it('renders the ITP-item picker when the lot has test-required items and submits the chosen id', async () => {
    const user = userEvent.setup();
    useLotItpTestItemsMock.mockReturnValue({
      items: [{ id: 'chk-1', description: 'Subgrade density', testType: 'Density Ratio' }],
      isLoading: false,
    });
    const { onSuccess } = renderModal();

    // Choose the lot → picker appears (watch('lotId') drives it)
    await user.selectOptions(screen.getByLabelText(/Link to Lot/i), 'lot-1');

    const picker = await screen.findByRole('combobox', { name: 'Test Type' });
    await user.selectOptions(picker, 'chk-1');

    await user.click(screen.getByRole('button', { name: /Create Test Result/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const payload = onSuccess.mock.calls[0][0];
    expect(payload.testType).toBe('Density Ratio');
    expect(payload.itpChecklistItemId).toBe('chk-1');
  });
});

// ── Wave C3 Phase B2 §5.4, AT-97 ──────────────────────────────────────────────
describe('CreateTestModal — sample-point capture (AT-97)', () => {
  const LOCATION_KEYS = [
    'sampleLatitude',
    'sampleLongitude',
    'sampleLocationSource',
    'sampleLocationAccuracyM',
  ] as const;

  async function submit(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/Test Type/i), 'Density Ratio');
    await user.click(screen.getByRole('button', { name: /Create Test Result/i }));
  }

  it('[C3R-B4] opening the form asks for no GPS fix, and Pick on map is the primary control', () => {
    renderModal();
    // `immediate: false`: a create-test form must not prompt for location.
    expect(getCurrentPosition).not.toHaveBeenCalled();

    // Primary/secondary is not cosmetic — the GPS label states its own precondition.
    expect(screen.getByTestId('sample-pick-on-map')).toHaveTextContent('Pick on map');
    expect(screen.getByTestId('sample-use-my-location')).toHaveTextContent(
      "I'm at the sample point now",
    );
    expect(screen.queryByTestId('sample-point-summary')).not.toBeInTheDocument();
  });

  it('[C3S-B1] free text alone captures nothing — no key is derived from "CH 1000+50"', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal();

    await user.type(screen.getByLabelText('Sample Location'), 'CH 1000+50, 2m LHS');
    await submit(user);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const payload = onSuccess.mock.calls[0][0];
    expect(payload.sampleLocation).toBe('CH 1000+50, 2m LHS');
    // This is the guard against a "helpful" chainage parser: a coordinate built on
    // a guess is still a guess, and the free text carries no control line anyway.
    for (const key of LOCATION_KEYS) expect(payload).not.toHaveProperty(key);
  });

  it('refuses a coarse GPS fix WITH ITS NUMBER and writes nothing', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal();

    await user.click(screen.getByTestId('sample-use-my-location'));
    await deliverFix(-33.8688, 151.2093, 85);

    expect(screen.getByTestId('sample-gps-error')).toHaveTextContent(
      'GPS accuracy ±85 m — too coarse for a sample point. Pick on map instead.',
    );
    expect(screen.queryByTestId('sample-point-summary')).not.toBeInTheDocument();

    await submit(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    for (const key of LOCATION_KEYS) {
      expect(onSuccess.mock.calls[0][0]).not.toHaveProperty(key);
    }
  });

  it('persists a good GPS fix with its accuracy, then clears all four together', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal();

    await user.click(screen.getByTestId('sample-use-my-location'));
    await deliverFix(-33.8688, 151.2093, 6.2);

    expect(screen.getByTestId('sample-point-summary')).toHaveTextContent('-33.868800, 151.209300');
    expect(screen.getByTestId('sample-point-summary')).toHaveTextContent('GPS ±6 m');

    await submit(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onSuccess.mock.calls[0][0]).toMatchObject({
      sampleLatitude: -33.8688,
      sampleLongitude: 151.2093,
      sampleLocationSource: 'gps',
      sampleLocationAccuracyM: 6.2,
    });
  });

  it('Clear removes all four keys at once (the pair constraints require it)', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal();

    await user.click(screen.getByTestId('sample-use-my-location'));
    await deliverFix(-33.8688, 151.2093, 4);
    await user.click(screen.getByTestId('sample-point-clear'));

    expect(screen.queryByTestId('sample-point-summary')).not.toBeInTheDocument();
    await submit(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    for (const key of LOCATION_KEYS) {
      expect(onSuccess.mock.calls[0][0]).not.toHaveProperty(key);
    }
  });

  it('a map pick persists source=map_pick with NULL accuracy, and passes the lot for orientation', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal();

    await user.selectOptions(screen.getByLabelText(/Link to Lot/i), 'lot-1');
    await user.click(screen.getByTestId('sample-pick-on-map'));

    // The picker is lazy — it resolves after the click.
    const pick = await screen.findByTestId('fake-pick');
    expect(pick).toHaveAttribute('data-lot-id', 'lot-1');
    await user.click(pick);

    expect(screen.getByTestId('sample-point-summary')).toHaveTextContent('Picked on map');

    await submit(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onSuccess.mock.calls[0][0]).toMatchObject({
      sampleLatitude: -33.5,
      sampleLongitude: 151.5,
      sampleLocationSource: 'map_pick',
      // A tap has no accuracy radius. NULL is the fact, not a missing value.
      sampleLocationAccuracyM: null,
    });
  });
});
