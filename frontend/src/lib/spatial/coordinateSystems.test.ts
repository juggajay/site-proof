import { describe, expect, it } from 'vitest';
import {
  COORDINATE_SYSTEM_OPTIONS,
  DEFAULT_COORDINATE_SYSTEM,
  coordinateSystemLabel,
} from './coordinateSystems';

describe('COORDINATE_SYSTEM_OPTIONS', () => {
  it('covers GDA2020 and GDA94 MGA zones 49–56 (16 options)', () => {
    expect(COORDINATE_SYSTEM_OPTIONS).toHaveLength(16);
  });

  it('maps GDA2020 zones to EPSG:7849–7856', () => {
    const gda2020 = COORDINATE_SYSTEM_OPTIONS.filter((o) => o.label.startsWith('GDA2020'));
    expect(gda2020.map((o) => o.value)).toEqual([
      'EPSG:7849',
      'EPSG:7850',
      'EPSG:7851',
      'EPSG:7852',
      'EPSG:7853',
      'EPSG:7854',
      'EPSG:7855',
      'EPSG:7856',
    ]);
  });

  it('maps GDA94 zones to EPSG:28349–28356', () => {
    const gda94 = COORDINATE_SYSTEM_OPTIONS.filter((o) => o.label.startsWith('GDA94'));
    expect(gda94.map((o) => o.value)).toEqual([
      'EPSG:28349',
      'EPSG:28350',
      'EPSG:28351',
      'EPSG:28352',
      'EPSG:28353',
      'EPSG:28354',
      'EPSG:28355',
      'EPSG:28356',
    ]);
  });

  it('uses a human label with the EPSG code', () => {
    expect(coordinateSystemLabel('EPSG:7856')).toBe('GDA2020 / MGA Zone 56 (EPSG:7856)');
  });

  it('falls back to the raw code when unknown', () => {
    expect(coordinateSystemLabel('EPSG:9999')).toBe('EPSG:9999');
  });

  it('defaults to a supported system', () => {
    expect(COORDINATE_SYSTEM_OPTIONS.some((o) => o.value === DEFAULT_COORDINATE_SYSTEM)).toBe(true);
  });
});
