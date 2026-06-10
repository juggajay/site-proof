/**
 * Component tests for the rebuilt BottomSheet (PR-D mobile overhaul).
 *
 * These tests cover the observable contract that call-sites depend on:
 *   • renders when open / hides when closed
 *   • X button closes
 *   • backdrop click closes
 *   • Escape key closes
 *   • children render inside the sheet
 *   • grab handle is present with correct test-id
 *   • role="dialog" aria-modal is present when open
 *   • draft-restore hint rendering (children can include the hint)
 *
 * jsdom drag simulation is NOT required per spec — drag-dismiss is covered
 * by the pure-physics unit tests in sheetPhysics.test.ts.
 *
 * framer-motion AnimatePresence works in jsdom because the library falls back
 * to an instant transition when ResizeObserver / layout APIs are unavailable.
 * We only need to ensure the `isOpen` prop correctly drives mount/unmount.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

function renderSheet({
  isOpen = true,
  title = 'Test Sheet',
  onClose = vi.fn(),
  children = <p>sheet body</p>,
}: {
  isOpen?: boolean;
  title?: string;
  onClose?: () => void;
  children?: React.ReactNode;
} = {}) {
  return render(
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      {children}
    </BottomSheet>,
  );
}

describe('BottomSheet', () => {
  // ── Open / closed state ────────────────────────────────────────────────────
  it('renders the title and children when open', () => {
    renderSheet({ isOpen: true, title: 'Add Activity' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Activity')).toBeInTheDocument();
    expect(screen.getByText('sheet body')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderSheet({ isOpen: false, title: 'Add Activity' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Activity')).not.toBeInTheDocument();
  });

  // ── Close affordances ──────────────────────────────────────────────────────
  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    // The backdrop is the dialog element itself (role="dialog") — clicking it
    // (not a child) fires the onClick handler.
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when Escape is pressed while closed', () => {
    const onClose = vi.fn();
    renderSheet({ isOpen: false, onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Children ───────────────────────────────────────────────────────────────
  it('renders arbitrary children inside the sheet', () => {
    renderSheet({
      children: (
        <div>
          <button>Save</button>
          <p>Some content</p>
        </div>
      ),
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByText('Some content')).toBeInTheDocument();
  });

  it('renders the draft-restore hint when passed as children', () => {
    renderSheet({
      children: <p>Draft restored — tap to discard</p>,
    });
    expect(screen.getByText('Draft restored — tap to discard')).toBeInTheDocument();
  });

  // ── Grab handle ────────────────────────────────────────────────────────────
  it('renders the drag handle with the correct test-id', () => {
    renderSheet();
    expect(screen.getByTestId('sheet-drag-handle')).toBeInTheDocument();
  });

  // ── Accessibility ──────────────────────────────────────────────────────────
  it('has role="dialog" and aria-modal when open', () => {
    renderSheet({ isOpen: true, title: 'My Sheet' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'My Sheet');
  });

  // ── Content does not bubble to backdrop ────────────────────────────────────
  it('does NOT call onClose when clicking inside the sheet content', () => {
    const onClose = vi.fn();
    renderSheet({ onClose, children: <button>Inner button</button> });
    fireEvent.click(screen.getByRole('button', { name: 'Inner button' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
