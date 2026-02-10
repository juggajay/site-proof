import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, MfaRequiredError } from '@/lib/auth'
import { apiFetch, API_URL } from '@/lib/api'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true) // Default to checked
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkMode, setMagicLinkMode] = useState(false) // Feature #415: Magic link mode
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  // MFA state (Feature #22, #421)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Check if session expired
  const sessionExpired = location.state?.sessionExpired === true

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password, rememberMe, mfaRequired ? mfaCode : undefined)
      // Navigate to the original destination or dashboard
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      // Check for MFA challenge (Feature #22, #421)
      if (err instanceof MfaRequiredError) {
        setMfaRequired(true)
        setError('')
      } else if (err instanceof Error) {
        setError(err.message || 'Invalid email or password')
      } else {
        setError('Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  // Feature #415: Magic link login handler
  const handleMagicLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address')
      return
    }
    setError('')
    setLoading(true)

    try {
      await apiFetch('/api/auth/magic-link/request', {
        method: 'POST',
        body: JSON.stringify({ email })
      })

      setMagicLinkSent(true)
    } catch (err) {
      setError('Failed to send magic link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Feature #415: Magic link sent confirmation
  if (magicLinkSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">Check Your Email</h2>
        <p className="text-muted-foreground">
          We've sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
        </p>
        <p className="text-sm text-muted-foreground">
          The link will expire in 15 minutes.
        </p>
        <button
          onClick={() => {
            setMagicLinkSent(false)
            setMagicLinkMode(false)
          }}
          className="text-primary hover:underline text-sm"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  // Feature #415: Magic link mode
  if (magicLinkMode) {
    return (
      <form onSubmit={handleMagicLinkRequest} className="space-y-4">
        <h2 className="text-2xl font-bold">Sign In with Magic Link</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send you a link to sign in instantly.
        </p>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Sending link...' : 'Send Magic Link'}
        </button>

        <button
          type="button"
          onClick={() => setMagicLinkMode(false)}
          className="w-full text-center text-sm text-primary hover:underline"
        >
          Sign in with password instead
        </button>
      </form>
    )
  }

  // Feature #22, #421: MFA verification mode
  if (mfaRequired) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Two-Factor Authentication</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app to continue.
        </p>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="mfaCode" className="block text-sm font-medium mb-2">
            Verification Code
          </label>
          <input
            id="mfaCode"
            type="text"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full rounded-lg border bg-background px-3 py-3 text-center text-2xl font-mono tracking-widest"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || mfaCode.length !== 6}
          className="w-full rounded-lg bg-primary py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMfaRequired(false)
            setMfaCode('')
            setError('')
          }}
          className="w-full text-center text-sm text-primary hover:underline"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold">Sign In</h2>

      {sessionExpired && (
        <div className="rounded-lg bg-yellow-100 p-3 text-sm text-yellow-800" role="alert" aria-live="polite">
          Your session has expired. Please sign in again.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="rememberMe"
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="rememberMe" className="text-sm text-muted-foreground">
          Remember me
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      {/* Feature #415: Magic link option */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMagicLinkMode(true)}
        className="w-full rounded-lg border border-primary py-2 text-primary hover:bg-primary/5"
      >
        Sign in with Magic Link
      </button>

      {/* Feature #414, #1004: Google OAuth Sign In */}
      <a
        href={`${API_URL}/api/auth/google`}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </a>

      <div className="flex justify-between text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">
          Forgot password?
        </Link>
        <Link to="/register" className="text-primary hover:underline">
          Create account
        </Link>
      </div>
    </form>
  )
}
