// SwipeableCard - framer-motion rebuild with velocity-aware gesture physics
import { type ReactNode, useRef } from 'react';
import {
  motion,
  MotionConfig,
  useMotionValue,
  useTransform,
  useReducedMotion,
  animate,
  type PanInfo,
} from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { decideSwipe } from './swipePhysics';

// ---------------------------------------------------------------------------
// Public API (unchanged from raw-touch implementation)
// ---------------------------------------------------------------------------

interface SwipeableCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: {
    label: string;
    color: string;
    icon?: ReactNode;
  };
  rightAction?: {
    label: string;
    color: string;
    icon?: ReactNode;
  };
  /** Drag distance (px) at which a slow drag commits. Default 100. */
  threshold?: number;
  className?: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max distance the card reveals the action background before resistance. */
const MAX_REVEAL = 150;

/** Spring config for settle/spring-back animations. */
const SETTLE_SPRING = { type: 'spring', stiffness: 400, damping: 40 } as const;

/**
 * Snap-duration used when prefers-reduced-motion is set.
 * Zero feels too jarring; 80 ms is imperceptible but not instant-cut.
 */
const REDUCED_MOTION_DURATION = 0.08;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction = {
    label: 'Reject',
    color: 'bg-destructive text-destructive-foreground',
    icon: <X className="h-6 w-6" />,
  },
  rightAction = {
    label: 'Approve',
    color: 'bg-success text-success-foreground',
    icon: <Check className="h-6 w-6" />,
  },
  threshold = 100,
  className,
  disabled = false,
}: SwipeableCardProps) {
  const { trigger } = useHaptics();
  const prefersReducedMotion = useReducedMotion();

  // Track whether a drag actually moved to distinguish from a tap.
  const didDragRef = useRef(false);

  // framer-motion x motion value drives the card position.
  const x = useMotionValue(0);

  // ---------------------------------------------------------------------------
  // Derived motion values for background reveal
  // ---------------------------------------------------------------------------

  // Right action (swiping right → positive x): full opacity at threshold
  const rightOpacity = useTransform(x, [0, threshold], [0, 1]);
  const rightScale = useTransform(x, [0, threshold], [0.85, 1]);

  // Left action (swiping left → negative x): full opacity at -threshold
  const leftOpacity = useTransform(x, [-threshold, 0], [1, 0]);
  const leftScale = useTransform(x, [-threshold, 0], [1, 0.85]);

  // ---------------------------------------------------------------------------
  // Spring helper — respects reduced-motion preference
  // ---------------------------------------------------------------------------

  function springTo(target: number, releaseVelocity = 0) {
    if (prefersReducedMotion) {
      void animate(x, target, { duration: REDUCED_MOTION_DURATION });
    } else {
      void animate(x, target, {
        ...SETTLE_SPRING,
        velocity: releaseVelocity,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Drag constraints — only allow drag toward configured actions
  // ---------------------------------------------------------------------------

  const dragConstraints = {
    left: onSwipeLeft ? -MAX_REVEAL : 0,
    right: onSwipeRight ? MAX_REVEAL : 0,
  };

  // ---------------------------------------------------------------------------
  // onDragStart — mark that a drag has begun so we don't swallow taps
  // ---------------------------------------------------------------------------

  function handleDragStart() {
    didDragRef.current = false;
  }

  // ---------------------------------------------------------------------------
  // onDrag — update the didDrag flag on any meaningful movement
  // ---------------------------------------------------------------------------

  function handleDrag(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (Math.abs(info.offset.x) > 4) {
      didDragRef.current = true;
    }

    // Haptic when crossing threshold (like original behaviour)
    const current = x.get();
    if (current > threshold || current < -threshold) {
      // Haptic on every threshold-cross frame is too noisy; the onDragEnd
      // commit haptic is authoritative — this is intentionally removed from
      // the live-drag path in the framer rebuild.
    }
  }

  // ---------------------------------------------------------------------------
  // onDragEnd — physics decision → commit or spring back
  // ---------------------------------------------------------------------------

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (disabled) {
      springTo(0, info.velocity.x);
      return;
    }

    const decision = decideSwipe({
      offsetX: info.offset.x,
      velocityX: info.velocity.x,
      distanceThreshold: threshold,
      leftActionConfigured: !!onSwipeLeft,
      rightActionConfigured: !!onSwipeRight,
    });

    if (decision === 'right' && onSwipeRight) {
      trigger('light');
      // Brief over-commit then spring back
      void animate(x, MAX_REVEAL, {
        duration: prefersReducedMotion ? REDUCED_MOTION_DURATION : 0.12,
      }).then(() => {
        onSwipeRight();
        springTo(0);
      });
    } else if (decision === 'left' && onSwipeLeft) {
      trigger('light');
      void animate(x, -MAX_REVEAL, {
        duration: prefersReducedMotion ? REDUCED_MOTION_DURATION : 0.12,
      }).then(() => {
        onSwipeLeft();
        springTo(0);
      });
    } else {
      // No action — spring back seeded with release velocity
      springTo(0, info.velocity.x);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn('relative overflow-hidden rounded-lg', className)}>
        {/* Background action layers — positioned absolutely behind the card */}
        <div className="absolute inset-0 flex">
          {/* Right action (approve) — revealed on positive-x drag */}
          <motion.div
            className={cn(
              'flex flex-1 items-center justify-start px-6 text-primary-foreground',
              rightAction.color,
            )}
            style={{ opacity: rightOpacity, scale: rightScale }}
          >
            <div className="flex flex-col items-center">
              {rightAction.icon}
              <span className="mt-1 text-xs font-medium">{rightAction.label}</span>
            </div>
          </motion.div>

          {/* Left action (reject) — revealed on negative-x drag */}
          <motion.div
            className={cn(
              'flex flex-1 items-center justify-end px-6 text-primary-foreground',
              leftAction.color,
            )}
            style={{ opacity: leftOpacity, scale: leftScale }}
          >
            <div className="flex flex-col items-center">
              {leftAction.icon}
              <span className="mt-1 text-xs font-medium">{leftAction.label}</span>
            </div>
          </motion.div>
        </div>

        {/* Draggable card surface */}
        <motion.div
          className="relative bg-card"
          drag={disabled ? false : 'x'}
          dragDirectionLock
          dragMomentum={false}
          dragElastic={0.15}
          dragConstraints={dragConstraints}
          style={{
            x,
            // Mandatory: lets vertical list scrolling pass through unobstructed.
            touchAction: 'pan-y',
          }}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
        >
          {children}
        </motion.div>
      </div>
    </MotionConfig>
  );
}
