import { useState, useEffect } from 'react';

/**
 * Hook to detect if a media query matches
 * @param query - CSS media query string
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export const MOBILE_QUERY = '(max-width: 767px)';
/** Touch-primary device with a short viewport — i.e. a phone held sideways. */
export const LANDSCAPE_PHONE_QUERY = '(pointer: coarse) and (max-height: 767px)';

/**
 * Hook to detect if viewport is mobile-sized (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

/**
 * Hook to detect a phone-class device in EITHER orientation: the existing
 * narrow-viewport check, OR a touch-primary device whose viewport is short
 * (a phone in landscape, ~850x390).
 *
 * Additive on purpose — narrow-viewport behaviour (including desktop narrow
 * windows and width-based E2E) is unchanged; only landscape phones are newly
 * included. Use this for device-class decisions (which app shell to render);
 * keep using useIsMobile() for responsive layout, which is about width.
 */
export function useIsPhone(): boolean {
  const narrow = useIsMobile();
  // ponytail: two queries composed in JS — Media Queries Level 4 `or` inside a
  // single query string is not supported widely enough to rely on.
  const landscapePhone = useMediaQuery(LANDSCAPE_PHONE_QUERY);
  return narrow || landscapePhone;
}

/**
 * Hook to detect if viewport is tablet-sized (768px - 1023px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/**
 * Hook to detect if viewport is desktop-sized (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
