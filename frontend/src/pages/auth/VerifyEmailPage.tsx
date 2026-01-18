import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { getAuthToken } from '@/lib/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4015'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')

  // For resend functionality
  const [resendEmail, setResendEmail] = useState('')
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [resendMessage, setResendMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('no-token')
      return
    }

    verifyEmail(token)
  }, [token])

  const verifyEmail = async (verificationToken: string) => {
    try {
      // First check if the token is valid
      const statusRes = await fetch(`${API_URL}/api/auth/verify-email-status?token=${verificationToken}`)
      const statusData = await statusRes.json()

      if (statusData.alreadyVerified) {
        setStatus('success')
        setMessage('Your email has already been verified. You can log in now.')
        return
      }

      if (!statusData.valid) {
        setStatus('error')
        setMessage(statusData.message || 'Invalid verification link')
        return
      }

      setEmail(statusData.email || '')

      // Now verify the email
      const res = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      })

      const data = await res.json()

      if (res.ok && data.verified) {
        setStatus('success')
        setMessage('Your email has been verified successfully!')
      } else {
        setStatus('error')
        setMessage(data.message || 'Verification failed. Please try again.')
      }
    } catch (error) {
      setStatus('error')
      setMessage('An error occurred. Please try again later.')
    }
  }

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail) return

    setResendStatus('loading')
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resendEmail }),
      })

      const data = await res.json()
      setResendStatus('success')
      setResendMessage(data.message)
    } catch (error) {
      setResendStatus('error')
      setResendMessage('Failed to resend verification email. Please try again.')
    }
  }

  // No token provided - show resend form
  if (status === 'no-token') {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Mail className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-4 text-2xl font-bold">Verify Your Email</h2>
          <p className="mt-2 text-muted-foreground">
            Enter your email to receive a new verification link.
          </p>
        </div>

        <form onSubmit={handleResend} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
              required
              placeholder="you@example.com"
            />
          </div>

          {resendStatus === 'success' && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {resendMessage}
            </div>
          )}

          {resendStatus === 'error' && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {resendMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={resendStatus === 'loading' || !resendEmail}
            className="w-full rounded-lg bg-primary py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {resendStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              'Send Verification Link'
            )}
          </button>
        </form>

        <p className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    )
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex w-full max-w-md flex-col items-center justify-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Verifying your email...</p>
      </div>
    )
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="w-full max-w-md space-y-6 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold text-green-700">Email Verified!</h2>
        <p className="text-muted-foreground">{message}</p>
        <Link
          to="/login"
          className="inline-block w-full rounded-lg bg-primary py-2 text-center text-primary-foreground hover:bg-primary/90"
        >
          Continue to Login
        </Link>
      </div>
    )
  }

  // Error state
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <XCircle className="mx-auto h-16 w-16 text-destructive" />
        <h2 className="mt-4 text-2xl font-bold text-destructive">Verification Failed</h2>
        <p className="mt-2 text-muted-foreground">{message}</p>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="font-medium">Need a new verification link?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email below to receive a new verification link.
        </p>

        <form onSubmit={handleResend} className="mt-4 space-y-3">
          <input
            type="email"
            value={resendEmail || email}
            onChange={(e) => setResendEmail(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2"
            required
            placeholder="you@example.com"
          />

          {resendStatus === 'success' && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {resendMessage}
            </div>
          )}

          {resendStatus === 'error' && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {resendMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={resendStatus === 'loading'}
            className="w-full rounded-lg bg-primary py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {resendStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              'Resend Verification Link'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          Back to Login
        </Link>
      </p>
    </div>
  )
}
