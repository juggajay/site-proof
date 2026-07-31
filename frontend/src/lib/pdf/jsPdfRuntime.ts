import { DEFAULT_APP_TIME_ZONE } from '../localDate';

let jsPDFModule: typeof import('jspdf') | null = null;

export async function getJsPDF(): Promise<typeof import('jspdf').jsPDF> {
  if (!jsPDFModule) {
    jsPDFModule = await import('jspdf');
  }
  return jsPDFModule.jsPDF;
}

/**
 * jsPDF's constructor calls `setFileId()` and `setCreationDate()` with no
 * argument (`dist/jspdf.node.js:4113-4114`), so every document gets a randomly
 * generated trailer `/ID` (`:1399-1409` picks each character at random) and a
 * wall-clock `/CreationDate` (`:1489-1494`) before a single generator line
 * runs. Two renders of byte-identical input therefore differ every time, with
 * no clock involved. Both setters are public (`:1431`, `:1523`), so pinning
 * them is the whole fix — see `pinPdfIdentity`.
 */
type PdfIdentityTarget = {
  setFileId: (value: string) => unknown;
  setCreationDate: (date: string) => unknown;
};

/**
 * 32 UPPERCASE hex characters ("C1005D0C5" — CIVOS DOCS — repeated).
 * `setFileId` accepts only `/^[a-fA-F0-9]{32}$/` and uppercases what it stores
 * (`jspdf.node.js:1400-1402`); anything else falls through to the random branch
 * WITHOUT throwing, so the literal is written uppercase to keep input and
 * emitted trailer identical, and AT-G20 is what makes a typo fail loudly.
 */
export const PINNED_PDF_FILE_ID = 'C1005D0C5C1005D0C5C1005D0C5C1005';

function two(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Format an instant as a PDF date literal in the app's timezone, e.g.
 * `D:20260731143000+10'00'`.
 *
 * The string form is the point: `setCreationDate` stores a matching string
 * verbatim (`jspdf.node.js:1498-1499`, regex `:1491`) but runs
 * `convertDateToPDFDate` on a `Date` (`:1497`), and that formatter reads
 * `getTimezoneOffset()` and local `getHours()` (`:1454`, `:1462-1467`) — so a
 * `Date` would make one instant emit different bytes under `TZ=UTC` than under
 * `TZ=Australia/Sydney`, which is exactly what AT-G22 exists to catch.
 */
export function toPdfDateLiteral(instant: Date, timeZone: string = DEFAULT_APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((candidate) => candidate.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Could not format PDF creation date (missing ${type})`);
    }
    return Number(value);
  };

  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hour = part('hour');
  const minute = part('minute');
  const second = part('second');

  // The zone's offset for THIS instant (Sydney is +10 or +11 depending on DST),
  // read as the gap between the zone's wall clock and UTC's.
  const offsetMinutes = Math.round(
    (Date.UTC(year, month - 1, day, hour, minute, second) -
      Math.floor(instant.getTime() / 1000) * 1000) /
      60000,
  );
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);

  return `D:${year}${two(month)}${two(day)}${two(hour)}${two(minute)}${two(second)}${sign}${two(
    Math.floor(absolute / 60),
  )}'${two(absolute % 60)}'`;
}

/**
 * Pin the two identity fields jsPDF randomises/clocks at construction. Call it
 * on the line after `new jsPDF()`; without it every byte-regression assertion
 * is red on every run, on `/ID` alone.
 */
export function pinPdfIdentity(doc: PdfIdentityTarget, pinnedInstant: Date): void {
  doc.setFileId(PINNED_PDF_FILE_ID);
  doc.setCreationDate(toPdfDateLiteral(pinnedInstant));
}
