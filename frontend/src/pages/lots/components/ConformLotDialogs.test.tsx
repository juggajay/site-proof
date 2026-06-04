import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConformLotDialogs } from './ConformLotDialogs';

afterEach(() => {
  cleanup();
});

// Characterization for the force-conform reason requirement (PR #205 behavior):
// the destructive Force Conform action must stay disabled until the user has
// written a reason of at least 5 non-whitespace characters, and the plain
// Conform dialog must keep needing no reason. These tests pin the dialog layer;
// the page layer's matching guard in handleConformLot is pinned by a source
// guard in e2e/productionReadiness.spec.ts.
function renderDialogs(overrides: Partial<Parameters<typeof ConformLotDialogs>[0]> = {}) {
  const props = {
    lotNumber: 'L-001',
    showConformConfirm: false,
    onConformCancel: vi.fn(),
    onConformConfirm: vi.fn(),
    showForceConformConfirm: true,
    forceConformReason: '',
    onForceConformReasonChange: vi.fn(),
    onForceConformCancel: vi.fn(),
    onForceConformConfirm: vi.fn(),
    isConforming: false,
    ...overrides,
  };
  render(<ConformLotDialogs {...props} />);
  return props;
}

describe('ConformLotDialogs force-conform reason requirement', () => {
  it('disables Force Conform while the reason is empty', () => {
    const props = renderDialogs({ forceConformReason: '' });

    const confirm = screen.getByRole('button', { name: 'Force Conform Lot' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(props.onForceConformConfirm).not.toHaveBeenCalled();
  });

  it('ignores whitespace padding when measuring the reason length', () => {
    // 4 non-whitespace characters padded with spaces still fails the >= 5 rule.
    renderDialogs({ forceConformReason: '  serc   ' });

    expect(screen.getByRole('button', { name: 'Force Conform Lot' })).toBeDisabled();
  });

  it('enables Force Conform once the trimmed reason reaches 5 characters', () => {
    const props = renderDialogs({
      forceConformReason: ' QA manager reviewed field evidence and approved. ',
    });

    const confirm = screen.getByRole('button', { name: 'Force Conform Lot' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(props.onForceConformConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps Force Conform disabled while a conform request is in flight', () => {
    renderDialogs({
      forceConformReason: 'QA manager reviewed field evidence and approved.',
      isConforming: true,
    });

    expect(screen.getByRole('button', { name: 'Force Conform Lot' })).toBeDisabled();
  });

  it('forwards reason typing to the page-owned state', () => {
    const props = renderDialogs();

    fireEvent.change(screen.getByLabelText('Reason for force conforming'), {
      target: { value: 'because QA approved the exception' },
    });
    expect(props.onForceConformReasonChange).toHaveBeenCalledWith(
      'because QA approved the exception',
    );
  });

  it('keeps the plain Conform dialog reason-free', () => {
    const props = renderDialogs({ showConformConfirm: true, showForceConformConfirm: false });

    const confirm = screen.getByRole('button', { name: 'Conform Lot' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(props.onConformConfirm).toHaveBeenCalledTimes(1);
  });
});
