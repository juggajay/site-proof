import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { MfaRequiredError } from '@/lib/authErrors';
import { apiFetch, apiUrl } from '@/lib/api';
import { loginSchema, emailSchema } from '@/lib/validation';
import { renderChainageTicks } from '@/lib/chainageTicks';
import { getPostLoginRedirect, getRequestedPostLoginRedirect } from './postLoginRedirect';
import './authSurvey.css';

/* ============================================================
   CIVOS — sign in.
   Survey-night ("Quiet Authority") skin ported from
   docs/design-mockups/login.html. The auth logic, validation,
   redirect rules, magic-link, MFA and Google OAuth wiring are
   unchanged from the original LoginPage — only the presentation
   is restyled. Styling lives in authSurvey.css under .sp-auth.
   ============================================================ */

type LoginFormData = z.infer<typeof loginSchema>;

const magicLinkSchema = z.object({ email: emailSchema });
type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

const mfaSchema = z.object({
  mfaCode: z
    .string()
    .trim()
    .min(1, 'MFA code is required')
    .regex(/^(?:\d{6}|[A-Fa-f0-9]{10})$/, 'Enter a 6-digit code or 10-character backup code'),
});
type MfaFormData = z.infer<typeof mfaSchema>;

function getLoginErrorMessage(error: string | null): string | null {
  if (error === 'mfa_required') {
    return 'This account has two-factor authentication enabled. Sign in with your email, password, and verification code.';
  }
  if (error === 'oauth_not_configured') {
    return 'Google sign in is not configured for this environment.';
  }
  if (error === 'oauth_failed' || error === 'invalid_state' || error === 'token_exchange_failed') {
    return 'Google sign in failed. Please try again.';
  }
  return null;
}

function BrandMark() {
  return (
    <svg viewBox="0 0 192 192" role="img" aria-hidden="true">
      <rect width="192" height="192" rx="40" fill="#f3efe8" />
      <path
        d="M52 118c11 11 24 17 39 17 28 0 49-21 49-49 0-11-3-21-9-30"
        fill="none"
        stroke="#14100d"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M55 78c10-13 24-20 41-20 13 0 25 5 34 14"
        fill="none"
        stroke="#d97706"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M67 100l19 19 43-52"
        fill="none"
        stroke="#14100d"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function EnvelopeMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function buildGoogleOAuthHref(redirect: string | null): string {
  if (!redirect) {
    return apiUrl('/api/auth/google');
  }

  return apiUrl(`/api/auth/google?redirect=${encodeURIComponent(redirect)}`);
}

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false); // Feature #415: Magic link mode
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  // MFA state (Feature #22, #421)
  const [mfaRequired, setMfaRequired] = useState(false);
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const loginErrorMessage = getLoginErrorMessage(searchParams.get('error'));
  const chainRef = useRef<HTMLDivElement>(null);

  // Check if session expired
  const sessionExpired = location.state?.sessionExpired === true;
  const stateMessage =
    typeof location.state?.message === 'string' ? location.state.message.trim() : '';

  // Main login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  // Magic link form
  const magicLinkForm = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  // MFA form
  const mfaForm = useForm<MfaFormData>({
    resolver: zodResolver(mfaSchema),
    mode: 'onBlur',
    defaultValues: { mfaCode: '' },
  });

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Sign in — CIVOS';

    // chainage ticks along the page bottom
    if (chainRef.current) renderChainageTicks(chainRef.current);

    return () => {
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(getPostLoginRedirect(searchParams, location.state, user), { replace: true });
    }
  }, [authLoading, location.state, navigate, searchParams, user]);

  const onLoginSubmit = async (data: LoginFormData) => {
    setLoading(true);

    try {
      const mfaCode = mfaRequired ? mfaForm.getValues('mfaCode') : undefined;
      const signedInUser = await signIn(data.email, data.password, data.rememberMe, mfaCode);
      // Navigate to the original destination, with mobile shell entry points resolved up front.
      const from = getPostLoginRedirect(searchParams, location.state, signedInUser);
      navigate(from, { replace: true });
    } catch (err) {
      // Check for MFA challenge (Feature #22, #421)
      if (err instanceof MfaRequiredError) {
        setMfaRequired(true);
        loginForm.clearErrors('root');
      } else if (err instanceof Error) {
        loginForm.setError('root', { message: err.message || 'Invalid email or password' });
      } else {
        loginForm.setError('root', { message: 'Invalid email or password' });
      }
    } finally {
      setLoading(false);
    }
  };

  const onMfaSubmit = async (data: MfaFormData) => {
    setLoading(true);
    const loginData = loginForm.getValues();

    try {
      const signedInUser = await signIn(
        loginData.email,
        loginData.password,
        loginData.rememberMe,
        data.mfaCode,
      );
      const from = getPostLoginRedirect(searchParams, location.state, signedInUser);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        mfaForm.setError('root', { message: err.message || 'Invalid email or password' });
      } else {
        mfaForm.setError('root', { message: 'Invalid email or password' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Feature #415: Magic link login handler
  const onMagicLinkSubmit = async (data: MagicLinkFormData) => {
    setLoading(true);

    try {
      const redirect = getRequestedPostLoginRedirect(searchParams, location.state);
      await apiFetch('/api/auth/magic-link/request', {
        method: 'POST',
        body: JSON.stringify({ email: data.email, ...(redirect ? { redirect } : {}) }),
      });

      setMagicLinkEmail(data.email);
      setMagicLinkSent(true);
    } catch (_err) {
      magicLinkForm.setError('root', { message: 'Failed to send magic link. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const mfaCodeValue = mfaForm.watch('mfaCode');
  const canSubmitMfa = mfaCodeValue.length === 6 || mfaCodeValue.length === 10;
  const requestedRedirect = getRequestedPostLoginRedirect(searchParams, location.state);
  const googleOAuthHref = buildGoogleOAuthHref(requestedRedirect);

  if (authLoading) {
    return (
      <div className="sp-auth">
        <div className="stage">
          <div className="auth">
            <div className="card text-center" role="status" aria-label="Checking existing session">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="card-sub mt-4">Checking your session...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  let cardLabel = 'AUTH / 01';
  let cardContent: React.ReactNode;

  if (magicLinkSent) {
    // Feature #415: Magic link sent confirmation
    cardLabel = 'AUTH / 02';
    cardContent = (
      <>
        <div className="card-h">
          <h1>Check your email</h1>
          <span className="mono">{cardLabel}</span>
        </div>
        <div className="card-body">
          <div className="sent">
            <div className="ring">✓</div>
            <h2>Magic link sent</h2>
            <p>
              If an account exists for <b>{magicLinkEmail}</b>, we&rsquo;ve sent a sign-in link.
              <br />
              Click it on this device to get straight in.
            </p>
            <p className="fine">
              The link expires in 15 minutes. Wrong address?{' '}
              <button
                type="button"
                onClick={() => {
                  setMagicLinkSent(false);
                  setMagicLinkMode(false);
                }}
              >
                Start again
              </button>
            </p>
          </div>
        </div>
      </>
    );
  } else if (magicLinkMode) {
    // Feature #415: Magic link mode
    cardLabel = 'AUTH / 02';
    cardContent = (
      <>
        <div className="card-h">
          <h1>Magic link</h1>
          <span className="mono">{cardLabel}</span>
        </div>
        <p className="card-sub">No password. We&rsquo;ll email you a one-time sign-in link.</p>
        <div className="card-body">
          {magicLinkForm.formState.errors.root?.message && (
            <div className="note red" role="alert" aria-live="assertive">
              <span className="ic">!</span>
              {magicLinkForm.formState.errors.root.message}
            </div>
          )}
          <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} noValidate>
            <div className="frow">
              <label htmlFor="magicLinkEmail">Email</label>
              <input
                id="magicLinkEmail"
                type="email"
                autoComplete="email"
                inputMode="email"
                {...magicLinkForm.register('email')}
              />
              {magicLinkForm.formState.errors.email && (
                <p className="ferr" role="alert">
                  {magicLinkForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Sending link…' : 'Send magic link'}
              <span className="ar" aria-hidden="true">
                →
              </span>
            </button>
          </form>
          <p className="swap">
            <button type="button" onClick={() => setMagicLinkMode(false)}>
              ← Back to password sign-in
            </button>
          </p>
        </div>
      </>
    );
  } else if (mfaRequired) {
    // Feature #22, #421: MFA verification mode
    cardLabel = 'AUTH / 03';
    cardContent = (
      <>
        <div className="card-h">
          <h1>Two-factor code</h1>
          <span className="mono">{cardLabel}</span>
        </div>
        <p className="card-sub">This account has two-factor authentication enabled.</p>
        <div className="card-body">
          <div className="note amber">
            <span className="ic">MFA</span>
            Enter the 6-digit code from your authenticator app, or a backup code, to finish signing
            in.
          </div>
          {mfaForm.formState.errors.root?.message && (
            <div className="note red" role="alert" aria-live="assertive">
              <span className="ic">!</span>
              {mfaForm.formState.errors.root.message}
            </div>
          )}
          <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} noValidate>
            <div className="frow" style={{ marginTop: 18 }}>
              <label htmlFor="mfaCode">Verification code</label>
              <input
                id="mfaCode"
                className="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="••••••"
                autoFocus
                {...mfaForm.register('mfaCode', {
                  onChange: (e) => {
                    const filtered = e.target.value
                      .replace(/[^a-fA-F0-9]/g, '')
                      .toUpperCase()
                      .slice(0, 10);
                    mfaForm.setValue('mfaCode', filtered);
                  },
                })}
              />
              {mfaForm.formState.errors.mfaCode && (
                <p className="ferr" role="alert">
                  {mfaForm.formState.errors.mfaCode.message}
                </p>
              )}
            </div>
            <button className="btn primary" type="submit" disabled={loading || !canSubmitMfa}>
              {loading ? 'Verifying…' : 'Verify and sign in'}
              <span className="ar" aria-hidden="true">
                →
              </span>
            </button>
          </form>
          <p className="swap">
            <button
              type="button"
              onClick={() => {
                setMfaRequired(false);
                mfaForm.reset();
                loginForm.clearErrors('root');
              }}
            >
              ← Back to password sign-in
            </button>
          </p>
        </div>
      </>
    );
  } else {
    // Default: password sign-in
    cardContent = (
      <>
        <div className="card-h">
          <h1>Sign in</h1>
          <span className="mono">{cardLabel}</span>
        </div>
        <p className="card-sub">Back to the lots. Evidence doesn&rsquo;t chase itself.</p>
        <div className="card-body">
          {sessionExpired && (
            <div className="note amber" role="alert" aria-live="polite">
              <span className="ic">!</span>
              Your session has expired. Please sign in again.
            </div>
          )}

          {stateMessage && !sessionExpired && (
            <div className="note green" role="status" aria-live="polite">
              <span className="ic">✓</span>
              {stateMessage}
            </div>
          )}

          {loginForm.formState.errors.root?.message && (
            <div className="note red" role="alert" aria-live="assertive">
              <span className="ic">!</span>
              {loginForm.formState.errors.root.message}
            </div>
          )}

          {loginErrorMessage && !loginForm.formState.errors.root?.message && (
            <div className="note red" role="alert" aria-live="assertive">
              <span className="ic">!</span>
              {loginErrorMessage}
            </div>
          )}

          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} noValidate>
            <div className="frow">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                {...loginForm.register('email')}
              />
              {loginForm.formState.errors.email && (
                <p className="ferr" role="alert">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="frow">
              <div className="lblrow">
                <label htmlFor="password">Password</label>
                <Link className="aux" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...loginForm.register('password')}
              />
              {loginForm.formState.errors.password && (
                <p className="ferr" role="alert">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <label className="remember">
              <input type="checkbox" {...loginForm.register('rememberMe')} />
              Remember me on this device
            </label>

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
              <span className="ar" aria-hidden="true">
                →
              </span>
            </button>
          </form>

          <div className="divider">or</div>

          <div className="alts">
            {/* Feature #415: Magic link option */}
            <button className="btn" type="button" onClick={() => setMagicLinkMode(true)}>
              <EnvelopeMark />
              Email me a magic link
            </button>

            {/* Feature #414, #1004: Google OAuth Sign In */}
            <a className="btn" href={googleOAuthHref}>
              <GoogleMark />
              Continue with Google
            </a>
          </div>

          <p className="swap">
            New to CIVOS? <Link to="/register">Create account</Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="sp-auth">
      <div className="top">
        <div className="wrap">
          <Link className="brand" to="/landing" aria-label="CIVOS home">
            <BrandMark />
            CIVOS
          </Link>
          <Link className="back" to="/landing">
            <span className="mono">←</span> Back to site
          </Link>
        </div>
      </div>

      <div className="stage">
        <div className="auth">
          <div className="kicker">
            <span className="d" />
            <span className="micro">Site access</span>
          </div>

          <div className="card">
            {cardContent}
            <div className="card-f">
              <span className="d" />
              Sessions are device-scoped · superintendents releasing hold points never need an
              account
            </div>
          </div>

          <p className="below">
            Subcontractor crew? Use the invitation link your head contractor sent you.
          </p>
        </div>
      </div>

      <div className="chainage" ref={chainRef} aria-hidden="true" />
    </div>
  );
}

export default LoginPage;
