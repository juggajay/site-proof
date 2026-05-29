import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_ITP_PHOTO_TYPES,
  MAX_ITP_PHOTO_SIZE,
  getGPSLocation,
  getItpPhotoValidationError,
  normalizeResponsibleParty,
} from './itpEvidence';

// jsdom implements the File constructor but derives `size` from the byte parts.
// Override `size` with a defined property so we can exercise the 10MB boundary
// without allocating multi-megabyte buffers.
const makeFile = (name: string, type: string, size: number): File => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
};

describe('getItpPhotoValidationError', () => {
  it('returns null for a supported image under the size limit', () => {
    const file = makeFile('site-photo.png', 'image/png', 2 * 1024 * 1024);
    expect(getItpPhotoValidationError(file)).toBeNull();
  });

  it('accepts a file exactly at the 10MB limit (boundary is inclusive)', () => {
    const file = makeFile('exact.jpg', 'image/jpeg', MAX_ITP_PHOTO_SIZE);
    expect(getItpPhotoValidationError(file)).toBeNull();
  });

  it('returns the unsupported-format message for a disallowed MIME type', () => {
    const file = makeFile('diagram.svg', 'image/svg+xml', 1024);
    expect(getItpPhotoValidationError(file)).toBe(
      'The file "diagram.svg" is not a supported image format. Please use JPEG, PNG, GIF, or WebP.',
    );
  });

  it('returns the 10MB message for an oversized file', () => {
    const file = makeFile('huge.png', 'image/png', MAX_ITP_PHOTO_SIZE + 1);
    expect(getItpPhotoValidationError(file)).toBe(
      'The file "huge.png" exceeds the 10MB limit. Please select a smaller file.',
    );
  });

  it('checks size before type (oversized + unsupported yields the size message)', () => {
    const file = makeFile('huge.svg', 'image/svg+xml', MAX_ITP_PHOTO_SIZE + 1);
    expect(getItpPhotoValidationError(file)).toBe(
      'The file "huge.svg" exceeds the 10MB limit. Please select a smaller file.',
    );
  });

  it('validates against the documented limit and allowed type list', () => {
    expect(MAX_ITP_PHOTO_SIZE).toBe(10 * 1024 * 1024);
    expect(ALLOWED_ITP_PHOTO_TYPES).toEqual(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  });
});

describe('normalizeResponsibleParty', () => {
  it('passes the known responsible-party values through unchanged', () => {
    expect(normalizeResponsibleParty('contractor')).toBe('contractor');
    expect(normalizeResponsibleParty('subcontractor')).toBe('subcontractor');
    expect(normalizeResponsibleParty('superintendent')).toBe('superintendent');
    expect(normalizeResponsibleParty('general')).toBe('general');
  });

  it('falls back to "general" for blank or unknown values', () => {
    expect(normalizeResponsibleParty('')).toBe('general');
    expect(normalizeResponsibleParty('project_manager')).toBe('general');
    expect(normalizeResponsibleParty('owner')).toBe('general');
  });

  it('is case-sensitive — a capitalized known value falls back to "general"', () => {
    expect(normalizeResponsibleParty('Contractor')).toBe('general');
  });
});

describe('getGPSLocation', () => {
  afterEach(() => {
    // Remove the per-test override so the prototype default (undefined in jsdom)
    // is restored and tests stay order-independent.
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  const setGeolocation = (value: unknown) => {
    Object.defineProperty(navigator, 'geolocation', {
      value,
      configurable: true,
      writable: true,
    });
  };

  it('resolves null when geolocation is unavailable', async () => {
    setGeolocation(undefined);
    await expect(getGPSLocation()).resolves.toBeNull();
  });

  it('resolves latitude/longitude on a successful fix', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({
        coords: { latitude: -33.8688, longitude: 151.2093 },
      } as unknown as GeolocationPosition),
    );
    setGeolocation({ getCurrentPosition });

    await expect(getGPSLocation()).resolves.toEqual({
      latitude: -33.8688,
      longitude: 151.2093,
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('resolves null when geolocation reports an error', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) =>
      error({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError),
    );
    setGeolocation({ getCurrentPosition });

    await expect(getGPSLocation()).resolves.toBeNull();
  });
});
