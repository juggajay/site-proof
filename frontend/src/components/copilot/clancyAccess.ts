import { useAiStatus } from '@/hooks/useAiStatus';
import { useAuth } from '@/lib/auth';
import { getCompanyRole } from '@/lib/subcontractorIdentity';

// Clancy is an office copilot for the roles that own company setup — owner,
// admin, and project manager (owner decision 2026-07-16). Field roles (foreman,
// subbie) get the mobile shells instead; the chat route enforces the same set
// server-side.
export const CLANCY_ROLES = new Set(['owner', 'admin', 'project_manager']);

/**
 * Single source of truth for "should Clancy be reachable at all" — AI configured
 * on the server AND an office role. Shared by the header entry point and the
 * drawer/keyboard owner so the two never disagree.
 */
export function useClancyEnabled(): boolean {
  const { aiConfigured } = useAiStatus();
  const { user } = useAuth();
  return aiConfigured && CLANCY_ROLES.has(getCompanyRole(user));
}
