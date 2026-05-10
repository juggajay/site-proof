import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ApiError, apiFetch } from '@/lib/api';

function getOAuthErrorMessage(error: string | null): string {
  if (error === 'mfa_required') {
    return 'This account has two-factor authentication enabled. Sign in with your email, password, and verification code.';
  }
  return error ? `Authentication failed: ${error}` : 'Failed to complete OAuth sign in';
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const message =
      typeof error.data?.error === 'object' ? error.data.error.message : error.data?.message;

    if (error.status === 403 && message?.includes('MFA verification required')) {
      return 'This account has two-factor authentication enabled. Sign in with your email, password, and verification code.';
    }
  }

  return 'Failed to complete OAuth sign in';
}

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    const completeOAuthSignIn = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(getOAuthErrorMessage(errorParam));
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!code) {
        setError('No authentication code received');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      window.history.replaceState(null, document.title, '/auth/oauth-callback');

      try {
        const data = await apiFetch<{ token: string }>('/api/auth/oauth/exchange', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });

        await setToken(data.token);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setError(getApiErrorMessage(err));
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    void completeOAuthSignIn();
  }, [searchParams, navigate, setToken]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4" role="alert">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4" role="status" aria-label="Completing sign in">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
