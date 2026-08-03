/**
 * Wave C5-c — the lot page's survey + delivery reads and the survey writes the
 * lot card offers: file a record, correct one, attach its report, move it along
 * the workflow, and supersede it with the corrected revision.
 *
 * Every route here is an already-shipped C5.2 route; this adds no endpoint.
 * Surveys are fetched with `includeSuperseded=true` because the section groups
 * prior revisions under the record that replaced them — the default read
 * returns only the current revision, which is the right default for the folio
 * and the wrong one for a page whose job is to show the history.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { LotDelivery, SurveyDraft, SurveyPatch, SurveyRecord } from '../lib/surveyRecords';

interface LotSurveysResponse {
  surveys: SurveyRecord[];
}

interface LotDeliveriesResponse {
  deliveries: LotDelivery[];
}

/** A document the report can be attached from — the shipped upload path's rows. */
export interface SurveyReportDocument {
  id: string;
  filename: string;
}

/**
 * The project's documents, for the editor's report picker.
 *
 * `[C5R-A6]`: the report is ATTACHED, never uploaded here. C5 adds no upload
 * route, so the file reaches CIVOS through the shipped document path (which
 * already runs magic-byte validation) and this picker links the row.
 */
export function useProjectDocuments(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.documents(projectId ?? ''), 'survey-report-picker'] as const,
    queryFn: () =>
      apiFetch<{ documents?: SurveyReportDocument[] }>(
        `/api/documents/${encodeURIComponent(projectId!)}?limit=100`,
      ),
    enabled: Boolean(projectId) && enabled,
  });
}

/**
 * The one invalidation every survey write owes.
 *
 * Lot readiness is in it because `survey_not_received` is a readiness warning:
 * filing a record, moving it to received and superseding one all change the
 * outstanding count, so the panel above must re-read rather than keep a stale
 * one.
 */
function useSurveyInvalidation(lotId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries(queryKeys.lotSurveys(lotId ?? ''));
    void queryClient.invalidateQueries(queryKeys.lotReadiness(lotId ?? ''));
  };
}

/**
 * Survey records are behind `C5_SURVEY_RECORDS_ENABLED` and the route 404s when
 * it is off (`requireSurveyFlag`). A 404 here means "this tenant has no survey
 * feature", not "something broke", so the caller renders nothing rather than an
 * error — which is why the query does not retry a 404 into a red banner.
 */
export function useLotSurveys(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lotSurveys(lotId ?? ''),
    queryFn: () =>
      apiFetch<LotSurveysResponse>(
        `/api/lots/${encodeURIComponent(lotId!)}/surveys?includeSuperseded=true`,
      ),
    enabled: Boolean(lotId),
    retry: false,
  });
}

export function useLotDeliveries(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lotDeliveries(lotId ?? ''),
    queryFn: () =>
      apiFetch<LotDeliveriesResponse>(`/api/lots/${encodeURIComponent(lotId!)}/deliveries`),
    enabled: Boolean(lotId),
  });
}

/**
 * File a survey record against this lot.
 *
 * `project_id` is derived from the lot by the route and is deliberately not in
 * the body `[C5R-A4]`, so the create call carries no project at all.
 */
export function useSurveyCreate(lotId: string | undefined) {
  const onSuccess = useSurveyInvalidation(lotId);

  return useMutation({
    mutationFn: (draft: SurveyDraft) =>
      apiFetch<SurveyRecord>(`/api/lots/${encodeURIComponent(lotId!)}/surveys`, {
        method: 'POST',
        body: JSON.stringify(draft),
      }),
    onSuccess,
  });
}

/**
 * Correct the attribution, verdict or notes on a record.
 *
 * PATCH takes neither `kind` nor `status` nor the report link — they move by
 * their own routes, or not at all — so the editor sends a {@link SurveyPatch}.
 */
export function useSurveyEdit(lotId: string | undefined) {
  const onSuccess = useSurveyInvalidation(lotId);

  return useMutation({
    mutationFn: ({ surveyId, patch }: { surveyId: string; patch: SurveyPatch }) =>
      apiFetch<SurveyRecord>(`/api/surveys/${encodeURIComponent(surveyId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess,
  });
}

/** Link an already-uploaded document as this record's report `[C5R-A6]`. */
export function useSurveyReportAttach(lotId: string | undefined) {
  const onSuccess = useSurveyInvalidation(lotId);

  return useMutation({
    mutationFn: ({ surveyId, documentId }: { surveyId: string; documentId: string }) =>
      apiFetch<SurveyRecord>(`/api/surveys/${encodeURIComponent(surveyId)}/report`, {
        method: 'POST',
        body: JSON.stringify({ documentId }),
      }),
    onSuccess,
  });
}

/**
 * Move a record along CIVOS's own workflow.
 *
 * Two callers and exactly two edges, because the transition map has exactly two:
 * `requested → received` (the report arrived) and `received →
 * returned_for_correction` (it arrived and it is defective). There is no accept
 * edge because there is no accept act — acceptance in AU civil is the hold-point
 * release and the lot conformance
 * (`docs/research/c5-surveyor-workflow-practice-2026-07-31.md` §4).
 */
export function useSurveyStatus(lotId: string | undefined) {
  const onSuccess = useSurveyInvalidation(lotId);

  return useMutation({
    mutationFn: ({
      surveyId,
      status,
      returnReason,
    }: {
      surveyId: string;
      status: string;
      returnReason?: string;
    }) =>
      apiFetch<SurveyRecord>(`/api/surveys/${encodeURIComponent(surveyId)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, returnReason }),
      }),
    onSuccess,
  });
}

/**
 * Point a record at the record that replaced it.
 *
 * Called on the OLD record with the NEW record's id — the direction the route
 * takes (`POST /api/surveys/:oldId/supersede { supersededById: newId }`), and
 * the one that is easy to get backwards. The new record must already exist, be
 * on the same lot and be of the same kind: `(lot_id, kind)` is the record's
 * identity, since a survey record has no number of its own `[C5R-A3]`.
 */
export function useSurveySupersede(lotId: string | undefined) {
  const onSuccess = useSurveyInvalidation(lotId);

  return useMutation({
    mutationFn: ({
      surveyId,
      supersededById,
      reason,
    }: {
      surveyId: string;
      supersededById: string;
      reason: string | null;
    }) =>
      apiFetch<SurveyRecord>(`/api/surveys/${encodeURIComponent(surveyId)}/supersede`, {
        method: 'POST',
        body: JSON.stringify({ supersededById, reason }),
      }),
    onSuccess,
  });
}
