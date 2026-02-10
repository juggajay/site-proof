import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { apiFetch } from '@/lib/api'

// Feature #415: Magic link verification page
export function MagicLinkPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { setToken } = useAuth()

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setError('Invalid or missing magic link token')
      return
    }

    const verifyMagicLink = async () => {
      try {
        const data = await apiFetch<{ token: string }>('/api/auth/magic-link/verify', {
          method: 'POST',
          body: JSON.stringify({ token })
        })

        if (data.token) {
          // Use the centralized setToken which handles storage properly
          await setToken(data.token)

          setStatus('success')

          // Redirect to dashboard after brief delay
          setTimeout(() => {
            navigate('/dashboard', { replace: true })
          }, 1500)
        } else {
          setStatus('error')
          setError('Magic link verification failed')
        }
      } catch (err) {
        setStatus('error')
        setError('Failed to verify magic link. Please try again.')
      }
    }

    verifyMagicLink()
  }, [searchParams, navigate, setToken])

  if (status === 'verifying') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
        <h2 className="text-2xl font-bold">Verifying Magic Link</h2>
        <p className="text-muted-foreground">Please wait while we sign you in...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">Success!</h2>
        <p className="text-muted-foreground">You've been signed in. Redirecting to dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold">Magic Link Error</h2>
      <p className="text-muted-foreground">{error}</p>
      <p className="text-sm text-muted-foreground">
        Magic links expire after 15 minutes. Please request a new one.
      </p>
      <Link
        to="/login"
        className="inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Back to Sign In
      </Link>
    </div>
  )
}
