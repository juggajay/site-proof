import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';

interface CompanyOnboardingResponse {
  company: {
    id: string;
    name: string;
    abn: string | null;
    address: string | null;
    subscriptionTier: string;
  };
}

const COMPANY_CREATED_REFRESH_FAILED_MESSAGE =
  "Company was created, but we couldn't refresh your session. Please reload and continue.";

export function CompanyOnboardingPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [abn, setAbn] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = companyName.trim();
    const trimmedAbn = abn.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      setError('Company name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiFetch<CompanyOnboardingResponse>('/api/company', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          abn: trimmedAbn,
          address: trimmedAddress,
        }),
      });

      let refreshedUser = null;
      try {
        refreshedUser = await refreshUser();
      } catch {
        refreshedUser = null;
      }

      if (!refreshedUser?.companyId) {
        setError(COMPANY_CREATED_REFRESH_FAILED_MESSAGE);
        return;
      }

      navigate('/projects', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to create company'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Set up your company
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create the head contractor company profile that will own projects, users, lots, and
            claim records in CIVOS.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-md border border-border bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Acme Civil Pty Ltd"
              autoComplete="organization"
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-abn">ABN</Label>
            <Input
              id="company-abn"
              value={abn}
              onChange={(event) => setAbn(event.target.value)}
              placeholder="Optional"
              inputMode="numeric"
              autoComplete="off"
              maxLength={32}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-address">Business address</Label>
            <Textarea
              id="company-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Optional"
              rows={3}
              maxLength={300}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              You will become the company owner and can invite the rest of your team after setup.
            </p>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Create Company
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
