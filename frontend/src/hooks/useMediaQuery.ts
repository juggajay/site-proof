import { useState, useEffect } from 'react'

/**
 * Hook to detect if a media query matches
 * @param query - CSS media query string
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

/**
 * Hook to detect if viewport is mobile-sized (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

/**
 * Hook to detect if viewport is tablet-sized (768px - 1023px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
}

/**
 * Hook to detect if viewport is desktop-sized (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
