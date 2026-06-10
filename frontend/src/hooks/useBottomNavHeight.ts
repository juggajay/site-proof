// Publishes the rendered height of the fixed mobile bottom nav as a CSS
// custom property on <html>, so floating UI (e.g. the offline sync pill in
// OfflineIndicator) can anchor itself above the nav instead of covering the
// tabs. Consumed by the `.above-bottom-nav` utility in index.css.
import { useLayoutEffect, useRef } from 'react';

/**
 * CSS custom property holding the bottom nav's current height in px.
 * It is 0px (or unset) whenever no bottom nav is visible: the nav is
 * unmounted (routes without MainLayout) or hidden by `md:hidden` at the
 * desktop breakpoint, where `offsetHeight` reads 0.
 */
export const BOTTOM_NAV_HEIGHT_VAR = '--bottom-nav-height';

/**
 * Attach the returned ref to a fixed bottom nav element. Its measured height
 * (including the `pb-safe` safe-area padding and any extra strips, e.g. the
 * foreman "no project" notice) is mirrored into BOTTOM_NAV_HEIGHT_VAR and
 * kept up to date via ResizeObserver — which also fires when `md:hidden`
 * collapses the nav's box, dropping the published height back to 0.
 */
export function usePublishBottomNavHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty(BOTTOM_NAV_HEIGHT_VAR, `${el.offsetHeight}px`);
    };

    publish();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(el);

    return () => {
      observer?.disconnect();
      root.style.removeProperty(BOTTOM_NAV_HEIGHT_VAR);
    };
  }, []);

  return ref;
}
