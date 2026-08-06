/**
 * Unit tests for useIsPhone — the device-class hook behind the mobile shell
 * gate. The point of the hook is that a phone stays a phone when it rotates,
 * which a width-only query gets wrong (a landscape phone is ~844 px wide).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile, useIsPhone } from './useMediaQuery';
import { installMatchMedia, DEVICES } from '@/test/stubs/matchMedia';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useIsPhone', () => {
  it('is true on a phone in portrait (narrow viewport)', () => {
    installMatchMedia(DEVICES.phonePortrait);
    expect(renderHook(() => useIsPhone()).result.current).toBe(true);
  });

  it('is true on a phone in landscape — wide viewport, but coarse and short', () => {
    installMatchMedia(DEVICES.phoneLandscape);
    expect(renderHook(() => useIsPhone()).result.current).toBe(true);
  });

  it('is false on a wide desktop with a fine pointer', () => {
    installMatchMedia(DEVICES.desktopWide);
    expect(renderHook(() => useIsPhone()).result.current).toBe(false);
  });

  it('is true in a narrow desktop window — the existing narrow clause is untouched', () => {
    installMatchMedia(DEVICES.desktopNarrowWindow);
    expect(renderHook(() => useIsPhone()).result.current).toBe(true);
  });

  it('is true on a landscape tablet with a short viewport (accepted trade-off)', () => {
    // An iPad mini sideways (744 px tall, coarse) reads as phone-class. Owner
    // accepted this rather than adding device special-casing.
    installMatchMedia(DEVICES.tabletLandscape);
    expect(renderHook(() => useIsPhone()).result.current).toBe(true);
  });
});

describe('useIsMobile stays width-only', () => {
  it('is false on a landscape phone — responsive layout still keys on width', () => {
    installMatchMedia(DEVICES.phoneLandscape);
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('is true on a portrait phone', () => {
    installMatchMedia(DEVICES.phonePortrait);
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });
});
