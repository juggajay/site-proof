import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Building2, ClipboardCheck, User, AlertCircle, Loader2, Check, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { apiFetch, ApiError } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface Invitation {
  id: string
  companyName: string
  projectName: string
  headContractorName: string
  primaryContactEmail: string
  primaryContactName?: string
  status: string
}

export function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invitationId = searchParams.get('id')
  const { user, loading: authLoading, refreshUser } = useAuth()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  // Registration form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [tosAccepted, setTosAccepted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Password requirements (must match backend: 12+ chars, uppercase, lowercase, number, special)
  const [passwordChecks, setPasswordChecks] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
  })

  // Fetch invitation details
  useEffect(() => {
    async function fetchInvitation() {
      if (!invitationId) {
        setError('No invitation ID provided')
        setLoading(false)
        return
      }

      try {
        const data = await apiFetch<{ invitation: Invitation }>(`/api/subcontractors/invitation/${invitationId}`)
        setInvitation(data.invitation)

        // Pre-fill email from invitation
        if (data.invitation.primaryContactEmail) {
          setEmail(data.invitation.primaryContactEmail)
        }
        if (data.invitation.primaryContactName) {
          setFullName(data.invitation.primaryContactName)
        }
      } catch (err) {
        console.error('Error fetching invitation:', err)
        if (err instanceof ApiError && err.status === 404) {
          setError('This invitation was not found or has expired.')
        } else {
          setError('Failed to load invitation details')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchInvitation()
  }, [invitationId])

  // Update password checks
  useEffect(() => {
    setPasswordChecks({
      minLength: password.length >= 12,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    })
  }, [password])

  // Handle accepting invitation for logged-in users
  const handleAcceptAsLoggedIn = async () => {
    if (!invitationId) return

    setAccepting(true)
    setFormError(null)

    try {
      await apiFetch(`/api/subcontractors/invitation/${invitationId}/accept`, {
        method: 'POST',
      })

      // Refresh auth to get updated role
      await refreshUser()

      toast({ title: 'Welcome!', description: `You've joined ${invitation?.companyName}. Let's get started!`, variant: 'success' })
      navigate('/subcontractor-portal')
    } catch (err) {
      console.error('Error accepting invitation:', err)
      if (err instanceof ApiError) {
        try {
          const errorData = JSON.parse(err.body)
          setFormError(errorData.error || errorData.message || 'Failed to accept invitation')
        } catch {
          setFormError('Failed to accept invitation. Please try again.')
        }
      } else {
        setFormError('Failed to accept invitation. Please try again.')
      }
      setAccepting(false)
    }
  }

  // Handle registration and accepting invitation
  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Validation
    if (!fullName.trim()) {
      setFormError('Please enter your full name')
      return
    }

    if (!email.trim()) {
      setFormError('Please enter your email')
      return
    }

    if (!password) {
      setFormError('Please enter a password')
      return
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match')
      return
    }

    const allPasswordChecks = Object.values(passwordChecks).every(Boolean)
    if (!allPasswordChecks) {
      setFormError('Password does not meet all requirements')
      return
    }

    if (!tosAccepted) {
      setFormError('You must accept the Terms of Service')
      return
    }

    setAccepting(true)

    try {
      const data = await apiFetch<{ user: any; token: string; company: { companyName: string } }>('/api/auth/register-and-accept-invitation', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName,
          invitationId,
          tosAccepted,
        }),
      })

      // Store auth token in localStorage
      localStorage.setItem('siteproof_auth', JSON.stringify({
        user: data.user,
        token: data.token,
      }))
      localStorage.setItem('siteproof_remember_me', 'true')

      toast({ title: 'Account Created!', description: `You've joined ${data.company.companyName}.`, variant: 'success' })

      // Force page reload to update auth state
      window.location.href = '/subcontractor-portal'
    } catch (err) {
      console.error('Error registering:', err)
      if (err instanceof ApiError) {
        try {
          const errorData = JSON.parse(err.body)
          setFormError(errorData.message || 'Failed to create account')
        } catch {
          setFormError('Failed to create account. Please try again.')
        }
      } else {
        setFormError('Failed to create account. Please try again.')
      }
      setAccepting(false)
    }
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading invitation...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invitation Not Found</h2>
            <p className="text-gray-600 mb-4">
              {error || 'This invitation link is invalid or has expired.'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              If you believe this is an error, please contact the head contractor who sent you the invitation.
            </p>
            <Link to="/auth/login" className="inline-block px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Already accepted
  if (invitation.status === 'approved' || invitation.status === 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invitation Already Accepted</h2>
            <p className="text-gray-600 mb-4">
              This invitation has already been accepted.
            </p>
            {user ? (
              <Link to="/subcontractor-portal" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Go to Portal
              </Link>
            ) : (
              <Link to="/auth/login" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Log In
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <span className="text-2xl font-bold text-blue-600">SiteProof</span>
        </div>

        {/* Invitation Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold dark:text-white">You've been invited!</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Join as a subcontractor on the following project
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Your Company</p>
                <p className="font-medium dark:text-white">{invitation.companyName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Project</p>
                <p className="font-medium dark:text-white">{invitation.projectName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Invited by</p>
                <p className="font-medium dark:text-white">{invitation.headContractorName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {user ? (
            // Logged in - just accept
            <div>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                Logged in as <strong className="dark:text-white">{user.email}</strong>
              </p>
              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}
              <button
                onClick={handleAcceptAsLoggedIn}
                disabled={accepting}
                className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </button>
              <p className="text-center text-sm text-gray-500 mt-4">
                Not you?{' '}
                <Link to="/auth/login" className="text-blue-600 hover:underline">
                  Log in with a different account
                </Link>
              </p>
            </div>
          ) : (
            // Not logged in - show registration form
            <form onSubmit={handleRegisterAndAccept}>
              <h3 className="text-lg font-semibold dark:text-white mb-1">Create Account</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Create your account to accept this invitation
              </p>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Smith"
                    autoComplete="name"
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    autoComplete="email"
                    disabled={!!invitation.primaryContactEmail}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600"
                  />
                  {invitation.primaryContactEmail && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3 text-green-500" />
                      Email pre-filled from invitation
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a secure password"
                      autoComplete="new-password"
                      className="w-full px-3 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Password requirements */}
                  {password && (
                    <div className="text-xs space-y-1 mt-2">
                      <p className={passwordChecks.minLength ? 'text-green-600' : 'text-gray-500'}>
                        {passwordChecks.minLength ? '✓' : '○'} At least 12 characters
                      </p>
                      <p className={passwordChecks.hasUppercase ? 'text-green-600' : 'text-gray-500'}>
                        {passwordChecks.hasUppercase ? '✓' : '○'} One uppercase letter
                      </p>
                      <p className={passwordChecks.hasLowercase ? 'text-green-600' : 'text-gray-500'}>
                        {passwordChecks.hasLowercase ? '✓' : '○'} One lowercase letter
                      </p>
                      <p className={passwordChecks.hasNumber ? 'text-green-600' : 'text-gray-500'}>
                        {passwordChecks.hasNumber ? '✓' : '○'} One number
                      </p>
                      <p className={passwordChecks.hasSpecial ? 'text-green-600' : 'text-gray-500'}>
                        {passwordChecks.hasSpecial ? '✓' : '○'} One special character
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                  )}
                </div>

                <div className="flex items-start gap-2 pt-2">
                  <input
                    id="tos"
                    type="checkbox"
                    checked={tosAccepted}
                    onChange={(e) => setTosAccepted(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="tos" className="text-sm text-gray-600 dark:text-gray-400">
                    I agree to the{' '}
                    <Link to="/terms-of-service" target="_blank" className="text-blue-600 hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy-policy" target="_blank" className="text-blue-600 hover:underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={accepting}
                  className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Create Account & Accept'
                  )}
                </button>

                <p className="text-center text-sm text-gray-500">
                  Already have an account?{' '}
                  <Link
                    to={`/auth/login?redirect=${encodeURIComponent(`/subcontractor-portal/accept-invite?id=${invitationId}`)}`}
                    className="text-blue-600 hover:underline"
                  >
                    Log in instead
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
