import { describe, expect, it } from 'vitest';

import { AppError } from '../AppError.js';
import { isSupportedEpsg, listSupportedEpsg, localToWgs84, wgs84ToLocal } from './crs.js';

/**
 * Ground truth: Geoscience Australia's official GDA2020 ↔ MGA2020 test vectors
 * from the GeodePy geodesy library (GeoscienceAustralia/GeodePy), pairing each
 * station's MGA2020 grid coordinate with its GDA2020 geographic coordinate.
 * Grid:  https://github.com/GeoscienceAustralia/GeodePy/blob/master/geodepy/tests/resources/Test_Conversion_Grid.csv
 * Geo:   https://github.com/GeoscienceAustralia/GeodePy/blob/master/geodepy/tests/resources/Test_Conversion_Geo.csv
 * Geographic values are in GA packed "DDD.MMSSsss" notation (see below).
 */

// Convert GA packed degrees-minutes-seconds ("DDD.MMSSssss") to decimal degrees.
function packedDmsToDecimal(value: number): number {
  const sign = Math.sign(value) || 1;
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const rem = (abs - degrees) * 100;
  const minutes = Math.floor(rem + 1e-9);
  const seconds = (rem - minutes) * 100;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

interface Vector {
  name: string;
  epsg: string;
  easting: number;
  northing: number;
  packedLat: number;
  packedLng: number;
}

// Three stations spanning MGA zones 50, 55 and 56.
const VECTORS: Vector[] = [
  {
    name: 'BODD',
    epsg: 'EPSG:7850',
    easting: 440661.402,
    northing: 6377328.425,
    packedLat: -32.44249832,
    packedLng: 116.21599233,
  },
  {
    name: 'CROY',
    epsg: 'EPSG:7855',
    easting: 350356.672,
    northing: 5813433.08,
    packedLat: -37.48512852,
    packedLng: 145.17597271,
  },
  {
    name: 'CBTN',
    epsg: 'EPSG:7856',
    easting: 298825.805,
    northing: 6228681.889,
    packedLat: -34.0347861,
    packedLng: 150.4912502,
  },
];

// Metres-per-degree at a latitude, for turning an angular error into a distance.
function degErrorToMetres(latDegError: number, lngDegError: number, atLat: number): number {
  const latMetres = latDegError * 111_320;
  const lngMetres = lngDegError * 111_320 * Math.cos((atLat * Math.PI) / 180);
  return Math.hypot(latMetres, lngMetres);
}

describe('crs presets', () => {
  it('exposes GDA2020, GDA94 (zones 49–56) and WGS84', () => {
    expect(isSupportedEpsg('EPSG:4326')).toBe(true);
    for (let zone = 49; zone <= 56; zone += 1) {
      expect(isSupportedEpsg(`EPSG:${7800 + zone}`)).toBe(true); // GDA2020
      expect(isSupportedEpsg(`EPSG:${28300 + zone}`)).toBe(true); // GDA94
    }
    expect(isSupportedEpsg('EPSG:7857')).toBe(false);
    expect(listSupportedEpsg()).toContain('EPSG:7856');
  });

  it('rejects an unknown EPSG code with a 400', () => {
    expect(() => localToWgs84('EPSG:9999', { easting: 1, northing: 1 })).toThrowError(AppError);
    try {
      localToWgs84('EPSG:9999', { easting: 1, northing: 1 });
    } catch (err) {
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it('rejects non-finite coordinates', () => {
    expect(() => localToWgs84('EPSG:7856', { easting: NaN, northing: 1 })).toThrowError(AppError);
    expect(() => wgs84ToLocal('EPSG:7856', { lng: 151, lat: Infinity })).toThrowError(AppError);
  });
});

describe('MGA2020 → WGS84 against published GA vectors', () => {
  for (const v of VECTORS) {
    it(`${v.name} projects within 0.5 m`, () => {
      const expectedLat = packedDmsToDecimal(v.packedLat);
      const expectedLng = packedDmsToDecimal(v.packedLng);
      const { lat, lng } = localToWgs84(v.epsg, { easting: v.easting, northing: v.northing });
      const distance = degErrorToMetres(lat - expectedLat, lng - expectedLng, expectedLat);
      expect(distance).toBeLessThan(0.5);
    });

    it(`${v.name} round-trips within 0.01 m`, () => {
      const wgs = localToWgs84(v.epsg, { easting: v.easting, northing: v.northing });
      const back = wgs84ToLocal(v.epsg, wgs);
      const distance = Math.hypot(back.easting - v.easting, back.northing - v.northing);
      expect(distance).toBeLessThan(0.01);
    });
  }
});
