import { describe, expect, it } from 'vitest';

import { applyTransform } from './planSheetRegistration';
import {
  buildRegistration,
  collectViewportText,
  matchCrs,
  numberArray,
  objectBody,
  parseViewportGeoref,
  tmForward,
  type PageGeoref,
} from './geoPdf';

// Geoscience Australia's published GDA2020 ↔ MGA2020 vectors (same fixtures the
// backend crs.test.ts asserts against). Geographic values are GA packed
// "DDD.MMSSssss" notation → decimal degrees.
function packedDmsToDecimal(value: number): number {
  const sign = Math.sign(value) || 1;
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const rem = (abs - degrees) * 100;
  const minutes = Math.floor(rem + 1e-9);
  const seconds = (rem - minutes) * 100;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

const VECTORS = [
  {
    name: 'BODD',
    zone: 50,
    easting: 440661.402,
    northing: 6377328.425,
    lat: -32.44249832,
    lng: 116.21599233,
  },
  {
    name: 'CROY',
    zone: 55,
    easting: 350356.672,
    northing: 5813433.08,
    lat: -37.48512852,
    lng: 145.17597271,
  },
  {
    name: 'CBTN',
    zone: 56,
    easting: 298825.805,
    northing: 6228681.889,
    lat: -34.0347861,
    lng: 150.4912502,
  },
];

describe('tmForward — GDA2020 → MGA2020 against GA vectors', () => {
  for (const v of VECTORS) {
    it(`${v.name} projects within 0.01 m`, () => {
      const { easting, northing } = tmForward(
        packedDmsToDecimal(v.lat),
        packedDmsToDecimal(v.lng),
        v.zone,
      );
      expect(Math.hypot(easting - v.easting, northing - v.northing)).toBeLessThan(0.01);
    });
  }
});

describe('matchCrs', () => {
  it('accepts a GDA2020 MGA zone name', () => {
    expect(matchCrs('PROJCS["GDA2020 / MGA zone 56",GEOGCS["GDA2020",...]]')).toEqual({
      epsg: 'EPSG:7856',
      zone: 56,
    });
  });

  it('accepts a GDA94 MGA zone name', () => {
    expect(matchCrs('PROJCS["GDA94 / MGA zone 50",...]')).toEqual({ epsg: 'EPSG:28350', zone: 50 });
  });

  it('accepts an explicit supported EPSG authority code', () => {
    expect(matchCrs('AUTHORITY["EPSG","7855"]')).toEqual({ epsg: 'EPSG:7855', zone: 55 });
  });

  it('is not fooled by datum/ellipsoid authority codes', () => {
    // GDA2020 geographic (7844), datum (1168), ellipsoid GRS80 (7019) — none in
    // the projected ranges — plus the real projected code 7851.
    const wkt =
      'PROJCS["GDA2020 / MGA zone 51",GEOGCS["GDA2020",DATUM["GDA2020",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","1168"]],AUTHORITY["EPSG","7844"]],AUTHORITY["EPSG","7851"]]';
    expect(matchCrs(wkt)).toEqual({ epsg: 'EPSG:7851', zone: 51 });
  });

  it('rejects an unsupported CRS (WGS84 / UTM)', () => {
    expect(matchCrs('PROJCS["WGS 84 / UTM zone 56S",AUTHORITY["EPSG","32756"]]')).toBeNull();
  });

  it('rejects an out-of-range MGA zone', () => {
    expect(matchCrs('PROJCS["GDA2020 / MGA zone 40"]')).toBeNull();
  });

  it('rejects empty / junk', () => {
    expect(matchCrs('')).toBeNull();
    expect(matchCrs('PROJCS["Some State Plane"]')).toBeNull();
  });
});

describe('numberArray + objectBody (byte scanner primitives)', () => {
  it('reads a numeric array by key', () => {
    expect(numberArray('/BBox [ 10 20 630.5 470 ] /Foo', 'BBox')).toEqual([10, 20, 630.5, 470]);
    expect(numberArray('no key here', 'GPTS')).toBeNull();
  });

  it('extracts an indirect object body and ignores lookalike numbers', () => {
    const pdf = '12 0 obj\n<< /Type /Measure >>\nendobj\n112 0 obj\n<< /X 1 >>\nendobj';
    // Must match "12 0 obj", not the "12" inside "112 0 obj".
    expect(objectBody(pdf, 12, 0)).toContain('/Type /Measure');
    expect(objectBody(pdf, 112, 0)).toContain('/X 1');
    expect(objectBody(pdf, 99, 0)).toBeNull();
  });
});

// A synthetic minimal GeoPDF fragment: a page dict with /VP referencing a
// viewport object, whose /Measure and /GCS are separate indirect objects.
const SYNTHETIC_PDF = `3 0 obj
<< /Type /Page /MediaBox [0 0 1000 800] /VP 4 0 R >>
endobj
4 0 obj
[ << /Type /Viewport /BBox [100 50 900 650] /Measure 5 0 R >> ]
endobj
5 0 obj
<< /Type /Measure /Subtype /GEO /GPTS [ -33.0 151.0 -33.001 151.0 -33.001 151.002 -33.0 151.002 ] /LPTS [ 0 1 0 0 1 0 1 1 ] /GCS 6 0 R >>
endobj
6 0 obj
<< /Type /PROJCS /WKT (PROJCS["GDA2020 / MGA zone 56",AUTHORITY["EPSG","7856"]]) >>
endobj`;

describe('collectViewportText + parseViewportGeoref (tolerant scan)', () => {
  it('resolves /VP → /Measure → /GCS and reads all fields', () => {
    const pageBody = objectBody(SYNTHETIC_PDF, 3, 0)!;
    const vpText = collectViewportText(SYNTHETIC_PDF, pageBody);
    expect(vpText).not.toBeNull();
    const georef = parseViewportGeoref(vpText!, [0, 0, 1000, 800]);
    expect(georef).not.toBeNull();
    expect(georef!.crs).toEqual({ epsg: 'EPSG:7856', zone: 56 });
    expect(georef!.bbox).toEqual([100, 50, 900, 650]);
    expect(georef!.gpts).toHaveLength(8);
    expect(georef!.lpts).toEqual([0, 1, 0, 0, 1, 0, 1, 1]);
  });

  it('returns null when the CRS is unsupported', () => {
    const pdf = SYNTHETIC_PDF.replace('GDA2020 / MGA zone 56', 'WGS 84 / UTM zone 56S').replace(
      '"EPSG","7856"',
      '"EPSG","32756"',
    );
    const pageBody = objectBody(pdf, 3, 0)!;
    const vpText = collectViewportText(pdf, pageBody);
    expect(parseViewportGeoref(vpText!, [0, 0, 1000, 800])).toBeNull();
  });
});

describe('buildRegistration — LPTS→pixel mapping, y-flip, round-trip', () => {
  const georef: PageGeoref = {
    crs: { epsg: 'EPSG:7856', zone: 56 },
    view: [0, 0, 1000, 800],
    bbox: [100, 50, 900, 650],
    // Corners LL, UL, UR, LR (matching LPTS order below).
    gpts: [-33.0, 151.0, -33.0018, 151.0, -33.0018, 151.002, -33.0, 151.002],
    lpts: [0, 0, 0, 1, 1, 1, 1, 0],
  };

  it('maps BBox fractions to raster pixels with the PDF y-up → raster y-down flip', () => {
    const result = buildRegistration(georef, 2000, 1600)!; // scale ×2 both axes
    expect(result.coordinateSystem).toBe('EPSG:7856');
    const pts = result.registration.points;

    // LL corner (lx=0,ly=0): xPdf=100 → px=200; yPdf=50 → py=(800-50)*2=1500.
    expect(pts[0].px).toBeCloseTo(200, 6);
    expect(pts[0].py).toBeCloseTo(1500, 6);
    // UL corner (lx=0,ly=1): yPdf=650 → py=(800-650)*2=300 (top of image).
    expect(pts[1].px).toBeCloseTo(200, 6);
    expect(pts[1].py).toBeCloseTo(300, 6);
    // North-up: the ly=1 corner sits ABOVE (smaller py) the ly=0 corner.
    expect(pts[1].py).toBeLessThan(pts[0].py);
    // UR corner (lx=1): xPdf=900 → px=1800.
    expect(pts[2].px).toBeCloseTo(1800, 6);
  });

  it('produces a transform that round-trips every corner to sub-mm', () => {
    const { registration } = buildRegistration(georef, 2000, 1600)!;
    for (const p of registration.points) {
      const [e, n] = applyTransform(registration.transform, p.px, p.py);
      expect(Math.hypot(e - p.easting, n - p.northing)).toBeLessThan(1e-3);
    }
    expect(registration.rmsErrorM).toBeLessThan(1e-3);
  });

  it('rejects a degenerate raster size', () => {
    expect(buildRegistration(georef, 0, 1600)).toBeNull();
  });
});
