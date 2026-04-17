import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, ClipboardCheck, User, AlertCircle, Loader2, Check, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { extractErrorMessage, isNotFound } from '@/lib/errorHandling'
import { acceptInviteSchema, MIN_PASSWORD_LENGTH } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>

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
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      tosAccepted: false,
    },
  })

  // Watch password for real-time validation feedback
  const password = watch('password', '')
  const confirmPassword = watch('confirmPassword', '')

  // Password requirements (must match backend: 12+ chars, uppercase, lowercase, number, special)
  const passwordChecks = useMemo(() => ({
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  }), [password])

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
          setValue('email', data.invitation.primaryContactEmail)
        }
        if (data.invitation.primaryContactName) {
          setValue('fullName', data.invitation.primaryContactName)
        }
      } catch (err) {
        if (isNotFound(err)) {
          setError('This invitation was not found or has expired.')
        } else {
          setError(extractErrorMessage(err, 'Failed to load invitation details'))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchInvitation()
  }, [invitationId, setValue])

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
      setFormError(extractErrorMessage(err, 'Failed to accept invitation. Please try again.'))
      setAccepting(false)
    }
  }

  // Handle registration and accepting invitation
  const onRegisterSubmit = async (data: AcceptInviteFormData) => {
    setFormError(null)
    setAccepting(true)

    try {
      const result = await apiFetch<{ user: any; token: string; company: { companyName: string } }>('/api/auth/register-and-accept-invitation', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          invitationId,
          tosAccepted: data.tosAccepted,
        }),
      })

      // Store auth token in localStorage
      localStorage.setItem('siteproof_auth', JSON.stringify({
        user: result.user,
        token: result.token,
      }))
      localStorage.setItem('siteproof_remember_me', 'true')

      toast({ title: 'Account Created!', description: `You've joined ${result.company.companyName}.`, variant: 'success' })

      // Force page reload to update auth state
      window.location.href = '/subcontractor-portal'
    } catch (err) {
      console.error('Error registering:', err)
      setFormError(extractErrorMessage(err, 'Failed to create account. Please try again.'))
      setAccepting(false)
    }
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading invitation...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invitation Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {error || 'This invitation link is invalid or has expired.'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              If you believe this is an error, please contact the head contractor who sent you the invitation.
            </p>
            <Link to="/auth/login" className="inline-block px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted/50">
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
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invitation Already Accepted</h2>
            <p className="text-muted-foreground mb-4">
              This invitation has already been accepted.
            </p>
            {user ? (
              <Link to="/subcontractor-portal" className="inline-block px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                Go to Portal
              </Link>
            ) : (
              <Link to="/auth/login" className="inline-block px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                Log In
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <span className="text-2xl font-bold text-primary">SiteProof</span>
        </div>

        {/* Invitation Card */}
        <div className="bg-card dark:bg-card rounded-lg shadow-md p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold dark:text-foreground">You've been invited!</h2>
            <p className="text-muted-foreground dark:text-muted-foreground text-sm">
              Join as a subcontractor on the following project
            </p>
          </div>

          <div className="bg-muted/50 dark:bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Your Company</p>
                <p className="font-medium dark:text-foreground">{invitation.companyName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Project</p>
                <p className="font-medium dark:text-foreground">{invitation.projectName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Invited by</p>
                <p className="font-medium dark:text-foreground">{invitation.headContractorName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="bg-card dark:bg-card rounded-lg shadow-md p-6">
          {user ? (
            // Logged in - just accept
            <div>
              <p className="text-center text-sm text-muted-foreground dark:text-muted-foreground mb-4">
                Logged in as <strong className="dark:text-foreground">{user.email}</strong>
              </p>
              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}
              <Button
                onClick={handleAcceptAsLoggedIn}
                disabled={accepting}
                className="w-full py-3"
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Not you?{' '}
                <Link to="/auth/login" className="text-primary hover:underline">
                  Log in with a different account
                </Link>
              </p>
            </div>
          ) : (
            // Not logged in - show registration form
            <form onSubmit={handleSubmit(onRegisterSubmit)}>
              <h3 className="text-lg font-semibold dark:text-foreground mb-1">Create Account</h3>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
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
                  <Label htmlFor="fullName" className="mb-1">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    {...register('fullName')}
                    placeholder="John Smith"
                    autoComplete="name"
                    className={`py-3 ${
                      errors.fullName ? 'border-destructive' : ''
                    }`}
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {errors.fullName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="mb-1">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="john@company.com"
                    autoComplete="email"
                    disabled={!!invitation.primaryContactEmail}
                    className={`py-3 ${
                      errors.email ? 'border-destructive' : ''
                    }`}
                  />
                  {invitation.primaryContactEmail && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3 text-green-500" />
                      Email pre-filled from invitation
                    </p>
                  )}
                  {errors.email && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password" className="mb-1">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      placeholder="Create a secure password"
                      autoComplete="new-password"
                      className={`py-3 pr-10 ${
                        errors.password ? 'border-destructive' : ''
                      }`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-muted-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {/* Password requirements */}
                  {password && (
                    <div className="text-xs space-y-1 mt-2">
                      <p className={passwordChecks.minLength ? 'text-green-600' : 'text-muted-foreground'}>
                        {passwordChecks.minLength ? '✓' : '○'} At least {MIN_PASSWORD_LENGTH} characters
                      </p>
                      <p className={passwordChecks.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}>
                        {passwordChecks.hasUppercase ? '✓' : '○'} One uppercase letter
                      </p>
                      <p className={passwordChecks.hasLowercase ? 'text-green-600' : 'text-muted-foreground'}>
                        {passwordChecks.hasLowercase ? '✓' : '○'} One lowercase letter
                      </p>
                      <p className={passwordChecks.hasNumber ? 'text-green-600' : 'text-muted-foreground'}>
                        {passwordChecks.hasNumber ? '✓' : '○'} One number
                      </p>
                      <p className={passwordChecks.hasSpecial ? 'text-green-600' : 'text-muted-foreground'}>
                        {passwordChecks.hasSpecial ? '✓' : '○'} One special character
                      </p>
                    </div>
                  )}
                  {errors.password && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="mb-1">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...register('confirmPassword')}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className={`py-3 ${
                      errors.confirmPassword ? 'border-destructive' : ''
                    }`}
                  />
                  {confirmPassword && password !== confirmPassword && !errors.confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                  )}
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-2 pt-2">
                  <input
                    id="tos"
                    type="checkbox"
                    {...register('tosAccepted')}
                    className="mt-1"
                  />
                  <Label htmlFor="tos" className="text-sm text-muted-foreground dark:text-muted-foreground font-normal">
                    I agree to the{' '}
                    <Link to="/terms-of-service" target="_blank" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy-policy" target="_blank" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>
                {errors.tosAccepted && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.tosAccepted.message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={accepting}
                  className="w-full py-3"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Create Account & Accept'
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                    to={`/auth/login?redirect=${encodeURIComponent(`/subcontractor-portal/accept-invite?id=${invitationId}`)}`}
                    className="text-primary hover:underline"
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
