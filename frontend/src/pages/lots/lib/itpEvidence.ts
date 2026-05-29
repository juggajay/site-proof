/**
 * Pure ITP-evidence helpers and photo constants.
 * Extracted from LotDetailPage.tsx — no component state, no data fetching.
 */

import type { ITPChecklistItem } from '../types';

export const normalizeResponsibleParty = (value: string): ITPChecklistItem['responsibleParty'] => {
  if (
    value === 'contractor' ||
    value === 'subcontractor' ||
    value === 'superintendent' ||
    value === 'general'
  ) {
    return value;
  }
  return 'general';
};

export const MAX_ITP_PHOTO_SIZE = 10 * 1024 * 1024;
export const ALLOWED_ITP_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const getItpPhotoValidationError = (file: File): string | null => {
  if (file.size > MAX_ITP_PHOTO_SIZE) {
    return `The file "${file.name}" exceeds the 10MB limit. Please select a smaller file.`;
  }

  if (!ALLOWED_ITP_PHOTO_TYPES.includes(file.type)) {
    return `The file "${file.name}" is not a supported image format. Please use JPEG, PNG, GIF, or WebP.`;
  }

  return null;
};

export const getGPSLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
};
