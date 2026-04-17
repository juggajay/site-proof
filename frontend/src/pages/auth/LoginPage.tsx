import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth, MfaRequiredError } from '@/lib/auth'
import { apiFetch, API_URL } from '@/lib/api'
import { loginSchema, emailSchema } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LoginFormData = z.infer<typeof loginSchema>

const magicLinkSchema = z.object({ email: emailSchema })
type MagicLinkFormData = z.infer<typeof magicLinkSchema>

const mfaSchema = z.object({ mfaCode: z.string().min(1, 'MFA code is required') })
type MfaFormData = z.infer<typeof mfaSchema>

export function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [magicLinkMode, setMagicLinkMode] = useState(false) // Feature #415: Magic link mode
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  // MFA state (Feature #22, #421)
  const [mfaRequired, setMfaRequired] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Check if session expired
  const sessionExpired = location.state?.sessionExpired === true

  // Main login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  // Magic link form
  const magicLinkForm = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  })

  // MFA form
  const mfaForm = useForm<MfaFormData>({
    resolver: zodResolver(mfaSchema),
    mode: 'onBlur',
    defaultValues: { mfaCode: '' },
  })

  const onLoginSubmit = async (data: LoginFormData) => {
    setLoading(true)

    try {
      const mfaCode = mfaRequired ? mfaForm.getValues('mfaCode') : undefined
      await signIn(data.email, data.password, data.rememberMe, mfaCode)
      // Navigate to the original destination or dashboard
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      // Check for MFA challenge (Feature #22, #421)
      if (err instanceof MfaRequiredError) {
        setMfaRequired(true)
        loginForm.clearErrors('root')
      } else if (err instanceof Error) {
        loginForm.setError('root', { message: err.message || 'Invalid email or password' })
      } else {
        loginForm.setError('root', { message: 'Invalid email or password' })
      }
    } finally {
      setLoading(false)
    }
  }

  const onMfaSubmit = async (data: MfaFormData) => {
    setLoading(true)
    const loginData = loginForm.getValues()

    try {
      await signIn(loginData.email, loginData.password, loginData.rememberMe, data.mfaCode)
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof Error) {
        mfaForm.setError('root', { message: err.message || 'Invalid email or password' })
      } else {
        mfaForm.setError('root', { message: 'Invalid email or password' })
      }
    } finally {
      setLoading(false)
    }
  }

  // Feature #415: Magic link login handler
  const onMagicLinkSubmit = async (data: MagicLinkFormData) => {
    setLoading(true)

    try {
      await apiFetch('/api/auth/magic-link/request', {
        method: 'POST',
        body: JSON.stringify({ email: data.email })
      })

      setMagicLinkEmail(data.email)
      setMagicLinkSent(true)
    } catch (err) {
      magicLinkForm.setError('root', { message: 'Failed to send magic link. Please try again.' })
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
          We've sent a magic link to <strong>{magicLinkEmail}</strong>. Click the link in the email to sign in.
        </p>
        <p className="text-sm text-muted-foreground">
          The link will expire in 15 minutes.
        </p>
        <Button
          variant="link"
          onClick={() => {
            setMagicLinkSent(false)
            setMagicLinkMode(false)
          }}
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  // Feature #415: Magic link mode
  if (magicLinkMode) {
    return (
      <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} className="space-y-4">
        <h2 className="text-2xl font-bold">Sign In with Magic Link</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send you a link to sign in instantly.
        </p>

        {magicLinkForm.formState.errors.root?.message && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
            {magicLinkForm.formState.errors.root.message}
          </div>
        )}

        <div>
          <Label htmlFor="magicLinkEmail">
            Email
          </Label>
          <Input
            id="magicLinkEmail"
            type="email"
            {...magicLinkForm.register('email')}
            className={`mt-1 ${
              magicLinkForm.formState.errors.email ? 'border-destructive' : ''
            }`}
          />
          {magicLinkForm.formState.errors.email && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {magicLinkForm.formState.errors.email.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Sending link...' : 'Send Magic Link'}
        </Button>

        <Button
          type="button"
          variant="link"
          onClick={() => setMagicLinkMode(false)}
          className="w-full"
        >
          Sign in with password instead
        </Button>
      </form>
    )
  }

  // Feature #22, #421: MFA verification mode
  if (mfaRequired) {
    return (
      <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-4">
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

        {mfaForm.formState.errors.root?.message && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
            {mfaForm.formState.errors.root.message}
          </div>
        )}

        <div>
          <Label htmlFor="mfaCode" className="mb-2">
            Verification Code
          </Label>
          <Input
            id="mfaCode"
            type="text"
            {...mfaForm.register('mfaCode', {
              onChange: (e) => {
                const filtered = e.target.value.replace(/\D/g, '').slice(0, 6)
                mfaForm.setValue('mfaCode', filtered)
              }
            })}
            placeholder="000000"
            className={`py-3 text-center text-2xl font-mono tracking-widest ${
              mfaForm.formState.errors.mfaCode ? 'border-destructive' : ''
            }`}
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
          />
          {mfaForm.formState.errors.mfaCode && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {mfaForm.formState.errors.mfaCode.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading || mfaForm.watch('mfaCode').length !== 6}
          className="w-full"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </Button>

        <Button
          type="button"
          variant="link"
          onClick={() => {
            setMfaRequired(false)
            mfaForm.reset()
            loginForm.clearErrors('root')
          }}
          className="w-full"
        >
          Back to sign in
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
      <h2 className="text-2xl font-bold">Sign In</h2>

      {sessionExpired && (
        <div className="rounded-lg bg-yellow-100 p-3 text-sm text-yellow-800" role="alert" aria-live="polite">
          Your session has expired. Please sign in again.
        </div>
      )}

      {loginForm.formState.errors.root?.message && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
          {loginForm.formState.errors.root.message}
        </div>
      )}

      <div>
        <Label htmlFor="email">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          {...loginForm.register('email')}
          className={`mt-1 ${
            loginForm.formState.errors.email ? 'border-destructive' : ''
          }`}
        />
        {loginForm.formState.errors.email && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {loginForm.formState.errors.email.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          {...loginForm.register('password')}
          className={`mt-1 ${
            loginForm.formState.errors.password ? 'border-destructive' : ''
          }`}
        />
        {loginForm.formState.errors.password && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {loginForm.formState.errors.password.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="rememberMe"
          type="checkbox"
          {...loginForm.register('rememberMe')}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <Label htmlFor="rememberMe" className="text-sm text-muted-foreground font-normal">
          Remember me
        </Label>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>

      {/* Feature #415: Magic link option */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setMagicLinkMode(true)}
        className="w-full"
      >
        Sign in with Magic Link
      </Button>

      {/* Feature #414, #1004: Google OAuth Sign In */}
      <a
        href={`${API_URL}/api/auth/google`}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2 text-foreground hover:bg-muted/50 transition-colors"
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
