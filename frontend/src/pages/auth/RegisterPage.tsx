import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Check, X, Mail, FileText } from 'lucide-react'

const MIN_PASSWORD_LENGTH = 12

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const { signUp } = useAuth()
  const navigate = useNavigate()

  // Email validation
  const validateEmail = (email: string): { valid: boolean; error: string | null } => {
    if (!email) {
      return { valid: false, error: 'Email is required' }
    }
    // Check for basic email format: something@something.something
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Please enter a valid email address' }
    }
    return { valid: true, error: null }
  }

  const emailValidation = useMemo(() => validateEmail(email), [email])
  const isEmailValid = emailValidation.valid

  // Password validation rules
  const passwordValidation = useMemo(() => ({
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }), [password])

  const isPasswordValid = passwordValidation.minLength &&
    passwordValidation.hasUppercase &&
    passwordValidation.hasLowercase &&
    passwordValidation.hasNumber

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isPasswordValid) {
      setError('Password does not meet complexity requirements')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!tosAccepted) {
      setError('You must accept the Terms of Service to create an account')
      return
    }

    setLoading(true)

    try {
      const result = await signUp(email, password, { firstName, lastName, tosAccepted })
      // Show verification message instead of navigating to login
      setRegisteredEmail(email)
      setRegistrationSuccess(true)
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Show success message after registration
  if (registrationSuccess) {
    return (
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Check Your Email</h2>
        <p className="text-muted-foreground">
          We've sent a verification link to <strong>{registeredEmail}</strong>.
          Please check your email and click the link to verify your account.
        </p>
        <div className="rounded-lg border bg-amber-50 p-4 text-left text-sm text-amber-800">
          <strong>Development Mode:</strong> Check the terminal/console running the backend server
          for the verification link.
        </div>
        <div className="space-y-2">
          <Link
            to="/login"
            className="inline-block w-full rounded-lg bg-primary py-2 text-center text-primary-foreground hover:bg-primary/90"
          >
            Go to Login
          </Link>
          <Link
            to="/verify-email"
            className="inline-block w-full rounded-lg border py-2 text-center hover:bg-muted"
          >
            Resend Verification Email
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold">Create Account</h2>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 ${
            emailTouched && !isEmailValid ? 'border-destructive' : ''
          }`}
          required
        />
        {emailTouched && !isEmailValid && emailValidation.error && (
          <p className="mt-1 text-sm text-destructive" role="alert" aria-live="assertive">{emailValidation.error}</p>
        )}
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
          className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 ${
            password && !isPasswordValid ? 'border-destructive' : ''
          }`}
          required
        />
        {password && (
          <div className="mt-2 space-y-1 text-xs">
            <div className={`flex items-center gap-1 ${passwordValidation.minLength ? 'text-green-600' : 'text-muted-foreground'}`}>
              {passwordValidation.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              At least {MIN_PASSWORD_LENGTH} characters
            </div>
            <div className={`flex items-center gap-1 ${passwordValidation.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
              {passwordValidation.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              One uppercase letter
            </div>
            <div className={`flex items-center gap-1 ${passwordValidation.hasLowercase ? 'text-green-600' : 'text-muted-foreground'}`}>
              {passwordValidation.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              One lowercase letter
            </div>
            <div className={`flex items-center gap-1 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
              {passwordValidation.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              One number
            </div>
          </div>
        )}
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
          required
        />
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <input
            id="tosAccepted"
            type="checkbox"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            required
          />
          <label htmlFor="tosAccepted" className="text-sm">
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>I agree to the</span>
            </span>
            <a
              href="/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Privacy Policy
            </a>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || (email.length > 0 && !isEmailValid) || (password.length > 0 && !isPasswordValid) || !tosAccepted}
        className="w-full rounded-lg bg-primary py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Create Account'}
      </button>

      <p className="text-center text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
