import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import {
  extractErrorCode,
  extractErrorDetails,
  extractErrorMessage,
  isNotFound,
} from '@/lib/errorHandling';
import { acceptInviteSchema, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logError } from '@/lib/logger';
import {
  AcceptInviteAlreadyAcceptedState,
  AcceptInviteErrorState,
  AcceptInviteFormError,
  AcceptInviteLoadingState,
  InvitationSummaryCard,
  PasswordRequirementsList,
} from './AcceptInvitePageSections';

type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;

interface RegisteredInviteUser {
  id: string;
  email: string;
  fullName?: string | null;
  role?: string;
  roleInCompany?: string;
  companyId?: string | null;
  companyName?: string | null;
}

export interface Invitation {
  id: string;
  companyName: string;
  projectName: string;
  headContractorName: string;
  primaryContactEmail: string;
  primaryContactName?: string;
  status: string;
  canAccept?: boolean;
}

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const explicitInvitationId = searchParams.get('id')?.trim() || null;
  const { user, loading: authLoading, refreshUser, setToken } = useAuth();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [discoveredInvitationId, setDiscoveredInvitationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mismatchInvitedEmail, setMismatchInvitedEmail] = useState<string | null>(null);
  const invitationId = explicitInvitationId || discoveredInvitationId;

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
  });

  // Watch password for real-time validation feedback
  const password = watch('password', '');
  const confirmPassword = watch('confirmPassword', '');

  // Password requirements (must match backend: 12+ chars, uppercase, lowercase, number, special)
  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= MIN_PASSWORD_LENGTH,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );

  // Fetch invitation details
  useEffect(() => {
    let cancelled = false;

    function applyInvitation(nextInvitation: Invitation) {
      setInvitation(nextInvitation);
      setDiscoveredInvitationId(nextInvitation.id);

      if (nextInvitation.primaryContactEmail) {
        setValue('email', nextInvitation.primaryContactEmail);
      }
      if (nextInvitation.primaryContactName) {
        setValue('fullName', nextInvitation.primaryContactName);
      }
    }

    async function fetchInvitation() {
      if (authLoading) {
        return;
      }

      setLoading(true);
      setError(null);

      if (!explicitInvitationId && !user) {
        setError('No invitation ID provided');
        setLoading(false);
        return;
      }

      try {
        if (explicitInvitationId) {
          const data = await apiFetch<{ invitation: Invitation }>(
            `/api/subcontractors/invitation/${encodeURIComponent(explicitInvitationId)}`,
          );
          if (!cancelled) {
            applyInvitation(data.invitation);
          }
          return;
        }

        const data = await apiFetch<{ invitation: Invitation | null }>(
          '/api/subcontractors/my-pending-invitation',
        );

        if (!data.invitation) {
          if (!cancelled) {
            setInvitation(null);
            setDiscoveredInvitationId(null);
            setError('No pending invitations found for your account.');
          }
          return;
        }

        if (!cancelled) {
          applyInvitation(data.invitation);
        }
      } catch (err) {
        if (!cancelled) {
          if (isNotFound(err)) {
            setError('This invitation was not found or has expired.');
          } else {
            setError(extractErrorMessage(err, 'Failed to load invitation details'));
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInvitation();
    return () => {
      cancelled = true;
    };
  }, [authLoading, explicitInvitationId, setValue, user]);

  // Handle accepting invitation for logged-in users.
  // `acknowledgeEmailMismatch` is sent on the second attempt after the user
  // confirms they want to use the account they're signed in with, even though
  // it differs from the invited contact email.
  const handleAcceptAsLoggedIn = async (acknowledgeEmailMismatch = false) => {
    if (!invitationId) return;

    setAccepting(true);
    setFormError(null);

    try {
      await apiFetch(`/api/subcontractors/invitation/${encodeURIComponent(invitationId)}/accept`, {
        method: 'POST',
        body: JSON.stringify({ acknowledgeEmailMismatch }),
      });

      // Refresh auth to get updated role
      await refreshUser();

      toast({
        title: 'Welcome!',
        description: `You've joined ${invitation?.companyName}. Let's get started!`,
        variant: 'success',
      });
      navigate('/subcontractor-portal');
    } catch (err) {
      // The invite was sent to a different email. Possession of the link is the
      // real check, so offer to accept with the signed-in account instead of a
      // dead-end.
      if (extractErrorCode(err) === 'EMAIL_MISMATCH') {
        const details = extractErrorDetails(err);
        const invitedEmailMasked = details?.invitedEmailMasked;
        setMismatchInvitedEmail(
          typeof invitedEmailMasked === 'string' && invitedEmailMasked ? invitedEmailMasked : null,
        );
        setAccepting(false);
        return;
      }

      logError('Error accepting invitation:', err);
      setFormError(extractErrorMessage(err, 'Failed to accept invitation. Please try again.'));
      setAccepting(false);
    }
  };

  // Handle registration and accepting invitation
  const onRegisterSubmit = async (data: AcceptInviteFormData) => {
    setFormError(null);
    setAccepting(true);

    try {
      const result = await apiFetch<{
        user: RegisteredInviteUser;
        token: string;
        company: { companyName: string };
      }>('/api/auth/register-and-accept-invitation', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          invitationId,
          tosAccepted: data.tosAccepted,
        }),
      });

      await setToken(result.token);

      toast({
        title: 'Account Created!',
        description: `You've joined ${result.company.companyName}.`,
        variant: 'success',
      });
      navigate('/subcontractor-portal', { replace: true });
    } catch (err) {
      logError('Error registering:', err);
      setFormError(extractErrorMessage(err, 'Failed to create account. Please try again.'));
      setAccepting(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return <AcceptInviteLoadingState />;
  }

  // Error state
  if (error || !invitation) {
    return <AcceptInviteErrorState error={error} />;
  }

  // Already accepted. A head contractor can approve the row before any portal user
  // accepts it, so only treat approved invites as closed when the API says they
  // are not acceptable.
  if (invitation.status === 'active' || invitation.canAccept === false) {
    return <AcceptInviteAlreadyAcceptedState isLoggedIn={Boolean(user)} />;
  }

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <span className="text-2xl font-bold text-primary">SiteProof</span>
        </div>

        <InvitationSummaryCard invitation={invitation} />

        {/* Action Card */}
        <div className="bg-card dark:bg-card rounded-lg shadow-md p-6">
          {user ? (
            mismatchInvitedEmail ? (
              // Invite was sent to a different email — confirm using this account.
              <div>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
                  This invitation was sent to{' '}
                  <strong className="dark:text-foreground">{mismatchInvitedEmail}</strong>. You're
                  signed in as <strong className="dark:text-foreground">{user.email}</strong>.
                  Accept the invitation with this account?
                </p>
                {formError && <AcceptInviteFormError message={formError} />}
                <Button
                  onClick={() => handleAcceptAsLoggedIn(true)}
                  disabled={accepting}
                  className="w-full py-3"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    'Yes, accept with this account'
                  )}
                </Button>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Wrong account?{' '}
                  <Link to="/login" className="text-primary hover:underline">
                    Log in with a different account
                  </Link>
                </p>
              </div>
            ) : (
              // Logged in - just accept
              <div>
                <p className="text-center text-sm text-muted-foreground dark:text-muted-foreground mb-4">
                  Logged in as <strong className="dark:text-foreground">{user.email}</strong>
                </p>
                {formError && <AcceptInviteFormError message={formError} />}
                <Button
                  onClick={() => handleAcceptAsLoggedIn()}
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
                  <Link to="/login" className="text-primary hover:underline">
                    Log in with a different account
                  </Link>
                </p>
              </div>
            )
          ) : (
            // Not logged in - show registration form
            <form onSubmit={handleSubmit(onRegisterSubmit)}>
              <h3 className="text-lg font-semibold dark:text-foreground mb-1">Create Account</h3>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
                Create your account to accept this invitation
              </p>

              {formError && <AcceptInviteFormError message={formError} />}

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
                    className={`py-3 ${errors.fullName ? 'border-destructive' : ''}`}
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
                    readOnly={!!invitation.primaryContactEmail}
                    aria-readonly={!!invitation.primaryContactEmail}
                    className={`py-3 ${
                      errors.email ? 'border-destructive' : ''
                    } ${invitation.primaryContactEmail ? 'bg-muted cursor-not-allowed' : ''}`}
                  />
                  {invitation.primaryContactEmail && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3 text-muted-foreground" />
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
                      className={`py-3 pr-10 ${errors.password ? 'border-destructive' : ''}`}
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
                    <PasswordRequirementsList
                      checks={passwordChecks}
                      minPasswordLength={MIN_PASSWORD_LENGTH}
                    />
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
                    className={`py-3 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                  />
                  {confirmPassword && password !== confirmPassword && !errors.confirmPassword && (
                    <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                  )}
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-2 pt-2">
                  <input id="tos" type="checkbox" {...register('tosAccepted')} className="mt-1" />
                  <Label
                    htmlFor="tos"
                    className="text-sm text-muted-foreground dark:text-muted-foreground font-normal"
                  >
                    I agree to the{' '}
                    <Link
                      to="/terms-of-service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      to="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Privacy Policy
                    </Link>
                  </Label>
                </div>
                {errors.tosAccepted && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.tosAccepted.message}
                  </p>
                )}

                <Button type="submit" disabled={accepting} className="w-full py-3">
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
                    to={`/login?redirect=${encodeURIComponent(`/subcontractor-portal/accept-invite?id=${invitationId}`)}`}
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
  );
}
