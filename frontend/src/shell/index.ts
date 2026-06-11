/**
 * Shell v2 barrel — public exports for use in App.tsx and tests.
 *
 * Note: ShellRoutes is lazy-imported directly in App.tsx (not re-exported
 * here) to keep the lazy() boundary clean.
 */

export { ShellGuard } from './ShellGuard';
export {
  useShellV2Enabled,
  enableShellFlag,
  disableShellFlag,
  applyShellFlagFromUrl,
} from './shellFlag';
