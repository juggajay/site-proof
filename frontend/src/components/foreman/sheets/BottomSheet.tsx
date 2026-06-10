/**
 * BottomSheet — framer-motion rebuild (PR-D mobile overhaul)
 *
 * Implements the §2 parameter table from docs/research/12-mobile-overhaul-playbook-2026-06.md:
 *   • drag="y" with dragConstraints top=0 (no upward drag past resting position)
 *   • dragElastic top=0.15, bottom=0.6
 *   • dragMomentum=false — we drive the settle spring ourselves
 *   • Grab handle: ~36×4 px pill inside ≥48 px touch area, touch-action:none
 *   • Scroll-vs-drag arbitration (vaul's shouldDrag):
 *       – sheet takes over only when inner scroller is at scrollTop===0
 *         AND at least 100 ms have passed since the scroller last reached top
 *         (100 ms lockout stops scroll momentum from flinging the sheet closed)
 *       – handle/header always triggers drag regardless of scroll position
 *   • onDragEnd: decideSheetClose → spring { stiffness:300, damping:30, velocity }
 *   • Backdrop: opacity tied to drag progress via useTransform (not a separate anim)
 *   • dvh height with vh fallback; AnimatePresence for mount/unmount
 *   • Escape key and backdrop-tap close (preserved from original)
 *   • Sticky header + X button (preserved — drag is NEVER the only exit)
 *   • prefers-reduced-motion respected via useReducedMotion
 *   • role="dialog" aria-modal
 */

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  useDragControls,
  useReducedMotion,
} from 'framer-motion';
import { decideSheetClose } from './sheetPhysics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Spring constants shared between enter/exit and settle-after-drag. */
const SHEET_SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const dragControls = useDragControls();
  const prefersReduced = useReducedMotion();

  /** Tracks the current Y drag offset of the sheet panel (px, positive = down). */
  const y = useMotionValue(0);

  /** Panel ref — used to measure sheet height at drag-end time. */
  const panelRef = useRef<HTMLDivElement>(null);

  /** Scroll container ref — used for shouldDrag arbitration. */
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Timestamp of the last moment the inner scroller reached scrollTop===0.
   * Initialised so the first drag on a freshly-opened sheet is immediately eligible
   * (200 ms in the past → already past the 100 ms lockout).
   */
  const scrollReachedTopAtRef = useRef<number>(Date.now() - 200);

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Reset scroll-top timestamp whenever the sheet opens so a freshly-mounted
  // scroller (always at scrollTop 0) is immediately drag-eligible.
  useEffect(() => {
    if (isOpen) {
      scrollReachedTopAtRef.current = Date.now() - 200;
    }
  }, [isOpen]);

  // ── Track when the scroller reaches the top (for 100 ms lockout) ─────────
  const handleScrollerScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop === 0) {
      scrollReachedTopAtRef.current = Date.now();
    }
  }, []);

  // ── shouldDrag arbitration ────────────────────────────────────────────────
  /**
   * Starts the framer-motion drag ONLY when:
   *   (a) the gesture originates from the handle/header area (fromHandle=true), OR
   *   (b) the inner scroller is at scrollTop===0 AND the 100 ms lockout has expired.
   *
   * This replicates vaul's shouldDrag logic that prevents scroll momentum from
   * accidentally flinging the sheet closed.
   */
  const startDragIfAllowed = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, fromHandle: boolean) => {
      if (fromHandle) {
        dragControls.start(event);
        return;
      }
      const el = scrollRef.current;
      const atTop = !el || el.scrollTop === 0;
      const lockoutExpired = Date.now() - scrollReachedTopAtRef.current >= 100;
      if (atTop && lockoutExpired) {
        dragControls.start(event);
      }
    },
    [dragControls],
  );

  // ── Backdrop opacity tied to live drag progress ───────────────────────────
  //
  // We scale over the bottom 85% of the visual viewport.  At y=0 the backdrop
  // multiplier is 1 (full opacity of the rgba below); at y=85dvh it drops to 0.
  // The backdrop base colour is set on the container via style (not a class) so
  // the useTransform value acts as a multiplier on top of it.
  const backdropOpacity = useTransform(
    y,
    [0, typeof window !== 'undefined' ? window.innerHeight * 0.85 : 600],
    [1, 0],
  );

  // ── Drag-end handler ──────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: { velocity: { x: number; y: number } },
    ) => {
      const sheetHeight = panelRef.current?.offsetHeight ?? window.innerHeight * 0.85;
      const offsetY = y.get();
      const velocityY = info.velocity.y;

      const shouldClose = decideSheetClose({ offsetY, velocityY, sheetHeight });

      if (shouldClose) {
        // Call onClose immediately; AnimatePresence will play the exit animation.
        onClose();
      } else {
        // Spring back to resting position seeded with the release velocity for
        // gesture-to-animation velocity continuity (the #1 "feels native" trick).
        void animate(y, 0, { ...SHEET_SPRING, velocity: velocityY });
      }
    },
    [y, onClose],
  );

  // ── Motion variants for panel enter/exit ──────────────────────────────────
  const reducedTransition = { duration: 0.01 };

  const panelVariants = {
    hidden: { y: '100%' },
    visible: {
      y: 0,
      transition: prefersReduced ? reducedTransition : SHEET_SPRING,
    },
    exit: {
      y: '100%',
      transition: prefersReduced ? reducedTransition : { ...SHEET_SPRING, velocity: 200 },
    },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: prefersReduced ? reducedTransition : { duration: 0.2 },
    },
    exit: {
      opacity: 0,
      transition: prefersReduced ? reducedTransition : { duration: 0.15 },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="bottomsheet-backdrop"
          className="fixed inset-0 z-50 flex items-end"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          // Backdrop-tap closes (preserved from original)
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Semi-transparent background — opacity fades with drag progress */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            style={{ opacity: backdropOpacity }}
            // Let pointer events fall through to the parent (backdrop-tap)
            onClick={onClose}
          />

          {/* Sheet panel */}
          <motion.div
            ref={panelRef}
            key="bottomsheet-panel"
            // Stop backdrop-tap from closing when clicking inside the sheet
            onClick={(e) => e.stopPropagation()}
            className="relative w-full bg-background rounded-t-2xl overflow-hidden flex flex-col max-h-[85dvh]"
            // Fallback for browsers without dvh: also apply max-h in vh.
            // Tailwind doesn't have 85dvh by default so we use inline style.
            style={{ maxHeight: 'min(85dvh, 85vh)', y }}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            // Drag configuration — vaul style
            drag="y"
            dragControls={dragControls}
            // dragListener=false means framer-motion won't attach its own
            // pointer listener; we call dragControls.start() manually.
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.15, bottom: 0.6 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            // Panel-level pointer-down: start drag if shouldDrag passes
            onPointerDown={(e) => startDragIfAllowed(e, false)}
          >
            {/* ── Grab handle ──────────────────────────────────────────────
             *  ≥48 px touch area, touch-action:none so the browser doesn't
             *  attempt scroll/zoom on this region.
             *  The visual pill is 36×4 px centred in the touch target.
             */}
            <div
              className="flex justify-center items-center w-full cursor-grab active:cursor-grabbing flex-shrink-0"
              style={{ height: 48, touchAction: 'none' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                startDragIfAllowed(e, true);
              }}
              data-testid="sheet-drag-handle"
              aria-hidden="true"
            >
              <div
                className="bg-muted-foreground/40 rounded-full"
                style={{ width: 36, height: 4 }}
              />
            </div>

            {/* ── Sticky header (preserved from original) ─────────────────
             *  Header area is also always draggable.
             */}
            <div
              className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between flex-shrink-0"
              onPointerDown={(e) => {
                e.stopPropagation();
                startDragIfAllowed(e, true);
              }}
              style={{ touchAction: 'none' }}
            >
              <h2 className="text-lg font-bold">{title}</h2>
              {/* X close preserved — drag is NEVER the only way out */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 text-muted-foreground hover:text-foreground touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Scrollable body ──────────────────────────────────────────
             *  overscroll-behavior:contain stops scroll momentum from
             *  propagating upward into a drag.  The onScroll handler tracks
             *  when scrollTop reaches 0 for the 100 ms lockout.
             */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4"
              style={{ overscrollBehavior: 'contain' }}
              onScroll={handleScrollerScroll}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
