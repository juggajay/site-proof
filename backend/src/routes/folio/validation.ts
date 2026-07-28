// Wave D `D1b` — folio route body validation
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §14 AT-124;
// threat model T-8, which is where this departure is authorised).
// **AT-124**, **AT-143**.
//
// THE DEPARTURE, STATED ONCE. There are ZERO `.strict(` and zero
// `z.strictObject` schemas in `backend/src` against 100 `z.object(` under
// `backend/src/routes` — the repo has exactly one convention, and Zod's default
// for `z.object()` is to STRIP unknown keys silently and return 2xx.
//
// AT-124 requires a client-supplied `sha256` or `compiledFrom` to be "rejected
// outright, not merely ignored", and the distinction is the whole point: a
// stripped field returns 201 and tells the caller the field was ACCEPTED. The
// next thing built on that observation is wrong, and nothing in the system
// disagrees until somebody reads the source.
//
// So folio route schemas are STRICT. Scoped to folio routes only: turning on
// strict validation across 100 shipped schemas inside a security-gate PR would
// be a large behavioural change with no coverage for the new rejections. The 99
// others are a recorded pre-existing condition (threat model §8), not softened.
//
// AND NO FOLIO ROUTE HAS A BYTE CHANNEL. No binary field, no base64 field, and
// no folio route mounts multer (**AT-143**). `express.json({ limit: '1mb' })`
// at `server.ts:109` caps any JSON body globally, so a route that adds neither
// has no byte channel by construction — which is the `[DH-i]` property, held
// structurally rather than by inspecting bytes.

import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';

/**
 * Fields the SERVER owns absolutely. Named individually so the 400 says which
 * one was refused and why — a generic `unrecognized_keys` is a correct
 * rejection and a poor one; the message is the thing that stops the next
 * person trying.
 */
const SERVER_OWNED_FIELDS: Readonly<Record<string, string>> = Object.freeze({
  sha256: 'the server computes sha256 over the bytes it produced; it is not accepted from a client',
  compiledFrom:
    'the server derives compiledFrom from its own snapshot; it is not accepted from a client',
  fileUrl: 'the server chooses the storage path; it is not accepted from a client',
  fileSize: 'the server measures the bytes it produced; it is not accepted from a client',
  version: 'the server reserves the folio version; it is not accepted from a client',
  format: 'a folio has exactly one format; it is not accepted from a client',
  // Named so the "just for attachments" line is a 400 rather than a review miss.
  pdf: 'no folio route accepts document bytes',
  bytes: 'no folio route accepts document bytes',
  file: 'no folio route accepts document bytes',
  content: 'no folio route accepts document bytes',
});

/**
 * Both folio POST routes take an EMPTY body: the server assembles everything.
 * Strict, so any key at all is a 400.
 */
export const folioSessionSchema = z.object({}).strict();
export const folioIssueSchema = z.object({}).strict();

/**
 * Parse a folio body, converting a server-owned key into a NAMED 400.
 *
 * Order matters: the named check runs first, so `{ sha256: "deadbeef" }`
 * returns the specific message rather than a bare "Unrecognized key(s)".
 */
export function parseFolioBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const key of Object.keys(body as Record<string, unknown>)) {
      const reason = SERVER_OWNED_FIELDS[key];
      if (reason) {
        throw new AppError(
          400,
          `\`${key}\` is not accepted on a folio route: ${reason}`,
          'FOLIO_SERVER_OWNED_FIELD',
          { field: key },
        );
      }
    }
  }

  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw AppError.fromZodError(result.error);
  }
  return result.data as z.infer<T>;
}

export { SERVER_OWNED_FIELDS };
