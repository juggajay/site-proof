import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiUrl } from './config';
import { MfaRequiredError } from './authErrors';
import { fetchWithTimeout } from './fetchWithTimeout';
import { logError } from './logger';
import {
  AUTH_SESSION_EXPIRED_EVENT,
  type AuthStorageKind,
  clearOfflineOwnerId,
  clearAuthFromAllStorages,
  getOfflineOwnerId,
  readAuthFromStorage,
  setOfflineOwnerId,
  writeAuthToStorage,
  writeRememberMePreference,
} from './authStorage';
import { isRecord, readLocalStorageItem } from './storagePreferences';

// Simple user type for local development
interface User {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  phone?: string;
  role?: string;
  roleInCompany?: string;
  dashboardRole?:
    | 'project_manager'
    | 'quality_manager'
    | 'foreman'
    | 'site_engineer'
    | 'viewer'
    | null;
  companyId?: string | null;
  companyName?: string | null;
  hasSubcontractorPortalAccess?: boolean;
  createdAt?: string;
  avatarUrl?: string | null;
  hasPassword?: boolean;
  emailVerified?: boolean;
}

type AuthResponseBody = {
  user?: User;
  token?: string;
  mfaRequired?: boolean;
  userId?: string;
  verificationRequired?: boolean;
  message?: string;
  error?: string | { message?: string };
};

type StoredAuth = {
  user: User;
  token: string;
};

type CurrentUserResult =
  | { status: 'ok'; user: User }
  | { status: 'unauthorized' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface SignOutOptions {
  // When true, end the session WITHOUT clearing locally stored offline work
  // (queued photos, diary/docket/lot edits). Used by automatic sign-outs such
  // as the inactivity timeout, where the user never chose to discard anything.
  // The offline-data owner id is preserved so a same-user re-login resumes the
  // pending work, while a different user logging in still triggers the privacy
  // wipe in prepareOfflineDataForUser (shared site tablets stay safe).
  preserveOfflineData?: boolean;
}

// Role override key for dev testing
const ROLE_OVERRIDE_KEY = 'siteproof_role_override';

// Helper to get role override (used by RoleSwitcher) - dev only
export function getRoleOverride(): string | null {
  if (typeof window === 'undefined') return null;
  if (!import.meta.env.DEV) return null;
  return readLocalStorageItem(ROLE_OVERRIDE_KEY);
}

interface AuthContextType {
  user: User | null;
  actualRole: string | null; // The user's actual role (without override)
  loading: boolean;
  sessionExpired: boolean;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
    mfaCode?: string,
  ) => Promise<User>;
  // Resolves with the signed-in user when registration also established a
  // session, or null when the account was created without one (the caller
  // should then fall back to the manual sign-in screen).
  signUp: (email: string, password: string, metadata?: object) => Promise<User | null>;
  signOut: (options?: SignOutOptions) => Promise<void>;
  handleSessionExpired: () => void;
  refreshUser: () => Promise<void>;
  setToken: (token: string) => Promise<User>; // Feature #414: OAuth callback support
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function clearOfflineDataSafely() {
  try {
    const { clearAllOfflineData } = await import('./offlineDb');
    await clearAllOfflineData();
  } catch (error) {
    logError('Failed to clear offline data:', error);
  }
}

async function prepareOfflineDataForUser(userId: string) {
  const offlineOwnerId = getOfflineOwnerId();
  if (offlineOwnerId && offlineOwnerId !== userId) {
    await clearOfflineDataSafely();
  }
  setOfflineOwnerId(userId);
}

async function clearOfflineDataForSignOut() {
  await clearOfflineDataSafely();
  clearOfflineOwnerId();
}

function isStoredUser(value: unknown): value is User {
  return isRecord(value) && typeof value.id === 'string' && typeof value.email === 'string';
}

function parseStoredAuth(raw: string): StoredAuth | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.token !== 'string' ||
      !parsed.token.trim() ||
      !isStoredUser(parsed.user)
    ) {
      return null;
    }

    return {
      user: parsed.user,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

function readStoredAuth(): { source: AuthStorageKind; auth: StoredAuth } | null {
  const storedAuth = readAuthFromStorage();
  if (!storedAuth) {
    return null;
  }

  const auth = parseStoredAuth(storedAuth.value);
  if (!auth) {
    clearAuthFromAllStorages();
    return null;
  }

  return {
    source: storedAuth.source,
    auth,
  };
}

function serializeStoredAuth(auth: StoredAuth): string {
  return JSON.stringify({
    user: auth.user,
    token: auth.token,
  });
}

function persistStoredAuth(source: AuthStorageKind, auth: StoredAuth): boolean {
  return writeAuthToStorage(source, serializeStoredAuth(auth));
}

function persistSignedInSession(source: AuthStorageKind, auth: StoredAuth): void {
  if (source === 'local' && !writeRememberMePreference(true)) {
    throw new Error(
      'Browser storage is unavailable. Enable cookies and site data, then try again.',
    );
  }

  if (!persistStoredAuth(source, auth)) {
    clearAuthFromAllStorages();
    throw new Error(
      'Browser storage is unavailable. Enable cookies and site data, then try again.',
    );
  }
}

async function readAuthResponseBody(response: Response): Promise<AuthResponseBody> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as AuthResponseBody) : {};
  } catch {
    if (!response.ok) {
      return {};
    }

    throw new Error('Authentication service returned an invalid response');
  }
}

function getAuthErrorMessage(data: AuthResponseBody, fallback: string): string {
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  if (data.error && typeof data.error === 'object' && data.error.message?.trim()) {
    return data.error.message;
  }

  if (data.message?.trim()) {
    return data.message;
  }

  return fallback;
}

async function fetchCurrentUser(token: string): Promise<CurrentUserResult> {
  const response = await fetchWithTimeout(apiUrl('/api/auth/me'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    return { status: 'unauthorized' };
  }

  if (!response.ok) {
    return { status: 'unavailable' };
  }

  const data = await readAuthResponseBody(response);
  if (!isStoredUser(data.user)) {
    return { status: 'invalid' };
  }

  return { status: 'ok', user: data.user };
}

async function revokeServerSession(token: string): Promise<void> {
  const response = await fetchWithTimeout(apiUrl('/api/auth/logout'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 401) {
    throw new Error('Logout request failed');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [actualUser, setActualUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Apply role override for dev testing (only for admin/owner users)
  const user = useMemo(() => {
    if (!actualUser) return null;

    const roleOverride = getRoleOverride();
    // Only allow override if actual user is admin/owner
    if (roleOverride && ['admin', 'owner'].includes(actualUser.role || '')) {
      return {
        ...actualUser,
        role: roleOverride,
        roleInCompany: roleOverride,
        dashboardRole: null,
      };
    }
    return actualUser;
  }, [actualUser]);

  useEffect(() => {
    // Check for stored auth on mount and verify token is valid
    const verifySession = async () => {
      const storedAuth = readStoredAuth();

      if (storedAuth) {
        try {
          const result = await fetchCurrentUser(storedAuth.auth.token);

          if (result.status === 'ok') {
            await prepareOfflineDataForUser(result.user.id);
            // Update storage with fresh user data
            persistStoredAuth(storedAuth.source, { ...storedAuth.auth, user: result.user });
            setActualUser(result.user);
          } else if (result.status === 'unauthorized' || result.status === 'invalid') {
            // Token is invalid or expired
            clearAuthFromAllStorages();
            queryClient.clear();
            setSessionExpired(true);
          } else {
            await prepareOfflineDataForUser(storedAuth.auth.user.id);
            setActualUser(storedAuth.auth.user);
          }
        } catch (error) {
          await prepareOfflineDataForUser(storedAuth.auth.user.id);
          setActualUser(storedAuth.auth.user);
          logError('Failed to verify stored session; using cached user:', error);
        }
      }
      setLoading(false);
    };

    verifySession();
  }, [queryClient]);

  const signIn = async (
    email: string,
    password: string,
    rememberMe: boolean = true,
    mfaCode?: string,
  ): Promise<User> => {
    const response = await fetchWithTimeout(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, mfaCode }),
    });

    const data = await readAuthResponseBody(response);

    // Check for MFA challenge (Feature #22, #421)
    if (response.ok && data.mfaRequired) {
      throw new MfaRequiredError(data.userId || '');
    }

    if (!response.ok) {
      throw new Error(getAuthErrorMessage(data, 'Login failed'));
    }

    if (!isStoredUser(data.user) || typeof data.token !== 'string' || !data.token.trim()) {
      throw new Error('Login failed');
    }

    // Clear any existing auth from both storages first
    await prepareOfflineDataForUser(data.user.id);
    queryClient.clear();
    clearAuthFromAllStorages();
    persistSignedInSession(rememberMe ? 'local' : 'session', {
      user: data.user,
      token: data.token,
    });

    setActualUser(data.user);
    setSessionExpired(false);
    return data.user;
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: object,
  ): Promise<User | null> => {
    const response = await fetchWithTimeout(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, ...metadata }),
    });

    if (!response.ok) {
      const error = await readAuthResponseBody(response);
      throw new Error(getAuthErrorMessage(error, 'Registration failed'));
    }

    const data = await readAuthResponseBody(response);

    if (!isStoredUser(data.user) || typeof data.token !== 'string' || !data.token.trim()) {
      // The account may still have been created (a response without a session
      // token, e.g. an older API shape). Fall back to the manual sign-in
      // screen rather than reporting the registration itself as failed.
      if (data.verificationRequired) {
        clearAuthFromAllStorages();
        queryClient.clear();
        setActualUser(null);
        setSessionExpired(false);
        return null;
      }
      throw new Error('Registration failed');
    }

    // Register issues a session token immediately — email verification is
    // non-blocking server-side — so sign the brand-new user straight in
    // instead of bouncing them to the login form to retype their password.
    await prepareOfflineDataForUser(data.user.id);
    queryClient.clear();
    clearAuthFromAllStorages();
    persistSignedInSession('local', {
      user: data.user,
      token: data.token,
    });

    setActualUser(data.user);
    setSessionExpired(false);
    return data.user;
  };

  const signOut = async (options?: SignOutOptions) => {
    const storedAuth = readStoredAuth();

    if (storedAuth?.auth.token) {
      try {
        await revokeServerSession(storedAuth.auth.token);
      } catch (error) {
        logError('Failed to revoke server session during sign out:', error);
      }
    }

    clearAuthFromAllStorages();
    queryClient.clear();
    // Automatic sign-outs (e.g. inactivity timeout) keep offline work so a
    // foreman who steps away doesn't lose unsynced photos/edits. Manual
    // sign-outs (and account-ending flows) still wipe via the default path.
    if (!options?.preserveOfflineData) {
      await clearOfflineDataForSignOut();
    }
    setActualUser(null);
  };

  const handleSessionExpired = useCallback(() => {
    clearAuthFromAllStorages();
    queryClient.clear();
    setActualUser(null);
    setSessionExpired(true);
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [handleSessionExpired]);

  const refreshUser = async () => {
    const storedAuth = readStoredAuth();
    if (!storedAuth) return;

    try {
      const result = await fetchCurrentUser(storedAuth.auth.token);

      if (result.status === 'ok') {
        // Update user in state and the appropriate storage
        persistStoredAuth(storedAuth.source, {
          ...storedAuth.auth,
          user: result.user,
        });
        setActualUser(result.user);
      } else if (result.status === 'unauthorized' || result.status === 'invalid') {
        clearAuthFromAllStorages();
        queryClient.clear();
        setActualUser(null);
        setSessionExpired(true);
      }
    } catch (e) {
      logError('Failed to refresh user:', e);
    }
  };

  // Feature #414: Set token from OAuth callback
  const setToken = async (token: string): Promise<User> => {
    try {
      // Verify the token and get user info
      const result = await fetchCurrentUser(token);

      if (result.status === 'ok') {
        // Clear any existing auth from both storages
        await prepareOfflineDataForUser(result.user.id);
        queryClient.clear();
        clearAuthFromAllStorages();
        persistSignedInSession('local', {
          user: result.user,
          token: token,
        });

        setActualUser(result.user);
        setSessionExpired(false);
        return result.user;
      } else {
        throw new Error('Invalid token');
      }
    } catch (error) {
      clearAuthFromAllStorages();
      queryClient.clear();
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        actualRole: actualUser?.role || null,
        loading,
        sessionExpired,
        signIn,
        signUp,
        signOut,
        handleSessionExpired,
        refreshUser,
        setToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper to get the stored token
export function getAuthToken(): string | null {
  return readStoredAuth()?.auth.token ?? null;
}

// Helper to get the current user from stored auth
export function getCurrentUser(): { id: string; email: string; role?: string } | null {
  const storedAuth = readStoredAuth();
  if (!storedAuth) {
    return null;
  }

  const { id, email, role } = storedAuth.auth.user;
  return { id, email, role };
}
