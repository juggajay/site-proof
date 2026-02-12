import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { emailSchema } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const resendSchema = z.object({ email: emailSchema })
type ResendFormData = z.infer<typeof resendSchema>

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading')
  const [message, setMessage] = useState('')

  // For resend functionality
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [resendMessage, setResendMessage] = useState('')

  // RHF for the resend form (used in both no-token and error states)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResendFormData>({
    resolver: zodResolver(resendSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  })

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
      const statusData = await apiFetch<{ alreadyVerified?: boolean; valid?: boolean; message?: string; email?: string }>(`/api/auth/verify-email-status?token=${verificationToken}`)

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

      if (statusData.email) {
        setValue('email', statusData.email)
      }

      // Now verify the email
      const data = await apiFetch<{ verified?: boolean; message?: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verificationToken }),
      })

      if (data.verified) {
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

  const onResend = async (data: ResendFormData) => {
    setResendStatus('loading')
    try {
      const result = await apiFetch<{ message: string }>('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: data.email }),
      })

      setResendStatus('success')
      setResendMessage(result.message)
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

        <form onSubmit={handleSubmit(onResend)} className="space-y-4">
          <div>
            <Label htmlFor="email">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              className={`mt-1 ${
                errors.email ? 'border-destructive' : ''
              }`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
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

          <Button
            type="submit"
            disabled={resendStatus === 'loading'}
            className="w-full"
          >
            {resendStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              'Send Verification Link'
            )}
          </Button>
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

        <form onSubmit={handleSubmit(onResend)} className="mt-4 space-y-3">
          <Input
            type="email"
            {...register('email')}
            className={errors.email ? 'border-destructive' : ''}
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}

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

          <Button
            type="submit"
            disabled={resendStatus === 'loading'}
            className="w-full"
          >
            {resendStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              'Resend Verification Link'
            )}
          </Button>
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
