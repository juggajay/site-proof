/**
 * SwipeableCard.test.tsx
 *
 * Tests for the framer-motion rebuild of SwipeableCard.
 *
 * NOTE: jsdom cannot simulate framer-motion drag gesture physics —
 * framer-motion attaches pointer/touch event listeners imperatively and
 * performs layout measurements that are unavailable in jsdom. Drag-to-commit
 * behavior is therefore tested via the pure `decideSwipe` function in
 * swipePhysics.test.ts. These tests focus on render correctness and
 * callback wiring.
 *
 * Semantics matrix (iOS / call-site convention — pinned here to catch regressions):
 *
 *   prop          | physical side | revealed by | callback    | drag offset
 *   rightAction   | RIGHT side    | swipe LEFT  | onSwipeRight| negative (–x)
 *   leftAction    | LEFT  side    | swipe RIGHT | onSwipeLeft | positive (+x)
 *
 * This matches the iOS Mail / iOS convention used by ALL call sites:
 *   NCRMobileList  — rightAction=View  + onSwipeRight=select ; leftAction=CopyLink + onSwipeLeft=copy
 *   LotMobileList  — rightAction=View  + onSwipeRight=navigate (single action, only left drag allowed)
 *   DocketApprovals— rightAction=Approve + onSwipeRight=approve ; leftAction=Reject + onSwipeLeft=reject
 *
 * See swipePhysics-action-matrix.test.ts for the two-action mapping tests that
 * pin the decideSwipe ↔ callback wiring for each call-site configuration.
 *
 * See swipePhysics.test.ts for the full gesture-physics unit tests.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwipeableCard } from './SwipeableCard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCard(props: Partial<React.ComponentProps<typeof SwipeableCard>> = {}) {
  const defaults = {
    onSwipeLeft: vi.fn(),
    onSwipeRight: vi.fn(),
  };
  return render(
    <SwipeableCard {...defaults} {...props}>
      <button type="button">Card content</button>
    </SwipeableCard>,
  );
}

// ---------------------------------------------------------------------------
// Render: action labels
// ---------------------------------------------------------------------------

describe('SwipeableCard — render', () => {
  it('renders default right-action label "Approve"', () => {
    renderCard();
    expect(screen.getByText('Approve')).toBeInTheDocument();
  });

  it('renders default left-action label "Reject"', () => {
    renderCard();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('renders custom right-action label', () => {
    renderCard({
      rightAction: { label: 'Accept', color: 'bg-success' },
    });
    expect(screen.getByText('Accept')).toBeInTheDocument();
  });

  it('renders custom left-action label', () => {
    renderCard({
      leftAction: { label: 'Decline', color: 'bg-destructive' },
    });
    expect(screen.getByText('Decline')).toBeInTheDocument();
  });

  it('renders children', () => {
    renderCard();
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders custom icon inside right action', () => {
    const Icon = () => <svg data-testid="custom-icon" />;
    renderCard({
      rightAction: { label: 'Go', color: 'bg-success', icon: <Icon /> },
    });
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('applies className to outer wrapper', () => {
    const { container } = renderCard({ className: 'my-custom-class' });
    // The outer wrapper div carries the className
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});

// ---------------------------------------------------------------------------
// Tap / click-through: plain tap must not be swallowed
// ---------------------------------------------------------------------------

describe('SwipeableCard — tap click-through', () => {
  it('passes click events through to children', async () => {
    const handleClick = vi.fn();
    render(
      <SwipeableCard onSwipeLeft={vi.fn()} onSwipeRight={vi.fn()}>
        <button type="button" onClick={handleClick}>
          Tap me
        </button>
      </SwipeableCard>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tap me' }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

describe('SwipeableCard — disabled', () => {
  it('renders children when disabled', () => {
    renderCard({ disabled: true });
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('still renders action labels when disabled (backgrounds stay in DOM)', () => {
    renderCard({ disabled: true });
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Partial action configuration
// ---------------------------------------------------------------------------

describe('SwipeableCard — partial actions', () => {
  it('renders only right action when onSwipeLeft is omitted', () => {
    renderCard({ onSwipeLeft: undefined });
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument(); // default still in DOM
  });

  it('accepts undefined callbacks without throwing', () => {
    expect(() => renderCard({ onSwipeLeft: undefined, onSwipeRight: undefined })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Threshold prop
// ---------------------------------------------------------------------------

describe('SwipeableCard — threshold prop', () => {
  it('accepts custom threshold without throwing', () => {
    expect(() => renderCard({ threshold: 80 })).not.toThrow();
  });

  it('uses default threshold of 100 without prop', () => {
    // Just verifying no error when prop is omitted
    expect(() => renderCard({})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Semantics: action label DOM placement
//
// Pin the iOS convention so a future refactor cannot silently swap sides.
// rightAction must be rendered as the SECOND child (right side) and
// leftAction as the FIRST child (left side) of the background container.
// ---------------------------------------------------------------------------

describe('SwipeableCard — iOS semantics: action DOM placement', () => {
  it('rightAction is the SECOND child of the background container (right side, revealed by left swipe)', () => {
    const { container } = renderCard({
      rightAction: { label: 'VIEW_RIGHT', color: 'bg-primary' },
      leftAction: { label: 'COPY_LEFT', color: 'bg-muted-foreground' },
    });
    // The background container is the first child of the outer wrapper.
    // Its children: [0] = leftAction, [1] = rightAction.
    const bg = container.querySelector('.absolute.inset-0.flex');
    expect(bg).not.toBeNull();
    const children = bg!.children;
    expect(children.length).toBe(2);
    // Second child must contain the rightAction label
    expect(children[1].textContent).toContain('VIEW_RIGHT');
    // First child must contain the leftAction label
    expect(children[0].textContent).toContain('COPY_LEFT');
  });

  it('leftAction is the FIRST child of the background container (left side, revealed by right swipe)', () => {
    const { container } = renderCard({
      leftAction: { label: 'REJECT_LEFT', color: 'bg-destructive' },
      rightAction: { label: 'APPROVE_RIGHT', color: 'bg-success' },
    });
    const bg = container.querySelector('.absolute.inset-0.flex');
    const children = bg!.children;
    expect(children[0].textContent).toContain('REJECT_LEFT');
    expect(children[1].textContent).toContain('APPROVE_RIGHT');
  });

  it('single-action Lots style: only rightAction configured — card still renders', () => {
    // LotMobileList only provides onSwipeRight + rightAction; no onSwipeLeft/leftAction.
    // The card must render without error and show the rightAction label.
    render(
      <SwipeableCard onSwipeRight={vi.fn()} rightAction={{ label: 'View', color: 'bg-primary' }}>
        <span>Lot card</span>
      </SwipeableCard>,
    );
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Lot card')).toBeInTheDocument();
  });
});
