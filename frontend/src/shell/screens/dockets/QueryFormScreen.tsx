/**
 * QueryFormScreen — /m/dockets/:docketId/query
 *
 * Full-screen reason form for querying a docket (asking the subbie to clarify
 * before approval). Mirrors the DocketActionModal query path exactly: the query
 * sends { questions } and requires a non-empty reason (submit disabled until
 * then), via the shared useDocketAction → buildDocketActionPayload.
 *
 * Offline: querying hits the server like approval; when offline the submit
 * disables with an honest note (no offline queue path for docket actions today).
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #activity (form pattern).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useDocketsShellContext } from './docketsShellContext';
import { useShellDocketParam } from './useShellDocketParam';
import { useDocketAction } from './useDocketAction';
import { isReasonValid } from './docketsShellState';

export function QueryFormScreen() {
  const navigate = useNavigate();
  const { isOnline } = useOfflineStatus();
  const docketId = useShellDocketParam();
  const { projectId, dockets, refetch } = useDocketsShellContext();
  const { submitting, runAction } = useDocketAction(projectId);
  const [questions, setQuestions] = useState('');

  const docket = useMemo(() => dockets.find((d) => d.id === docketId) ?? null, [dockets, docketId]);

  const detailPath = projectId
    ? `/m/dockets/${docketId}?projectId=${projectId}`
    : `/m/dockets/${docketId}`;
  const listPath = projectId ? `/m/dockets?projectId=${projectId}` : '/m/dockets';

  const canSubmit = isReasonValid(questions) && isOnline && Boolean(docket);

  const handleSubmit = () => {
    if (!docket || !isReasonValid(questions)) return;
    void runAction({
      docketId: docket.id,
      actionType: 'query',
      actionNotes: questions,
    }).then((ok) => {
      if (ok) {
        void refetch();
        navigate(listPath);
      }
    });
  };

  return (
    <ShellScreen
      variant="inner"
      title="Query Docket"
      parent={detailPath}
      sub={
        <span className="text-muted-foreground">
          {docket
            ? `${docket.docketNumber} · ${docket.subcontractor}`
            : 'Ask the subbie to clarify'}
        </span>
      }
      bottom={
        <div className="shell-cambar flex flex-col gap-2">
          {!isOnline && (
            <p className="px-1 text-center text-[12.5px] font-semibold text-warning" role="status">
              Queries need signal — reconnect to send.
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={cn('shell-cambar-btn', (!canSubmit || submitting) && 'opacity-50')}
            aria-label="Send query"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              'Send Query'
            )}
          </button>
        </div>
      }
    >
      <div>
        <label
          htmlFor="docket-query"
          className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
        >
          What needs clarifying? *
        </label>
        <textarea
          id="docket-query"
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          placeholder="Ask what needs to be clarified before approval…"
          rows={5}
          autoCapitalize="sentences"
          autoComplete="off"
          spellCheck
          className="w-full min-h-[140px] resize-none rounded-xl border border-border bg-card px-3 py-3 text-[15px] leading-[1.5] text-foreground touch-manipulation focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        />
        <p className="mt-2 text-[13px] text-muted-foreground">
          The subbie gets your question and can re-submit. Nothing is approved yet.
        </p>
      </div>
    </ShellScreen>
  );
}
