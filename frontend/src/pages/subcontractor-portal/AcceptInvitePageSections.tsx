import { Link } from 'react-router-dom';
import { AlertCircle, Building2, Check, ClipboardCheck, Loader2, User } from 'lucide-react';
import type { Invitation } from './AcceptInvitePage';

export function AcceptInviteLoadingState() {
  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading invitation...</span>
      </div>
    </div>
  );
}

interface AcceptInviteErrorStateProps {
  error: string | null;
}

export function AcceptInviteErrorState({ error }: AcceptInviteErrorStateProps) {
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
            If you believe this is an error, please contact the head contractor who sent you the
            invitation.
          </p>
          <Link
            to="/login"
            className="inline-block px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted/50"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

interface AcceptInviteAlreadyAcceptedStateProps {
  isLoggedIn: boolean;
}

export function AcceptInviteAlreadyAcceptedState({
  isLoggedIn,
}: AcceptInviteAlreadyAcceptedStateProps) {
  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Invitation Already Accepted</h2>
          <p className="text-muted-foreground mb-4">This invitation has already been accepted.</p>
          {isLoggedIn ? (
            <Link
              to="/subcontractor-portal"
              className="inline-block px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Go to Portal
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-block px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Log In
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

interface InvitationSummaryCardProps {
  invitation: Invitation;
}

export function InvitationSummaryCard({ invitation }: InvitationSummaryCardProps) {
  return (
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
  );
}

interface AcceptInviteFormErrorProps {
  message: string;
}

export function AcceptInviteFormError({ message }: AcceptInviteFormErrorProps) {
  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}

export interface PasswordRequirementChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

interface PasswordRequirementsListProps {
  checks: PasswordRequirementChecks;
  minPasswordLength: number;
}

export function PasswordRequirementsList({
  checks,
  minPasswordLength,
}: PasswordRequirementsListProps) {
  const itemClassName = (isMet: boolean) => (isMet ? 'text-green-600' : 'text-muted-foreground');

  return (
    <div className="text-xs space-y-1 mt-2">
      <p className={itemClassName(checks.minLength)}>
        {checks.minLength ? '✓' : '○'} At least {minPasswordLength} characters
      </p>
      <p className={itemClassName(checks.hasUppercase)}>
        {checks.hasUppercase ? '✓' : '○'} One uppercase letter
      </p>
      <p className={itemClassName(checks.hasLowercase)}>
        {checks.hasLowercase ? '✓' : '○'} One lowercase letter
      </p>
      <p className={itemClassName(checks.hasNumber)}>{checks.hasNumber ? '✓' : '○'} One number</p>
      <p className={itemClassName(checks.hasSpecial)}>
        {checks.hasSpecial ? '✓' : '○'} One special character
      </p>
    </div>
  );
}
