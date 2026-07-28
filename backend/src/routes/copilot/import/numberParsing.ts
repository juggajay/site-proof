/**
 * Wave B — reading a NUMBER out of an imported register cell.
 *
 * Two readers, because a register writes two kinds of number. A quantity is a
 * plain number with separators. A chainage is written the way surveyors and
 * SiteProof itself write it — `CH 1+020`, not `1020`. The frontend PRINTS every
 * chainage in that stationing (`formatChainage`, `frontend/src/lib/utils.ts`),
 * so a register exported from SiteProof, marked up on site and handed back was
 * refused by SiteProof's own importer.
 *
 * Stationing is `km+metres` and the metres part is exactly three digits — that
 * is what makes `1+020` unambiguously 1020 and `1+20` ambiguous (120? 1020?).
 * Ambiguous input is REFUSED, never guessed at: a chainage silently off by
 * 900 m puts a lot on the wrong part of the job.
 */

/** A plain number with the thousands separators a register carries. */
export function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** `CH`, `Ch.`, `ch` — the printed prefix, optional and case-insensitive. */
const CHAINAGE_PREFIX = /^ch\.?\s*/i;

/** km + exactly three metres digits, plus optional decimal metres. */
const STATIONING = /^(\d+)\+(\d{3}(?:\.\d+)?)$/;

/**
 * A chainage cell as metres, or null when it cannot be read.
 *
 * Accepts `1020`, `1,020`, `1020.5`, `1+020`, `CH 1+020`, `ch1+020`,
 * `CH 1,020`. Refuses everything else — including stationing whose metres part
 * is not three digits.
 */
export function parseChainage(raw: string): number | null {
  const body = raw.trim().replace(/,/g, '').replace(CHAINAGE_PREFIX, '');
  if (!body) return null;

  const stationing = STATIONING.exec(body);
  if (stationing) return Number(stationing[1]) * 1_000 + Number(stationing[2]);

  // A `+` that survived the stationing test is malformed stationing, never a
  // JavaScript unary plus — `Number('+020')` would otherwise silently read 20.
  if (body.includes('+')) return null;

  return parseNumber(body);
}
