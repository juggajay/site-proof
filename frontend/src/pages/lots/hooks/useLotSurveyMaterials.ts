/**
 * Wave C5-c — the lot page's survey + delivery reads and the one write it
 * offers (accept / reject an evidence record).
 *
 * Both reads are already-shipped C5.1/C5.2 routes; this adds no endpoint.
 * Surveys are fetched with `includeSuperseded=true` because the section groups
 * prior revisions under the record that replaced them — the default read
 * returns only the current revision, which is the right default for the folio
 * and the wrong one for a page whose job is to show the history.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { LotDelivery, SurveyRecord } from '../lib/surveyRecords';

interface LotSurveysResponse {
  surveys: SurveyRecord[];
}

interface LotDeliveriesResponse {
  deliveries: LotDelivery[];
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
 * Move a survey record's CIVOS workflow state. Not the surveyor's verdict —
 * that is transcribed, never decided here, and this route cannot change it.
 *
 * Invalidates lot readiness too: `survey_not_accepted` is a readiness warning,
 * so accepting a record must clear it from the panel above without a reload.
 */
export function useSurveyStatusChange(lotId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      surveyId,
      status,
      rejectionReason,
    }: {
      surveyId: string;
      status: 'accepted' | 'rejected';
      rejectionReason?: string;
    }) =>
      apiFetch<SurveyRecord>(`/api/surveys/${encodeURIComponent(surveyId)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, ...(rejectionReason ? { rejectionReason } : {}) }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries(queryKeys.lotSurveys(lotId ?? ''));
      void queryClient.invalidateQueries(queryKeys.lotReadiness(lotId ?? ''));
    },
  });
}
