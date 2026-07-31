/**
 * Wave C5-c — one survey record on the lot page, with its prior revisions.
 *
 * The whole file is arranged around keeping two judgements apart:
 *
 * - **CIVOS's** workflow state (`status`) gets the badge and the colour.
 * - **The surveyor's** stated verdict gets a neutral attributed quotation and
 *   no colour at all.
 *
 * If you are about to give {@link SurveyVerdictBlock} a `variant`, a `tone` or
 * a conditional `text-success`, stop: that is CIVOS publishing a conformance
 * finding it did not make and cannot support. See `lib/surveyRecords.ts`.
 */

import { useState } from 'react';
import { Check, ChevronDown, FileText, Link2, Ruler, AlertTriangle } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import {
  SURVEY_PROGRESS_STEPS,
  acceptBlockedReason,
  canAcceptSurvey,
  isQuotableVerdict,
  surveyKindLabel,
  surveyStatusLabel,
  surveyTranscribedBy,
  surveyVerdictLabel,
  type SurveyRecord,
  type SurveyRevisionGroup,
} from '../lib/surveyRecords';

function formatDate(value: string | null): string {
  if (!value) return 'date not recorded';
  return new Date(value).toLocaleDateString('en-AU', { dateStyle: 'medium' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

/** The surveyor line: who, for whom, under what registration. */
function surveyorLine(record: SurveyRecord): string {
  const parts = [
    record.surveyorName ?? 'Surveyor not recorded',
    record.surveyorCompany,
    record.surveyorRegistration,
  ].filter(Boolean);
  return parts.join(' · ');
}

/**
 * How each CIVOS workflow state is drawn — badge tone, icon tint and icon.
 *
 * ONE table, because the badge and the row icon must never disagree about what
 * state a record is in, and two parallel ternary chains are how they start to.
 * This is also the complete list of colour a survey row is allowed to use: the
 * surveyor's verdict is not in it, and must not be added to it.
 */
const STATUS_PRESENTATION: Readonly<
  Record<string, { badge: string; tint: string; Icon: typeof Check }>
> = {
  accepted: {
    badge: 'border-success/30 bg-success/10 text-success',
    tint: 'bg-success/10 text-success',
    Icon: Check,
  },
  rejected: {
    badge: 'border-destructive/30 bg-destructive/10 text-destructive',
    tint: 'bg-destructive/10 text-destructive',
    Icon: AlertTriangle,
  },
  received: {
    badge: 'border-warning/30 bg-warning/10 text-warning',
    tint: 'bg-warning/10 text-warning',
    Icon: AlertTriangle,
  },
};

const NEUTRAL_PRESENTATION = {
  badge: 'border-border bg-muted text-muted-foreground',
  tint: 'bg-secondary text-muted-foreground',
  Icon: Ruler,
};

function presentationFor(status: string) {
  return STATUS_PRESENTATION[status] ?? NEUTRAL_PRESENTATION;
}

/**
 * Status badge — CIVOS's own state, and the ONLY place a survey row is
 * coloured. `accepted` is green because CIVOS did accept the record; that green
 * says nothing about whether the lot conforms.
 */
function SurveyStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
        presentationFor(status).badge,
      )}
    >
      {surveyStatusLabel(status)}
    </span>
  );
}

/**
 * THE quotation block.
 *
 * A semantic `<figure>` + `<blockquote>` + `<figcaption>`, because that is
 * exactly what this is: someone else's words, with the source cited under them.
 * A screen reader announces it as a quotation for the same reason the border is
 * neutral — so it can never be mistaken for CIVOS's own finding.
 */
export function SurveyVerdictBlock({ record }: { record: SurveyRecord }) {
  const label = surveyVerdictLabel(record.surveyorVerdict);
  const transcribed = surveyTranscribedBy(record);

  return (
    <figure className="mt-3 border-l-2 border-border pl-3">
      <figcaption className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Surveyor-stated verdict
      </figcaption>

      {label === null ? (
        <p className="mt-1 text-sm italic text-muted-foreground">
          Not yet transcribed from the report.
        </p>
      ) : (
        <blockquote className="mt-1 text-sm text-foreground">
          {/* Quotation marks only around words the surveyor actually wrote.
              "The report states no verdict" is OUR sentence about their report,
              so quoting it would attribute to them a thing they never said. */}
          <span className="font-semibold">
            {isQuotableVerdict(record.surveyorVerdict) ? `“${label}”` : label}
          </span>
          {record.verdictSourceNote ? (
            <span className="text-muted-foreground"> — {record.verdictSourceNote}</span>
          ) : null}
        </blockquote>
      )}

      <figcaption className="mt-1.5 text-xs text-muted-foreground">
        Stated by {surveyorLine(record)}
        {record.reportDocument ? (
          <>
            {' on '}
            <span className="font-mono">{record.reportDocument.filename}</span>
          </>
        ) : (
          ' — no report file attached'
        )}
        {'. Transcribed into CIVOS by '}
        <span className="font-medium text-foreground">{transcribed.name ?? 'an unnamed user'}</span>
        {`, ${formatDateTime(transcribed.at)}.`}
      </figcaption>
    </figure>
  );
}

/**
 * The four workflow steps as an ordered list, not a generic stepper component.
 *
 * An `<ol>` is what this is — a fixed sequence with a position in it — and it
 * reads correctly with CSS off and in a screen reader without a single ARIA
 * attribute. `aria-current="step"` marks where the record sits. A new shared
 * `<Stepper>` abstraction for the one place in the app that needs one would be
 * a component to maintain forever in exchange for nothing.
 */
export function SurveyStatusProgress({ status }: { status: string }) {
  const currentIndex = (SURVEY_PROGRESS_STEPS as readonly string[]).indexOf(status);

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {SURVEY_PROGRESS_STEPS.map((step, index) => {
        const done = currentIndex > index;
        const here = currentIndex === index;
        return (
          <li
            key={step}
            aria-current={here ? 'step' : undefined}
            className="flex items-center gap-1.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                done ? 'bg-success' : here ? 'bg-warning ring-4 ring-warning/20' : 'bg-border',
              )}
            />
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider',
                here ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {surveyStatusLabel(step)}
            </span>
            {index < SURVEY_PROGRESS_STEPS.length - 1 && (
              <span aria-hidden="true" className="ml-1 h-px w-6 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface SurveyRecordRowProps {
  group: SurveyRevisionGroup;
  canDecide: boolean;
  deciding: boolean;
  onDecide: (surveyId: string, status: 'accepted' | 'rejected') => void;
}

export function SurveyRecordRow({ group, canDecide, deciding, onDecide }: SurveyRecordRowProps) {
  const [showEarlier, setShowEarlier] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const record = group.current;

  const blockedReason = acceptBlockedReason(record);
  const acceptable = canAcceptSurvey(record);
  const showDecision = canDecide && record.status === 'received';
  const verdictLabel = surveyVerdictLabel(record.surveyorVerdict);
  const { tint, Icon } = presentationFor(record.status);

  return (
    <li className="border-t border-border p-4">
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tint)}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {surveyKindLabel(record.kind)} survey
            </h4>
            <SurveyStatusBadge status={record.status} />
            {/* Gate: the CURRENT record says so out loud. Without it, a reader
                looking at a lot with three revisions has to infer which one is
                live from the absence of a "superseded" chip. */}
            {group.earlier.length > 0 && (
              <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Current
              </span>
            )}
          </div>

          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Surveyed {formatDate(record.surveyedAt)} · {surveyorLine(record)}
          </p>

          <SurveyVerdictBlock record={record} />

          {record.status === 'rejected' && record.rejectionReason && (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Rejected by CIVOS:</span>{' '}
              {record.rejectionReason}
            </p>
          )}

          {record.reportDocument && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-mono">{record.reportDocument.filename}</span>
            </p>
          )}

          {/* Progress + decision, in one control. Rejected records show no
              stepper: rejection is a branch off `received`, not a fifth step. */}
          {record.status !== 'rejected' && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <SurveyStatusProgress status={record.status} />
              {showDecision && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onDecide(record.id, 'rejected')}
                    disabled={deciding}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAccept(true)}
                    disabled={deciding || !acceptable}
                    title={blockedReason ?? undefined}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Accept evidence record
                  </button>
                </div>
              )}
            </div>
          )}

          {showDecision && blockedReason && (
            <p className="mt-2 text-xs text-muted-foreground">{blockedReason}</p>
          )}

          {group.earlier.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowEarlier((open) => !open)}
                aria-expanded={showEarlier}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn('h-3.5 w-3.5 transition-transform', showEarlier && 'rotate-180')}
                />
                {group.earlier.length === 1
                  ? '1 earlier record'
                  : `${group.earlier.length} earlier records`}
              </button>

              {showEarlier && (
                <ul className="mt-2 space-y-2">
                  {group.earlier.map((earlier) => (
                    <EarlierRevision
                      key={earlier.id}
                      record={earlier}
                      replacedByLabel={`${surveyKindLabel(record.kind)} survey of ${formatDate(record.surveyedAt)}`}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* The confirmation repeats the three facts the acceptor is standing
          behind, and says in plain words what accepting does and does not
          mean. `[C5S-B1]` is only true if the person clicking believes it. */}
      <ConfirmDialog
        open={confirmAccept}
        title="Accept this evidence record?"
        confirmLabel="Accept evidence record"
        onCancel={() => setConfirmAccept(false)}
        onConfirm={() => {
          setConfirmAccept(false);
          onDecide(record.id, 'accepted');
        }}
        description={
          <>
            <p>
              <span className="font-medium text-foreground">{surveyorLine(record)}</span> stated on{' '}
              <span className="font-mono text-foreground">
                {record.reportDocument?.filename ?? 'a report with no file attached'}
              </span>
              :
            </p>
            <p className="border-l-2 border-border pl-3 text-foreground">
              {isQuotableVerdict(record.surveyorVerdict) ? `“${verdictLabel}”` : verdictLabel}
            </p>
            <p>
              Accepting files this as evidence on the lot. CIVOS is recording the surveyor&rsquo;s
              conclusion, not independently verifying it — it holds no levels, deviations or
              tolerances for this lot and makes no conformance finding of its own.
            </p>
            <p>Your name and the time are recorded against the acceptance.</p>
          </>
        }
      />
    </li>
  );
}

/**
 * A superseded revision. Muted, never removed.
 *
 * The copy is deliberate: this row is the record of what was true on the day it
 * was surveyed, and a quality system that can make a bad result disappear is
 * not a quality system. It keeps its verdict block for the same reason.
 */
function EarlierRevision({
  record,
  replacedByLabel,
}: {
  record: SurveyRecord;
  replacedByLabel: string;
}) {
  return (
    <li className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {surveyKindLabel(record.kind)} survey · {formatDate(record.surveyedAt)}
        </span>
        <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {surveyStatusLabel('superseded')}
        </span>
      </div>

      <SurveyVerdictBlock record={record} />

      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Link2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Superseded by the <span className="text-foreground">{replacedByLabel}</span>
          {record.supersessionReason ? (
            <>
              {' — '}
              <span className="font-medium text-foreground">reason:</span>{' '}
              {record.supersessionReason}
            </>
          ) : (
            // Silence about the reason is stated, not styled over. Records
            // superseded before C5-c added the column have none and never will.
            ' — no reason was recorded.'
          )}
        </span>
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Kept, never edited, never deleted — it is the record of what was true on{' '}
        {formatDate(record.surveyedAt)}.
      </p>
    </li>
  );
}
