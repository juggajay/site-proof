import { useIsMobile } from '@/hooks/useMediaQuery';

/**
 * Hard ceiling for fetching a fragments file on a mobile-class device.
 *
 * Evidence (Wave 0 spike, real devices, 2026-08-07): an 8.7 MB frag passed on
 * every device tested including two real iPhones; a 30.3 MB frag hard-crashed
 * both iPhones with Safari reload-kill loops. A "load anyway" button is a
 * crash button, so there isn't one. 15 MB stays under 2x the proven-safe
 * point while the known kill is 2x above it. Tuning knob, not a law — revisit
 * with new device evidence, never with an override button.
 */
export const MOBILE_FRAG_BUDGET_BYTES = 15_000_000;

/**
 * iPads masquerade as desktop Safari (platform "MacIntel"), and that platform
 * family is the one that actually crashes on oversized models. Touch points
 * plus an Apple platform string catches them without touching real desktops.
 */
export function isTouchApplePlatform(
  nav: Pick<Navigator, 'maxTouchPoints' | 'platform'> = navigator,
): boolean {
  return nav.maxTouchPoints > 1 && /Mac|iP/.test(nav.platform);
}

/**
 * Pure budget verdict: block when a mobile-class device would fetch a frag
 * over the ceiling. Unknown size (null) is not blocked — the fragments route
 * 404s until the version is `ready`, at which point fragSizeBytes is set.
 */
export function isOverMobileBudget(fragSizeBytes: number | null, isMobileClass: boolean): boolean {
  return isMobileClass && fragSizeBytes !== null && fragSizeBytes > MOBILE_FRAG_BUDGET_BYTES;
}

/** Mobile-class device: narrow viewport OR a touch-first Apple device. */
export function useIsMobileClassDevice(): boolean {
  const isMobileViewport = useIsMobile();
  return isMobileViewport || isTouchApplePlatform();
}
