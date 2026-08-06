/**
 * matchMedia stub that answers the width/height/pointer features the app's
 * media queries actually use, so a test can describe a DEVICE
 * ({ width, height, pointer }) instead of hand-mapping query strings to
 * booleans. Needed for the shell gate, which composes a width query and a
 * `(pointer: coarse) and (max-height: ...)` query.
 *
 * ponytail: deliberately not a real CSS media-query parser — it handles
 * min/max-width, min/max-height and pointer, `and`-joined. Extend when a new
 * feature actually gets used.
 */
export type StubDevice = {
  width: number;
  height: number;
  /** Defaults to 'fine' (mouse/desktop). Phones and tablets are 'coarse'. */
  pointer?: 'fine' | 'coarse';
};

function matchesFeature(feature: string, device: StubDevice): boolean {
  const [rawName, rawValue] = feature.replace(/^\(|\)$/g, '').split(':');
  const name = rawName.trim();
  const value = (rawValue ?? '').trim();

  switch (name) {
    case 'min-width':
      return device.width >= parseInt(value, 10);
    case 'max-width':
      return device.width <= parseInt(value, 10);
    case 'min-height':
      return device.height >= parseInt(value, 10);
    case 'max-height':
      return device.height <= parseInt(value, 10);
    case 'pointer':
      return (device.pointer ?? 'fine') === value;
    default:
      throw new Error(`matchMedia stub: unsupported media feature "${name}" in "${feature}"`);
  }
}

export function queryMatchesDevice(query: string, device: StubDevice): boolean {
  return query.split(/\s+and\s+/i).every((feature) => matchesFeature(feature.trim(), device));
}

/**
 * Installs a window.matchMedia stub for the given device. Returns nothing —
 * tests using `restoreMocks`/`vi.restoreAllMocks()` get cleanup for free; call
 * again with a different device to "rotate" before the next render.
 */
export function installMatchMedia(device: StubDevice): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: queryMatchesDevice(query, device),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/** Common devices, so tests read as scenarios rather than numbers. */
export const DEVICES = {
  phonePortrait: { width: 390, height: 844, pointer: 'coarse' } as StubDevice,
  phoneLandscape: { width: 844, height: 390, pointer: 'coarse' } as StubDevice,
  desktopWide: { width: 1440, height: 900, pointer: 'fine' } as StubDevice,
  desktopNarrowWindow: { width: 500, height: 900, pointer: 'fine' } as StubDevice,
  tabletLandscape: { width: 1133, height: 744, pointer: 'coarse' } as StubDevice,
};
