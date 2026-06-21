// Presentational subscription tier / project usage / user usage cluster for
// CompanySettingsPage. Rendered inside the page's existing
// `grid gap-4 sm:grid-cols-2` container, so it returns a fragment of grid
// children. All company fetch/save/upload/transfer/member behavior stays in
// the page; this only reads the loaded company record.
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatLimit, hasFiniteLimit, type Company } from '../companySettingsData';

interface CompanyUsageSectionProps {
  company: Company | null;
}

export function CompanyUsageSection({ company }: CompanyUsageSectionProps) {
  return (
    <>
      <div>
        <Label htmlFor="company-settings-subscription-tier" className="mb-1">
          Subscription Tier
        </Label>
        <Input
          id="company-settings-subscription-tier"
          type="text"
          value={
            (company?.subscriptionTier || 'basic').charAt(0).toUpperCase() +
            (company?.subscriptionTier || 'basic').slice(1)
          }
          className="bg-muted capitalize"
          disabled
        />
        <p className="text-xs text-muted-foreground mt-1">Contact support to upgrade</p>
      </div>

      <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center justify-between">
          <div>
            <Label>Project Usage</Label>
            <p className="text-sm text-muted-foreground">
              {company?.projectCount || 0} of {formatLimit(company?.projectLimit, 3)} projects used
            </p>
          </div>
          <div className="text-right">
            {hasFiniteLimit(company?.projectLimit) && company?.projectCount !== undefined && (
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    company.projectCount >= company.projectLimit
                      ? 'bg-destructive'
                      : company.projectCount >= company.projectLimit * 0.8
                        ? 'bg-warning'
                        : 'bg-success'
                  }`}
                  style={{
                    width: `${Math.min((company.projectCount / company.projectLimit) * 100, 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
        {hasFiniteLimit(company?.projectLimit) &&
          company?.projectCount !== undefined &&
          company.projectCount >= company.projectLimit && (
            <p className="text-sm text-destructive mt-2">
              You've reached your project limit. Upgrade your plan to create more projects.
            </p>
          )}
      </div>

      <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center justify-between">
          <div>
            <Label>User Usage</Label>
            <p className="text-sm text-muted-foreground">
              {company?.userCount || 0} of {formatLimit(company?.userLimit, 5)} users in company
            </p>
          </div>
          <div className="text-right">
            {hasFiniteLimit(company?.userLimit) && company?.userCount !== undefined && (
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    company.userCount >= company.userLimit
                      ? 'bg-destructive'
                      : company.userCount >= company.userLimit * 0.8
                        ? 'bg-warning'
                        : 'bg-success'
                  }`}
                  style={{
                    width: `${Math.min((company.userCount / company.userLimit) * 100, 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
        {hasFiniteLimit(company?.userLimit) &&
          company?.userCount !== undefined &&
          company.userCount >= company.userLimit && (
            <p className="text-sm text-destructive mt-2">
              You've reached your user limit. Remove inactive team members, cancel pending
              invitations, or upgrade your plan to add more people.
            </p>
          )}
      </div>
    </>
  );
}
