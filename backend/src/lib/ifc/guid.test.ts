import { describe, expect, it } from 'vitest';

import { CIVOS_IFC_NAMESPACE, IFC_GUID_ALPHABET, NAMESPACE_DNS, ifcGuid, uuidv5 } from './guid.js';

describe('IFC deterministic GUIDs', () => {
  it('reproduces the published CIVOS namespace from DNS UUIDv5', () => {
    expect(uuidv5(NAMESPACE_DNS, 'ifc.civos.com.au')).toBe(CIVOS_IFC_NAMESPACE);
  });

  it('is deterministic, valid IFC base-64, and separates identity keys', () => {
    const first = ifcGuid('product:lot-42');
    expect(ifcGuid('product:lot-42')).toBe(first);
    expect(first).toHaveLength(22);
    expect(Array.from(first).every((character) => IFC_GUID_ALPHABET.includes(character))).toBe(
      true,
    );
    expect(first[0]).toMatch(/[0-3]/);
    expect(ifcGuid('product:lot-43')).not.toBe(first);
  });
});
