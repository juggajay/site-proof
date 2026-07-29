// Wave D `D1c.3` — the preflight screen (§4.5.4, §4.7.6).
//
// THE REFUSAL IS NOT AN ERROR. §4.7.6: "50 GB of evidence is ~6 archives, and
// the UI must present that as the normal shape of a large handover rather than
// as a failure." So both branches below open with the SAME sentence — "this
// scope will produce N archives" — and the refusal is styled as information
// with a next action, not as a red alert with a dead end.
//
// The server's own sentence and the unmeasured assumption are rendered VERBATIM.
// Both are written to be read by the person who has to choose a narrower scope
// (`lib/handover/exportPreflight.ts:127`, `:229`), and a second copy of that
// wording here is a second copy to drift.

import { Info } from 'lucide-react';

import {
  formatArchiveBytes,
  type HandoverExportPreflight,
  type HandoverExportRefusal,
} from '../handoverExportData';

function archiveCountSentence(count: number): string {
  return `This scope will produce ${count} ${count === 1 ? 'archive' : 'archives'}.`;
}

export function HandoverPreflightAccepted({
  preflight,
  lotCount,
}: {
  preflight: HandoverExportPreflight;
  lotCount: number;
}) {
  return (
    <section
      aria-label="Preflight estimate"
      className="rounded-lg border border-border bg-muted/40 p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">Archive requested</h3>
      <p className="mt-2 text-sm text-foreground">
        {archiveCountSentence(preflight.archivesImpliedAtCap)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Estimated size {formatArchiveBytes(preflight.estimatedInputBytes)} across{' '}
        {preflight.memberCount} files from {lotCount} lots.
      </p>
      {preflight.unmeasuredMemberCount > 0 && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {preflight.unmeasuredMemberCount} of {preflight.memberCount} files could not be
            measured.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{preflight.unmeasuredAssumption}</p>
        </>
      )}
    </section>
  );
}

export function HandoverPreflightRefusal({
  refusal,
  onNarrowToArea,
}: {
  refusal: HandoverExportRefusal;
  onNarrowToArea: () => void;
}) {
  return (
    <section
      aria-label="Scope needs more than one archive"
      className="rounded-lg border border-border bg-muted/40 p-4"
    >
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          {/* Null when the cheap member-count check refused before enumeration —
              it has a file count but no byte estimate to divide by the cap. */}
          {refusal.archivesImpliedAtCap !== null && (
            <h3 className="text-sm font-semibold text-foreground">
              {archiveCountSentence(refusal.archivesImpliedAtCap)}
            </h3>
          )}
          <p className="mt-2 text-sm text-foreground">{refusal.message}</p>
          {refusal.unmeasuredAssumption && (
            <p className="mt-2 text-xs text-muted-foreground">{refusal.unmeasuredAssumption}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing was created. Each archive you request is complete on its own, with its own
            manifest — there is no split file to reassemble.
          </p>
          <button
            type="button"
            onClick={onNarrowToArea}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Narrow to one area
          </button>
        </div>
      </div>
    </section>
  );
}
