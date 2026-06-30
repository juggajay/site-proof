/**
 * Shell v2 barrel — public exports for use in App.tsx and tests.
 *
 * Note: ShellRoutes is lazy-imported directly in App.tsx (not re-exported
 * here) to keep the lazy() boundary clean.
 */

export { ShellGuard } from './ShellGuard';
export { ShellRouteGuard } from './ShellRouteGuard';
export { SubbieShellGuard } from './SubbieShellGuard';
export {
  useShellV2Enabled,
  useSubbieShellActive,
  enableShellFlag,
  disableShellFlag,
  applyShellFlagFromUrl,
} from './shellFlag';
