// Feature #443: React Hook Form with Zod validation
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth'
import { passwordSchema, MIN_PASSWORD_LENGTH } from '@/lib/validation'
import { Check, X, Mail, FileText } from 'lucide-react'

// Zod validation schema for registration
const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: passwordSchema,
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
  tosAccepted: z.boolean().refine(val => val === true, {
    message: 'You must accept the Terms of Service to create an account'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const { signUp } = useAuth()

  // React Hook Form with Zod resolver
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur', // Validate on blur
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      tosAccepted: false
    }
  })

  // Watch password for real-time validation feedback
  const password = watch('password', '')

  // Password validation rules (for visual feedback)
  const passwordValidation = useMemo(() => ({
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }), [password])

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true)

    try {
      await signUp(data.email, data.password, {
        firstName: data.firstName,
        lastName: data.lastName,
        tosAccepted: data.tosAccepted
      })
      // Show verification message instead of navigating to login
      setRegisteredEmail(data.email)
      setRegistrationSuccess(true)
    } catch (err: any) {
      // Set form-level error (could be improved with setError)
      console.error('Registration error:', err)
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-2xl font-bold">Create Account</h2>

      {/* Form-level errors can be shown here if needed */}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            {...register('firstName')}
            className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 ${
              errors.firstName ? 'border-destructive' : ''
            }`}
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {errors.firstName.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            {...register('lastName')}
            className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 ${
              errors.lastName ? 'border-destructive' : ''
            }`}
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 ${
            errors.email ? 'border-destructive' : ''
          }`}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register('password')}
          className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 ${
            errors.password ? 'border-destructive' : ''
          }`}
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
        {errors.password && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          {...register('confirmPassword')}
          className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 ${
            errors.confirmPassword ? 'border-destructive' : ''
          }`}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <input
            id="tosAccepted"
            type="checkbox"
            {...register('tosAccepted')}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
        {errors.tosAccepted && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {errors.tosAccepted.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
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
