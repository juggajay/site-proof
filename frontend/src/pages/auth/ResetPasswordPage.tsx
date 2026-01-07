import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState('')

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setTokenError('No reset token provided')
        setValidating(false)
        return
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'
        const response = await fetch(`${apiUrl}/api/auth/validate-reset-token?token=${token}`)
        const data = await response.json()

        if (data.valid) {
          setTokenValid(true)
        } else {
          setTokenError(data.message || 'Invalid or expired reset token')
        }
      } catch {
        setTokenError('Failed to validate token. Please try again.')
      } finally {
        setValidating(false)
      }
    }

    validateToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password length
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password')
      }

      setSuccess(true)

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state while validating token
  if (validating) {
    return (
      <div className="space-y-4 text-center">
        <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Validating reset link...</p>
      </div>
    )
  }

  // Invalid or expired token
  if (!tokenValid) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-6xl">🔒</div>
        <h2 className="text-2xl font-bold text-destructive">Invalid Reset Link</h2>
        <p className="text-muted-foreground">{tokenError}</p>
        <div className="space-y-2 pt-4">
          <Link
            to="/forgot-password"
            className="block w-full rounded-lg bg-primary py-2 text-center text-primary-foreground hover:bg-primary/90"
          >
            Request New Reset Link
          </Link>
          <Link
            to="/login"
            className="block text-center text-sm text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-6xl">✅</div>
        <h2 className="text-2xl font-bold text-green-600">Password Reset Successfully!</h2>
        <p className="text-muted-foreground">
          Your password has been updated. Redirecting to login...
        </p>
        <Link
          to="/login"
          className="block text-center text-sm text-primary hover:underline"
        >
          Click here if not redirected
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold">Create New Password</h2>
      <p className="text-sm text-muted-foreground">
        Enter your new password below. Password must be at least 8 characters long.
      </p>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          New Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Enter new password"
          minLength={8}
          required
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Confirm new password"
          minLength={8}
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Resetting Password...' : 'Reset Password'}
      </button>

      <Link
        to="/login"
        className="block text-center text-sm text-primary hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  )
}
