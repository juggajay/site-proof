import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Company } from '../companySettingsData';

interface CompanyXeroExportSectionProps {
  company: Company | null;
  onCompanyUpdated: (company: Company) => void;
}

/**
 * Wave F / F2 — the Xero CSV export's account code and GST rate name, company
 * scoped. The account code used to live in one user's `localStorage`, so two
 * people at the same company could export the same claim under different codes
 * and only discover it in their ledger. The tax rate was never settable at all.
 *
 * Deliberately not here: the payment due date. That is a boundary question
 * (decision D8), not configuration, and F2 leaves it exactly as it is.
 */
export function CompanyXeroExportSection({
  company,
  onCompanyUpdated,
}: CompanyXeroExportSectionProps) {
  const [accountCode, setAccountCode] = useState('');
  const [taxType, setTaxType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    setAccountCode(company?.xeroAccountCode ?? '');
    setTaxType(company?.xeroTaxType ?? '');
  }, [company?.xeroAccountCode, company?.xeroTaxType]);

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    setStatus('');

    try {
      // PATCH is partial — this touches only the two Xero fields.
      const data = await apiFetch<{ company: Company }>('/api/company', {
        method: 'PATCH',
        body: JSON.stringify({
          xeroAccountCode: accountCode.trim() || null,
          xeroTaxType: taxType.trim() || null,
        }),
      });
      onCompanyUpdated(data.company);
      setStatus('Xero export settings saved.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save Xero export settings'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Xero invoice export</h2>
          <p className="text-sm text-muted-foreground">
            Used by every claim exported to Xero from this company. Leave blank to use the defaults.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="xero-account-code">Income account code</Label>
          <Input
            id="xero-account-code"
            value={accountCode}
            placeholder="200"
            onChange={(event) => setAccountCode(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The sales account code from your Xero chart of accounts. Defaults to 200.
          </p>
        </div>
        <div>
          <Label htmlFor="xero-tax-type">GST rate name</Label>
          <Input
            id="xero-tax-type"
            value={taxType}
            placeholder="GST on Income"
            onChange={(event) => setTaxType(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Must match the rate name in your Xero chart exactly, or the import will not apply it.
            Defaults to GST on Income.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="mt-4 text-sm text-success" role="status">
          {status}
        </p>
      ) : null}

      <div className="mt-4">
        <Button type="button" onClick={handleSave} disabled={saving || !company}>
          {saving ? 'Saving…' : 'Save Xero settings'}
        </Button>
      </div>
    </section>
  );
}
