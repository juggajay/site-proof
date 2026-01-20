import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setToken } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    const provider = searchParams.get('provider')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setError(`Authentication failed: ${errorParam}`)
      setTimeout(() => navigate('/login'), 3000)
      return
    }

    if (token) {
      // Store the token and redirect to dashboard
      localStorage.setItem('auth_token', token)
      setToken(token)
      console.log(`[OAuth] Successfully authenticated via ${provider}`)
      navigate('/dashboard', { replace: true })
    } else {
      setError('No authentication token received')
      setTimeout(() => navigate('/login'), 3000)
    }
  }, [searchParams, navigate, setToken])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
