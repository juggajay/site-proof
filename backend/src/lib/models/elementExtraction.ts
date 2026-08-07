import path from 'node:path';
import { createRequire } from 'node:module';

import { IFCRELDEFINESBYPROPERTIES, IfcAPI } from 'web-ifc';

export interface ExtractedElement {
  ifcGuid: string;
  name: string | null;
  category: string | null;
  lotNumberValue: string | null;
  objectCode: string | null;
}

export interface ElementExtractionResult {
  elements: ExtractedElement[];
  skippedMissingGuid: number;
  skippedDuplicateGuid: number;
}

interface ElementCandidate extends ExtractedElement {
  expressId: number;
}

function handleId(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as { value?: unknown }).value;
  return typeof id === 'number' ? id : null;
}

function wrappedValue(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('value' in value)) return value;
  return (value as { value: unknown }).value;
}

function optionalString(value: unknown): string | null {
  const unwrapped = wrappedValue(value);
  return typeof unwrapped === 'string' ? unwrapped : null;
}

function propertyValue(value: unknown): string | null {
  let unwrapped = wrappedValue(value);
  unwrapped = wrappedValue(unwrapped);
  if (unwrapped === null || unwrapped === undefined) return null;
  if (typeof unwrapped === 'string') return unwrapped;
  if (typeof unwrapped === 'number' || typeof unwrapped === 'boolean') return String(unwrapped);
  return null;
}

/**
 * Build the lightweight element index directly from the source IFC. The walk
 * starts at IfcRelDefinesByProperties so only products carrying property sets
 * are indexed, which is the population the lot linker can act on.
 */
export async function extractElements(source: Buffer): Promise<ElementExtractionResult> {
  const require = createRequire(import.meta.url);
  const wasmDir = `${path.dirname(require.resolve('web-ifc')).replaceAll('\\', '/')}/`;
  const api = new IfcAPI();
  let modelId: number | null = null;

  try {
    api.SetWasmPath(wasmDir, true);
    await api.Init();
    modelId = api.OpenModel(new Uint8Array(source), {});

    const byExpressId = new Map<number, ElementCandidate>();
    const relationIds = api.GetLineIDsWithType(modelId, IFCRELDEFINESBYPROPERTIES);
    for (let relationIndex = 0; relationIndex < relationIds.size(); relationIndex += 1) {
      const relation = api.GetLine(modelId, relationIds.get(relationIndex)) as {
        RelatedObjects?: unknown[];
        RelatingPropertyDefinition?: unknown;
      };
      const psetId = handleId(relation.RelatingPropertyDefinition);
      const pset =
        psetId === null
          ? null
          : (api.GetLine(modelId, psetId, true) as {
              HasProperties?: Array<{ Name?: unknown; NominalValue?: unknown }>;
            });

      for (const relatedObject of relation.RelatedObjects ?? []) {
        const expressId = handleId(relatedObject);
        if (expressId === null) continue;

        let candidate = byExpressId.get(expressId);
        if (!candidate) {
          const product = api.GetLine(modelId, expressId) as {
            GlobalId?: unknown;
            Name?: unknown;
          };
          candidate = {
            expressId,
            ifcGuid: optionalString(product.GlobalId) ?? '',
            name: optionalString(product.Name),
            category: api.GetNameFromTypeCode(api.GetLineType(modelId, expressId)) ?? null,
            lotNumberValue: null,
            objectCode: null,
          };
          byExpressId.set(expressId, candidate);
        }

        for (const property of pset?.HasProperties ?? []) {
          const name = optionalString(property.Name);
          if (name === 'ConstructionLotNumber' && candidate.lotNumberValue === null) {
            candidate.lotNumberValue = propertyValue(property.NominalValue);
          } else if (name === 'UniqueObjectCode' && candidate.objectCode === null) {
            candidate.objectCode = propertyValue(property.NominalValue);
          }
        }
      }
    }

    const elements: ExtractedElement[] = [];
    const seenGuids = new Set<string>();
    let skippedMissingGuid = 0;
    let skippedDuplicateGuid = 0;
    for (const { expressId: _expressId, ...candidate } of byExpressId.values()) {
      if (!candidate.ifcGuid) {
        skippedMissingGuid += 1;
        continue;
      }
      if (seenGuids.has(candidate.ifcGuid)) {
        skippedDuplicateGuid += 1;
        continue;
      }
      seenGuids.add(candidate.ifcGuid);
      elements.push(candidate);
    }

    return { elements, skippedMissingGuid, skippedDuplicateGuid };
  } finally {
    if (modelId !== null) api.CloseModel(modelId);
  }
}
