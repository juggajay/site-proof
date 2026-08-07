import { createHash } from 'node:crypto';

export const IFC_GUID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
export const NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export const CIVOS_IFC_NAMESPACE = 'cbac43a1-b292-5a17-90bc-d5771c28906d';

function uuidBytes(uuid: string): Uint8Array {
  const compact = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(compact)) throw new Error(`invalid UUID: ${uuid}`);
  return Uint8Array.from(compact.match(/../g)!.map((pair) => Number.parseInt(pair, 16)));
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** RFC 4122 UUIDv5, exported so the namespace's published derivation stays testable. */
export function uuidv5(namespace: string, key: string): string {
  const hash = createHash('sha1');
  hash.update(uuidBytes(namespace));
  hash.update(Buffer.from(key, 'utf8'));
  const bytes = Uint8Array.from(hash.digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}

function encodeChunk(input: number, width: number): string {
  let value = input;
  let output = '';
  for (let index = 0; index < width; index += 1) {
    output = IFC_GUID_ALPHABET[value % 64] + output;
    value = Math.floor(value / 64);
  }
  return output;
}

/** Deterministic 22-character IFC GlobalId under the permanent CIVOS namespace. */
export function ifcGuid(identityKey: string): string {
  const bytes = uuidBytes(uuidv5(CIVOS_IFC_NAMESPACE, identityKey));
  let output = encodeChunk(bytes[0], 2);
  for (let index = 1; index < 16; index += 3) {
    output += encodeChunk(bytes[index] * 65_536 + bytes[index + 1] * 256 + bytes[index + 2], 4);
  }
  return output;
}
