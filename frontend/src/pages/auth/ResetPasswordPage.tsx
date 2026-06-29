import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, CheckCircle, Lock, X } from 'lucide-react';
import { resetPasswordSchema, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
type ResetTokenValidationResponse = {
  valid: boolean;
  message?: string;
  requiresTosAcceptance?: boolean;
};

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => searchParams.get('token'));

  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [canRetryValidation, setCanRetryValidation] = useState(false);
  const [requiresTosAcceptance, setRequiresTosAcceptance] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const handledRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Watch password for real-time validation feedback
  const password = watch('password', '');

  const passwordValidation = useMemo(
    () => ({
      minLength: password.length >= MIN_PASSWORD_LENGTH,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );

  const validateToken = useCallback(async () => {
    setValidating(true);
    setTokenValid(false);
    setTokenError('');
    setCanRetryValidation(false);

    if (!token) {
      setTokenError('No reset token provided');
      setValidating(false);
      return;
    }

    try {
      window.history.replaceState(null, document.title, '/reset-password');

      const data = await apiFetch<ResetTokenValidationResponse>(
        `/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`,
      );

      if (data.valid) {
        setTokenValid(true);
        setRequiresTosAcceptance(data.requiresTosAcceptance === true);
      } else {
        setTokenError(data.message || 'Invalid or expired reset token');
      }
    } catch {
      setTokenError('Failed to validate token. Please try again.');
      setCanRetryValidation(true);
    } finally {
      setValidating(false);
    }
  }, [token]);

  // Validate token on mount
  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    validateToken();
  }, [validateToken]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (requiresTosAcceptance && !tosAccepted) {
      setError('root', {
        message: 'You must accept the Terms of Service to activate your account.',
      });
      return;
    }

    setLoading(true);

    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password: data.password,
          ...(requiresTosAcceptance ? { tosAccepted } : {}),
        }),
      });

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    } catch {
      setError('root', { message: 'Failed to reset password. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (validating) {
    return (
      <div className="space-y-4 text-center" role="status" aria-label="Validating reset link">
        <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
        <p className="text-muted-foreground">Validating reset link...</p>
      </div>
    );
  }

  // Invalid or expired token
  if (!tokenValid) {
    return (
      <div className="space-y-4 text-center" role="alert">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Lock className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-destructive">Invalid Reset Link</h2>
        <p className="text-muted-foreground">{tokenError}</p>
        <div className="space-y-2 pt-4">
          {canRetryValidation && (
            <Button type="button" onClick={validateToken} className="w-full">
              Try Again
            </Button>
          )}
          <Link
            to="/forgot-password"
            className="block w-full rounded-lg bg-primary py-2 text-center text-primary-foreground hover:bg-primary/90"
          >
            Request New Reset Link
          </Link>
          <Link to="/login" className="block text-center text-sm text-foreground hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-success" />
        <h2 className="text-2xl font-bold text-success">Password Reset Successfully!</h2>
        <p className="text-muted-foreground">
          Your password has been updated. Redirecting to login...
        </p>
        <Link to="/login" className="block text-center text-sm text-foreground hover:underline">
          Click here if not redirected
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-2xl font-bold">Create New Password</h2>
      <p className="text-sm text-muted-foreground">
        Enter your new password below. Password must be at least {MIN_PASSWORD_LENGTH} characters
        with uppercase, lowercase, a number, and a special character.
      </p>

      {errors.root?.message && (
        <div
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {errors.root.message}
        </div>
      )}

      <div>
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className={`mt-1 ${errors.password ? 'border-destructive' : ''}`}
          placeholder="Enter new password"
        />
        {password && (
          <div className="mt-2 space-y-1 text-xs">
            <div
              className={`flex items-center gap-1 ${passwordValidation.minLength ? 'text-success' : 'text-muted-foreground'}`}
            >
              {passwordValidation.minLength ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              At least {MIN_PASSWORD_LENGTH} characters
            </div>
            <div
              className={`flex items-center gap-1 ${passwordValidation.hasUppercase ? 'text-success' : 'text-muted-foreground'}`}
            >
              {passwordValidation.hasUppercase ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              One uppercase letter
            </div>
            <div
              className={`flex items-center gap-1 ${passwordValidation.hasLowercase ? 'text-success' : 'text-muted-foreground'}`}
            >
              {passwordValidation.hasLowercase ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              One lowercase letter
            </div>
            <div
              className={`flex items-center gap-1 ${passwordValidation.hasNumber ? 'text-success' : 'text-muted-foreground'}`}
            >
              {passwordValidation.hasNumber ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              One number
            </div>
            <div
              className={`flex items-center gap-1 ${passwordValidation.hasSpecial ? 'text-success' : 'text-muted-foreground'}`}
            >
              {passwordValidation.hasSpecial ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              One special character
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
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          className={`mt-1 ${errors.confirmPassword ? 'border-destructive' : ''}`}
          placeholder="Confirm new password"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {requiresTosAcceptance && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <input
              id="tosAccepted"
              type="checkbox"
              checked={tosAccepted}
              onChange={(event) => setTosAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-primary text-primary focus:ring-primary"
            />
            <label htmlFor="tosAccepted" className="text-sm">
              I accept the{' '}
              <Link
                to="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline"
              >
                Privacy Policy
              </Link>
            </label>
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Resetting Password...' : 'Reset Password'}
      </Button>

      <Link to="/login" className="block text-center text-sm text-foreground hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
