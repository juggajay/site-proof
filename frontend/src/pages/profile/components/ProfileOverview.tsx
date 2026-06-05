import { Building2, Calendar, LogOut, Mail, Phone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ProfileOverviewUser = {
  email?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  role?: string;
  companyId?: string | null;
  companyName?: string | null;
  createdAt?: string;
  avatarUrl?: string | null;
};

type ProfileOverviewProps = {
  user: ProfileOverviewUser | null;
  loggingOutAll: boolean;
  onChangePassword: () => void;
  onEditProfile: () => void;
  onLogoutAllDevices: () => void;
};

function formatRole(role: string) {
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getDisplayName(user: ProfileOverviewUser | null) {
  return user?.name || user?.fullName || user?.email?.split('@')[0] || 'User';
}

function getInitial(user: ProfileOverviewUser | null) {
  return getDisplayName(user).charAt(0).toUpperCase();
}

function getCompanyLabel(user: ProfileOverviewUser | null) {
  return user?.companyName || (user?.companyId ? 'Company assigned' : 'No company assigned');
}

function getMemberSinceLabel(createdAt?: string) {
  if (!createdAt) return 'Unknown';

  return new Date(createdAt).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ProfileOverview({
  user,
  loggingOutAll,
  onChangePassword,
  onEditProfile,
  onLogoutAllDevices,
}: ProfileOverviewProps) {
  const displayRole = user?.role ? formatRole(user.role) : 'User';

  return (
    <>
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <div className="flex items-start gap-6">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-3xl font-bold">{getInitial(user)}</span>
              </div>
            )}

            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-semibold">{getDisplayName(user)}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                <Shield className="h-3 w-3" />
                {displayRole}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t">
          <dl className="divide-y">
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Mail className="h-4 w-4" />
                Email
              </dt>
              <dd className="text-sm">{user?.email}</dd>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Phone className="h-4 w-4" />
                Phone
              </dt>
              <dd className="text-sm">{user?.phone || 'Not set'}</dd>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Shield className="h-4 w-4" />
                Role
              </dt>
              <dd className="text-sm">{displayRole}</dd>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Building2 className="h-4 w-4" />
                Company
              </dt>
              <dd className="text-sm">{getCompanyLabel(user)}</dd>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Calendar className="h-4 w-4" />
                Member since
              </dt>
              <dd className="text-sm">{getMemberSinceLabel(user?.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Account Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={onChangePassword}>
            Change Password
          </Button>
          <Button type="button" variant="outline" onClick={onEditProfile}>
            Edit Profile
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onLogoutAllDevices}
            disabled={loggingOutAll}
          >
            <LogOut className="h-4 w-4" />
            {loggingOutAll ? 'Logging out...' : 'Logout All Devices'}
          </Button>
        </div>
      </div>
    </>
  );
}
