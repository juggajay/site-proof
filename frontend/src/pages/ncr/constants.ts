/**
 * Constants for NCR-related pages and components.
 * Extracted from NCRPage.tsx for reusability.
 */

// NCR status colour is owned by `lib/statusColors.ts` — the same map the lot
// NCRs tab and the mobile card read, so five lifecycle states stop rendering
// as the same grey.
export { getNcrStatusBadgeClass as getStatusBadgeColor } from '@/lib/statusColors';

// NCR category options for the create form, and root-cause options for the
// respond form. Wave G G5 (spec §5.2 gap 1) made these a server-enforced
// vocabulary, so the lists now live in `@/lib/ncrVocabulary` — the frontend
// mirror of `backend/src/lib/ncrVocabulary.ts`, with a pinned-equality drift
// test on each side. Re-exported here so the existing import sites keep working
// and there is exactly one list, not two that agree by luck.
export {
  NCR_CATEGORIES,
  NCR_ROOT_CAUSE_CATEGORIES as ROOT_CAUSE_CATEGORIES,
} from '@/lib/ncrVocabulary';
