/**
 * Wave C5-c — "Survey & materials" on the lot page.
 *
 * One section, no new page and no new nav entry: it sits below Quality
 * Management and above the Evidence Folio, because it answers the question
 * between them — *what does anyone outside this company say about this lot,
 * and what physically went into it.*
 *
 * Survey records are behind `C5_SURVEY_RECORDS_ENABLED` server-side. When that
 * flag is off the route 404s and the surveys card is not rendered at all; the
 * deliveries card is unflagged (C5.1 shipped unflagged) and stands alone.
 */

import { Ruler, Truck } from 'lucide-react';

import { ApiError } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { logError } from '@/lib/logger';
import { LotDeliveriesTable } from './LotDeliveriesTable';
import { SurveyRecordRow } from './SurveyRecordRow';
import {
  useLotDeliveries,
  useLotSurveys,
  useSurveyStatusChange,
} from '../hooks/useLotSurveyMaterials';
import {
  SURVEY_ACCEPTOR_ROLES,
  countOutstandingSurveys,
  groupSurveyRevisions,
} from '../lib/surveyRecords';

interface SurveyMaterialsSectionProps {
  lotId: string;
  /** The SERVER-derived effective project role, never `user.role`. */
  effectiveRole: string;
}

function SectionCard({
  icon,
  title,
  blurb,
  actions,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <span aria-hidden="true" className="mt-0.5 text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{blurb}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * An empty card is NOT collapsed away.
 *
 * A lot with no survey records and a lot whose survey section is hidden look
 * identical to a reader, and only one of them is a gap somebody should close.
 * The empty state says which, and offers the action that closes it.
 */
function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="border-t border-border px-4 py-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function SurveyMaterialsSection({ lotId, effectiveRole }: SurveyMaterialsSectionProps) {
  const surveysQuery = useLotSurveys(lotId);
  const deliveriesQuery = useLotDeliveries(lotId);
  const decide = useSurveyStatusChange(lotId);

  const canDecide = SURVEY_ACCEPTOR_ROLES.includes(effectiveRole);

  // A 404 is the feature flag being off for this tenant, not a failure.
  const surveysDisabled =
    surveysQuery.error instanceof ApiError && surveysQuery.error.status === 404;

  const groups = groupSurveyRevisions(surveysQuery.data?.surveys ?? []);
  const outstanding = countOutstandingSurveys(groups);
  const deliveries = deliveriesQuery.data?.deliveries ?? [];

  const handleDecide = (surveyId: string, status: 'accepted' | 'rejected') => {
    decide.mutate(
      { surveyId, status },
      {
        onSuccess: () => {
          toast({
            title: status === 'accepted' ? 'Evidence record accepted' : 'Evidence record rejected',
            description:
              status === 'accepted'
                ? "The surveyor's report is now filed as evidence on this lot."
                : 'The record stays on the lot and is not counted as evidence.',
          });
        },
        onError: (error: unknown) => {
          logError('Error changing survey status:', error);
          toast({
            title: 'Could not update this survey record',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'error',
          });
        },
      },
    );
  };

  if (!effectiveRole) return null;

  return (
    <div className="mt-6 space-y-4">
      {!surveysDisabled && (
        <SectionCard
          icon={<Ruler className="h-5 w-5" />}
          title="Survey records"
          blurb="Set-out, conformance and as-built — who surveyed it, what they stated, and who accepted the record."
          actions={
            outstanding > 0 ? (
              <span className="inline-flex items-center rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                {outstanding === 1 ? '1 outstanding' : `${outstanding} outstanding`}
              </span>
            ) : null
          }
        >
          {surveysQuery.isLoading ? (
            <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Loading survey records…
            </p>
          ) : surveysQuery.error ? (
            <div className="border-t border-border px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Could not load survey records.</p>
              <button
                type="button"
                onClick={() => void surveysQuery.refetch()}
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : groups.length === 0 ? (
            // Stated, not collapsed. "No survey records filed" and "the survey
            // section is hidden" look identical to a reader, and only one of
            // them is a gap somebody should close.
            <EmptyState message="No survey records filed against this lot." />
          ) : (
            <ul>
              {groups.map((group) => (
                <SurveyRecordRow
                  key={group.current.id}
                  group={group}
                  canDecide={canDecide}
                  deciding={decide.isLoading}
                  onDecide={handleDecide}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      <SectionCard
        icon={<Truck className="h-5 w-5" />}
        title="Deliveries linked to this lot"
        blurb="Recorded in the daily diary — what went into this lot, and the docket that proves it."
      >
        {deliveriesQuery.isLoading ? (
          <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Loading deliveries…
          </p>
        ) : deliveriesQuery.error ? (
          <div className="border-t border-border px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">Could not load deliveries.</p>
            <button
              type="button"
              onClick={() => void deliveriesQuery.refetch()}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        ) : deliveries.length === 0 ? (
          <EmptyState message="No deliveries linked to this lot. Deliveries are recorded in the daily diary and linked to a lot from there." />
        ) : (
          <LotDeliveriesTable deliveries={deliveries} />
        )}
      </SectionCard>

      {/*
        What these records reach, stated exactly.

        Verified against the shipped code, not the mockup, which got both halves
        wrong. The folio takes surveys AND deliveries for the lot
        (`backend/src/routes/folio/assemble.ts` — `surveyRecord.findMany` and
        `diaryDelivery.findMany`, both `supersededById: null` / lot-scoped, not
        filtered to accepted). The hold-point evidence package takes surveys
        only, and says so in its own header:
        `backend/src/routes/holdpoints/surveyEvidence.ts` — "DELIVERIES ARE NOT
        HERE, and that is `[C5S-e]`, not an omission".
      */}
      <p className="text-xs text-muted-foreground">
        Surveys and deliveries enter the lot folio; only surveys enter the hold-point evidence
        package. A survey record that has not been accepted raises a warning on this lot — it never
        blocks a conform.
      </p>
    </div>
  );
}
