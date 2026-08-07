export interface LinkableModelElement {
  id: string;
  ifcGuid: string;
  lotNumberValue: string | null;
}

export interface LinkableLot {
  id: string;
  lotNumber: string;
}

export interface AutoLinkedElement extends LinkableModelElement {
  lotId: string;
}

export interface AmbiguousModelElement extends LinkableModelElement {
  candidateLotIds: string[];
}

export interface AutoLinkBuckets {
  linked: AutoLinkedElement[];
  ambiguous: AmbiguousModelElement[];
  unlinked: LinkableModelElement[];
}

function normalizeLotNumber(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/** V1 linker: ConstructionLotNumber only; UniqueObjectCode is intentionally ignored. */
export function computeAutoLinks(
  elements: readonly LinkableModelElement[],
  lots: readonly LinkableLot[],
): AutoLinkBuckets {
  const lotsByNumber = new Map<string, string[]>();
  for (const lot of lots) {
    const normalized = normalizeLotNumber(lot.lotNumber);
    if (!normalized) continue;
    const bucket = lotsByNumber.get(normalized) ?? [];
    bucket.push(lot.id);
    lotsByNumber.set(normalized, bucket);
  }

  const result: AutoLinkBuckets = { linked: [], ambiguous: [], unlinked: [] };
  for (const element of elements) {
    const normalized = normalizeLotNumber(element.lotNumberValue);
    const candidates = normalized ? (lotsByNumber.get(normalized) ?? []) : [];
    if (candidates.length === 1) {
      result.linked.push({ ...element, lotId: candidates[0] });
    } else if (candidates.length > 1) {
      result.ambiguous.push({ ...element, candidateLotIds: [...candidates] });
    } else {
      result.unlinked.push({ ...element });
    }
  }
  return result;
}
