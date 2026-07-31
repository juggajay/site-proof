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
 * The four states a card body can be in, written once for both cards.
 *
 * The empty branch is the one with an opinion: an empty card is NOT collapsed
 * away. A lot with no survey records and a lot whose survey section is hidden
 * look identical to a reader, and only one of them is a gap somebody should
 * close — so the card stays and says which.
 */
function AsyncSectionBody({
  isLoading,
  hasError,
  onRetry,
  loadingLabel,
  errorLabel,
  emptyMessage,
  isEmpty,
  children,
}: {
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  loadingLabel: string;
  errorLabel: string;
  emptyMessage: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {loadingLabel}
      </p>
    );
  }

  if (hasError) {
    return (
      <div className="border-t border-border px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">{errorLabel}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="border-t border-border px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
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
          <AsyncSectionBody
            isLoading={surveysQuery.isLoading}
            hasError={Boolean(surveysQuery.error)}
            onRetry={() => void surveysQuery.refetch()}
            loadingLabel="Loading survey records…"
            errorLabel="Could not load survey records."
            emptyMessage="No survey records filed against this lot."
            isEmpty={groups.length === 0}
          >
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
          </AsyncSectionBody>
        </SectionCard>
      )}

      <SectionCard
        icon={<Truck className="h-5 w-5" />}
        title="Deliveries linked to this lot"
        blurb="Recorded in the daily diary — what went into this lot, and the docket that proves it."
      >
        <AsyncSectionBody
          isLoading={deliveriesQuery.isLoading}
          hasError={Boolean(deliveriesQuery.error)}
          onRetry={() => void deliveriesQuery.refetch()}
          loadingLabel="Loading deliveries…"
          errorLabel="Could not load deliveries."
          emptyMessage="No deliveries linked to this lot. Deliveries are recorded in the daily diary and linked to a lot from there."
          isEmpty={deliveries.length === 0}
        >
          <LotDeliveriesTable deliveries={deliveries} />
        </AsyncSectionBody>
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
