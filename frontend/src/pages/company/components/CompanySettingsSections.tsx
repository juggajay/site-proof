import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import { Building2, Crown, DollarSign, Loader2, Save, Upload, UserCog, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supportMailtoHref } from '@/lib/contactLinks';
import {
  formatLimit,
  getPlanBillingLabel,
  getPlanStorageLabel,
  type Company,
  type CompanyFormData,
} from '../companySettingsData';
import { CompanyUsageSection } from './CompanyUsageSection';

interface CompanyInformationCardProps {
  company: Company | null;
  formData: CompanyFormData;
  saving: boolean;
  logoUploading: boolean;
  saveError: string;
  statusMessage: string;
  logoInputRef: RefObject<HTMLInputElement>;
  onFormDataChange: Dispatch<SetStateAction<CompanyFormData>>;
  onLogoUpload: () => void;
  onLogoFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveSettings: () => void;
}

export function CompanyInformationCard({
  company,
  formData,
  saving,
  logoUploading,
  saveError,
  statusMessage,
  logoInputRef,
  onFormDataChange,
  onLogoUpload,
  onLogoFileChange,
  onSaveSettings,
}: CompanyInformationCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Information
        </h2>
        <p className="text-sm text-muted-foreground">Update your company details.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="company-settings-name" className="mb-1">
            Company Name *
          </Label>
          <Input
            id="company-settings-name"
            type="text"
            value={formData.name}
            onChange={(e) => onFormDataChange((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Enter company name"
            disabled={saving}
          />
        </div>

        <div>
          <Label htmlFor="company-settings-abn" className="mb-1">
            ABN
          </Label>
          <Input
            id="company-settings-abn"
            type="text"
            value={formData.abn}
            onChange={(e) => onFormDataChange((prev) => ({ ...prev, abn: e.target.value }))}
            placeholder="51 824 753 556"
            disabled={saving}
          />
        </div>

        <CompanyUsageSection company={company} />

        <div className="sm:col-span-2">
          <Label htmlFor="company-settings-address" className="mb-1">
            Address
          </Label>
          <Textarea
            id="company-settings-address"
            value={formData.address}
            onChange={(e) => onFormDataChange((prev) => ({ ...prev, address: e.target.value }))}
            className="min-h-[80px]"
            placeholder="Enter company address"
            disabled={saving}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="company-logo-upload" className="mb-2">
          Company Logo
        </Label>
        <input
          id="company-logo-upload"
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          onChange={onLogoFileChange}
          className="hidden"
        />
        <div className="flex items-center gap-4">
          {formData.logoUrl ? (
            <div className="relative h-20 w-20 rounded-lg border overflow-hidden group">
              <img
                src={formData.logoUrl}
                alt="Company logo"
                className="h-full w-full object-contain"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => onFormDataChange((prev) => ({ ...prev, logoUrl: '' }))}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                aria-label="Remove company logo"
                title="Remove logo"
                disabled={saving || logoUploading}
              >
                <X className="h-6 w-6 text-white" />
              </Button>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={onLogoUpload} disabled={logoUploading}>
              {logoUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {formData.logoUrl ? 'Change Logo' : 'Upload Logo'}
                </>
              )}
            </Button>
            {formData.logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onFormDataChange((prev) => ({ ...prev, logoUrl: '' }))}
                className="text-destructive hover:text-destructive"
                disabled={saving || logoUploading}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Recommended: Square image, PNG or JPG, max 2MB. Appears on branded PDF reports where
          supported.
        </p>
      </div>

      {saveError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive"
        >
          {saveError}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="rounded-md bg-success/10 border border-success/20 p-3 text-sm text-success"
        >
          {statusMessage}
        </div>
      )}

      <Button type="button" onClick={onSaveSettings} disabled={saving || logoUploading}>
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}

export function CompanyAccountInformationCard({ company }: { company: Company | null }) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Account Information</h2>
        <p className="text-sm text-muted-foreground">Your company account details.</p>
      </div>

      <div className="text-sm space-y-2">
        <div className="flex justify-between py-2 border-b">
          <span className="text-muted-foreground">Company ID</span>
          <span className="font-mono text-xs">{company?.id}</span>
        </div>
        <div className="flex justify-between py-2 border-b">
          <span className="text-muted-foreground">Created</span>
          <span>
            {company?.createdAt ? new Date(company.createdAt).toLocaleDateString('en-AU') : '-'}
          </span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-muted-foreground">Last Updated</span>
          <span>
            {company?.updatedAt ? new Date(company.updatedAt).toLocaleDateString('en-AU') : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

interface CompanyBillingSectionProps {
  company: Company | null;
  supportEmail: string;
}

export function CompanyBillingSection({ company, supportEmail }: CompanyBillingSectionProps) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4" data-testid="billing-section">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Billing & Subscription
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing details.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-lg bg-muted/50 border">
          <Label>Current Plan</Label>
          <p className="text-2xl font-bold capitalize mt-1">
            {company?.subscriptionTier || 'Basic'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {getPlanBillingLabel(company?.subscriptionTier)}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/50 border">
          <Label>Billing Support</Label>
          <p className="text-lg font-semibold mt-1">Managed with SiteProof</p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact billing for invoices or payment method changes.
          </p>
        </div>

        <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
          <Label className="mb-2">Plan Limits</Label>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Projects</span>
              <span>
                {company?.projectCount || 0} / {formatLimit(company?.projectLimit, 3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Team Members</span>
              <span>
                {company?.userCount || 0} / {formatLimit(company?.userLimit, 5)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Storage</span>
              <span>{getPlanStorageLabel(company?.subscriptionTier)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button asChild>
          <a href={supportMailtoHref(supportEmail, 'Add SiteProof capacity')}>
            Contact Us to Add Capacity
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={supportMailtoHref(supportEmail, 'SiteProof billing inquiry')}>
            Manage Payment Method
          </a>
        </Button>
      </div>
    </div>
  );
}

export function TransferOwnershipCard({
  onOpenTransferModal,
}: {
  onOpenTransferModal: () => void;
}) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
          <Crown className="h-5 w-5 text-warning" />
          Transfer Ownership
        </h2>
        <p className="text-sm text-muted-foreground">
          Transfer company ownership to another team member.
        </p>
      </div>

      <div className="text-sm text-foreground space-y-2">
        <p>
          <strong>Warning:</strong> Transferring ownership will:
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Make another user the company owner</li>
          <li>Change your role to Admin</li>
          <li>Cannot be undone without the new owner's consent</li>
        </ul>
      </div>

      <Button type="button" variant="outline" onClick={onOpenTransferModal}>
        <UserCog className="h-4 w-4" />
        Transfer Ownership
      </Button>
    </div>
  );
}
