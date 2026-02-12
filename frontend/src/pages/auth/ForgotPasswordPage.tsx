import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'
import { emailSchema } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const forgotPasswordSchema = z.object({ email: emailSchema })
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: data.email }),
      })

      setSentEmail(data.email)
      setSent(true)
    } catch (err) {
      setError('root', { message: 'Failed to send reset email. Please try again.' })
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-bold">Check Your Email</h2>
        <p className="text-muted-foreground">
          We've sent a password reset link to {sentEmail}
        </p>
        <Link to="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-2xl font-bold">Reset Password</h2>
      <p className="text-sm text-muted-foreground">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {errors.root?.message && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      <div>
        <Label htmlFor="email">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          className={`mt-1 ${
            errors.email ? 'border-destructive' : ''
          }`}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Sending...' : 'Send Reset Link'}
      </Button>

      <Link
        to="/login"
        className="block text-center text-sm text-primary hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  )
}
