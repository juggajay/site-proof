/**
 * Pure mapping from ThatOpen's getItemsData shape (IsDefinedBy relations) to
 * the inspector panel's model. Separate from fragmentsViewer.ts so it unit
 * tests without importing the 3D stack.
 */

export interface PickedElementData {
  name: string | null;
  /** Property sets: pset name -> property name -> value. */
  psets: Record<string, Record<string, string | number | boolean | null>>;
}

type ItemAttribute = { value?: unknown } | null | undefined;
type ItemData = {
  Name?: ItemAttribute;
  IsDefinedBy?: {
    Name?: ItemAttribute;
    HasProperties?: { Name?: ItemAttribute; NominalValue?: ItemAttribute }[];
  }[];
};

function attributeValue(attribute: ItemAttribute): string | number | boolean | null {
  const value = attribute?.value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return null;
}

export function flattenPsets(data: unknown): PickedElementData {
  const item = (data ?? {}) as ItemData;
  const name = attributeValue(item.Name);
  const psets: PickedElementData['psets'] = {};
  for (const pset of item.IsDefinedBy ?? []) {
    const psetName = String(attributeValue(pset?.Name) ?? '?');
    const props: Record<string, string | number | boolean | null> = {};
    for (const property of pset?.HasProperties ?? []) {
      props[String(attributeValue(property?.Name) ?? '?')] = attributeValue(property?.NominalValue);
    }
    psets[psetName] = props;
  }
  return { name: typeof name === 'string' ? name : null, psets };
}
