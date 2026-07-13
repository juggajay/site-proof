import { XMLParser } from 'fast-xml-parser';

import { AppError } from '../AppError.js';
import {
  type ImportedAlignment,
  type ImportResult,
  type Segment,
  type Vec,
  segmentsToControlPoints,
} from './alignmentImport.js';

/**
 * LandXML alignment importer (12d, Civil3D, etc.).
 *
 * Reads <Alignments><Alignment><CoordGeom> geometry: <Line> and <Curve> (circular
 * arc) elements are supported; <Spiral> (clothoid) and any other geometry element
 * cause that alignment to be REJECTED with a named warning rather than silently
 * approximated. Multiple alignments in one file each become a separate importable
 * control line.
 *
 * LandXML point lists are ordered "northing easting" (Y then X) — see the
 * LandXML schema PntList2D / Start / End definitions. We parse them in that order.
 *
 * `preserveOrder` keeps the CoordGeom children in document (along-alignment)
 * order, which chainage accumulation depends on; without it fast-xml-parser
 * groups siblings by tag name and loses a Line/Curve/Line sequence.
 */

// preserveOrder node: exactly one non-metadata key (the tag) whose value is an
// array of child nodes; attributes live under ':@', text under '#text'.
type OrderedNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: true,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

function tagOf(node: OrderedNode): string | null {
  for (const key of Object.keys(node)) {
    if (key !== ':@' && key !== '#text') return key;
  }
  return null;
}

function childrenOf(node: OrderedNode): OrderedNode[] {
  const tag = tagOf(node);
  const value = tag ? node[tag] : null;
  return Array.isArray(value) ? (value as OrderedNode[]) : [];
}

function attrsOf(node: OrderedNode): Record<string, string> {
  return (node[':@'] as Record<string, string> | undefined) ?? {};
}

function textOf(node: OrderedNode): string {
  return childrenOf(node)
    .map((child) => (typeof child['#text'] === 'string' ? child['#text'] : ''))
    .join(' ')
    .trim();
}

function findFirst(nodes: OrderedNode[], tag: string): OrderedNode | null {
  for (const node of nodes) {
    if (tagOf(node) === tag) return node;
    const found = findFirst(childrenOf(node), tag);
    if (found) return found;
  }
  return null;
}

// LandXML points are "northing easting" (plus optional elevation, ignored).
function parsePoint(node: OrderedNode, context: string): Vec {
  const parts = textOf(node)
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    throw AppError.badRequest(`${context} is not a valid "northing easting" point`);
  }
  return { n: parts[0], e: parts[1] };
}

function findPoint(coordGeomChild: OrderedNode, tag: string, context: string): Vec {
  const node = childrenOf(coordGeomChild).find((c) => tagOf(c) === tag);
  if (!node) {
    throw AppError.badRequest(`${context} is missing a <${tag}> point`);
  }
  return parsePoint(node, `${context} <${tag}>`);
}

function segmentFromElement(element: OrderedNode, alignmentName: string): Segment {
  const tag = tagOf(element);
  if (tag === 'Line') {
    return {
      kind: 'line',
      start: findPoint(element, 'Start', 'Line'),
      end: findPoint(element, 'End', 'Line'),
    };
  }
  if (tag === 'Curve') {
    const rot = (attrsOf(element)['@_rot'] ?? '').trim().toLowerCase();
    if (rot !== 'cw' && rot !== 'ccw') {
      throw AppError.badRequest(`Curve in "${alignmentName}" is missing a rot="cw|ccw" direction`);
    }
    return {
      kind: 'arc',
      start: findPoint(element, 'Start', 'Curve'),
      center: findPoint(element, 'Center', 'Curve'),
      end: findPoint(element, 'End', 'Curve'),
      clockwise: rot === 'cw',
    };
  }
  // Spiral (clothoid) and anything else: unsupported → reject the alignment.
  throw AppError.badRequest(
    `"${alignmentName}" contains an unsupported <${tag ?? 'unknown'}> element ` +
      '(only straight Line and circular Curve geometry can be imported)',
  );
}

function parseAlignment(alignment: OrderedNode): ImportedAlignment {
  const attrs = attrsOf(alignment);
  const name = (attrs['@_name'] ?? '').trim() || 'Unnamed alignment';
  const staStartRaw = attrs['@_staStart'];
  const staStart = staStartRaw !== undefined ? Number(staStartRaw) : 0;
  if (!Number.isFinite(staStart)) {
    throw AppError.badRequest(`"${name}" has a non-numeric staStart`);
  }

  const coordGeom = childrenOf(alignment).find((c) => tagOf(c) === 'CoordGeom');
  if (!coordGeom) {
    throw AppError.badRequest(`"${name}" has no <CoordGeom> geometry`);
  }

  const segments = childrenOf(coordGeom)
    .filter((c) => tagOf(c) !== null)
    .map((element) => segmentFromElement(element, name));
  if (segments.length === 0) {
    throw AppError.badRequest(`"${name}" has no Line or Curve geometry`);
  }

  return { name, points: segmentsToControlPoints(segments, staStart) };
}

export function parseLandXml(xml: string): ImportResult {
  let root: OrderedNode[];
  try {
    root = parser.parse(xml) as OrderedNode[];
  } catch {
    throw AppError.badRequest('File is not valid XML');
  }

  const alignmentsNode = findFirst(root, 'Alignments');
  const alignmentNodes = alignmentsNode
    ? childrenOf(alignmentsNode).filter((c) => tagOf(c) === 'Alignment')
    : [];
  if (alignmentNodes.length === 0) {
    throw AppError.badRequest('No <Alignment> found in this LandXML file');
  }

  const alignments: ImportedAlignment[] = [];
  const warnings: string[] = [];
  for (const node of alignmentNodes) {
    try {
      alignments.push(parseAlignment(node));
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 400) {
        warnings.push(`Skipped ${err.message}`);
        continue;
      }
      throw err;
    }
  }

  if (alignments.length === 0) {
    throw AppError.badRequest(
      warnings[0] ?? 'No importable alignments (all contained unsupported geometry)',
    );
  }
  return { alignments, warnings };
}
