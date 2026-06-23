import { AlertCircle } from 'lucide-react';

/**
 * Consistent notice shown across subbie shell module screens when a request is
 * rejected because portal access changed mid-session (M53). Pairs with
 * useModuleAccessRevoked, which refreshes the my-company cache.
 */
export function ModuleAccessChangedNotice() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-warning"
    >
      <AlertCircle size={20} className="mt-px shrink-0" aria-hidden="true" />
      <p className="text-[14px] leading-relaxed">
        Your access to this section has changed — it may have been turned off for your company. Head
        back to home, or refresh to see the latest.
      </p>
    </div>
  );
}
