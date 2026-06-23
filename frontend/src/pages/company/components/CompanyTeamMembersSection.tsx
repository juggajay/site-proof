import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import {
  COMPANY_MEMBER_ROLE_OPTIONS,
  formatCompanyRoleLabel,
  type CompanyMember,
  type CompanyMemberInviteResponse,
} from '../companySettingsData';

interface CompanyMembersResponse {
  members: CompanyMember[];
}

interface CompanyMemberRemoveResponse {
  memberId: string;
  status: 'removed' | 'cancelled';
}

interface CompanyTeamMembersSectionProps {
  currentUserId?: string;
}

const defaultInviteForm = {
  email: '',
  fullName: '',
  roleInCompany: 'foreman',
};

function getMemberStatus(member: CompanyMember): 'active' | 'pending' {
  if (member.status === 'active' || member.status === 'pending') {
    return member.status;
  }
  return member.hasPassword === false ? 'pending' : 'active';
}

export function CompanyTeamMembersSection({ currentUserId }: CompanyTeamMembersSectionProps) {
  const queryClient = useQueryClient();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState(defaultInviteForm);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CompanyMember | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [removeSuccess, setRemoveSuccess] = useState('');
  const [removing, setRemoving] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [roleChangeError, setRoleChangeError] = useState('');
  const invitingRef = useRef(false);
  const removingRef = useRef(false);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    setMembersError('');

    try {
      const data = await apiFetch<CompanyMembersResponse>('/api/company/members');
      setMembers(data.members);
    } catch (error) {
      setMembers([]);
      setMembersError(extractErrorMessage(error, 'Failed to load company members'));
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const openInviteModal = () => {
    setInviteForm(defaultInviteForm);
    setInviteError('');
    setInviteSuccess('');
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    if (invitingRef.current) return;
    setShowInviteModal(false);
    setInviteError('');
    setInviteSuccess('');
  };

  const openRemoveModal = (member: CompanyMember) => {
    setRemoveTarget(member);
    setRemoveError('');
    setRemoveSuccess('');
  };

  const closeRemoveModal = () => {
    if (removingRef.current) return;
    setRemoveTarget(null);
    setRemoveError('');
  };

  const handleInvite = async () => {
    if (invitingRef.current) return;

    const email = inviteForm.email.trim().toLowerCase();
    const fullName = inviteForm.fullName.trim();
    if (!email) {
      setInviteError('Email is required');
      return;
    }

    invitingRef.current = true;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      const data = await apiFetch<CompanyMemberInviteResponse>('/api/company/members/invite', {
        method: 'POST',
        body: JSON.stringify({
          email,
          fullName: fullName || undefined,
          roleInCompany: inviteForm.roleInCompany,
        }),
      });

      setMembers((current) => {
        const next = current.filter((member) => member.id !== data.member.id);
        return [...next, data.member].sort((a, b) =>
          (a.fullName || a.email).localeCompare(b.fullName || b.email),
        );
      });
      setInviteSuccess(
        data.invitation.setupRequired
          ? `Invitation sent to ${email}. They'll appear as pending until they set a password.`
          : `${email} is already active in your company.`,
      );
      setInviteForm(defaultInviteForm);
      void queryClient.invalidateQueries({ queryKey: queryKeys.companySettings });
    } catch (error) {
      setInviteError(extractErrorMessage(error, 'Failed to invite company member'));
    } finally {
      invitingRef.current = false;
      setInviting(false);
    }
  };

  // H23: change a member's company role. The control is only offered for other
  // non-owner members (the owner's role moves via transfer-ownership, and you
  // cannot change your own role); the backend enforces all three.
  const handleChangeRole = async (member: CompanyMember, nextRole: string) => {
    if (nextRole === member.roleInCompany || changingRoleId) return;

    setChangingRoleId(member.id);
    setRoleChangeError('');
    try {
      await apiFetch(`/api/company/members/${encodeURIComponent(member.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ roleInCompany: nextRole }),
      });
      setMembers((current) =>
        current.map((entry) =>
          entry.id === member.id ? { ...entry, roleInCompany: nextRole } : entry,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.companySettings });
    } catch (error) {
      setRoleChangeError(extractErrorMessage(error, 'Failed to change member role'));
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget || removingRef.current) return;

    const target = removeTarget;
    const status = getMemberStatus(target);
    removingRef.current = true;
    setRemoving(true);
    setRemoveError('');
    setRemoveSuccess('');

    try {
      const data = await apiFetch<CompanyMemberRemoveResponse>(
        `/api/company/members/${encodeURIComponent(target.id)}`,
        {
          method: 'DELETE',
        },
      );

      setMembers((current) => current.filter((member) => member.id !== data.memberId));
      setRemoveSuccess(
        data.status === 'cancelled'
          ? `Invitation cancelled for ${target.email}.`
          : `${target.fullName || target.email} was removed from the company.`,
      );
      setRemoveTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.companySettings });
    } catch (error) {
      setRemoveError(
        extractErrorMessage(
          error,
          status === 'pending' ? 'Failed to cancel invitation' : 'Failed to remove member',
        ),
      );
    } finally {
      removingRef.current = false;
      setRemoving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </h2>
          <p className="text-sm text-muted-foreground">
            Add people to your company before assigning them to projects.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void loadMembers()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" onClick={openInviteModal}>
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </div>

      {membersError && (
        <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {membersError}
        </div>
      )}
      {removeSuccess && (
        <div role="status" className="rounded-md bg-success/10 p-3 text-sm text-success">
          {removeSuccess}
        </div>
      )}

      {loadingMembers ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading team members...
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 font-medium">No team members yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite your first project manager, foreman, or site engineer.
          </p>
          <Button type="button" onClick={openInviteModal} className="mt-4">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.7fr)_minmax(96px,0.5fr)_minmax(96px,0.4fr)] bg-muted/50 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
            <span>Member</span>
            <span>Role</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y">
            {members.map((member) => {
              const status = getMemberStatus(member);
              const isCurrentUser = member.id === currentUserId;
              const canRemove = !isCurrentUser && member.roleInCompany !== 'owner';
              // Same gate as removal: not yourself and not the owner.
              const canChangeRole = canRemove;
              return (
                <div
                  key={member.id}
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.7fr)_minmax(96px,0.5fr)_minmax(96px,0.4fr)] items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {member.fullName || member.email}
                      {isCurrentUser ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                  </div>
                  <div>
                    {canChangeRole ? (
                      <select
                        aria-label={`Change role for ${member.fullName || member.email}`}
                        value={member.roleInCompany}
                        disabled={changingRoleId === member.id}
                        onChange={(event) => void handleChangeRole(member, event.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50"
                      >
                        {COMPANY_MEMBER_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatCompanyRoleLabel(member.roleInCompany)
                    )}
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        status === 'active'
                          ? 'bg-success/10 text-success'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {status === 'active' ? 'Active' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    {canRemove ? (
                      <Button
                        type="button"
                        variant={status === 'pending' ? 'outline' : 'destructive'}
                        size="sm"
                        onClick={() => openRemoveModal(member)}
                        title={status === 'pending' ? 'Cancel invitation' : 'Remove member'}
                      >
                        <Trash2 className="h-4 w-4" />
                        {status === 'pending' ? 'Cancel' : 'Remove'}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {isCurrentUser ? 'You' : 'Owner'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {roleChangeError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {roleChangeError}
        </p>
      ) : null}

      {showInviteModal && (
        <Modal onClose={closeInviteModal} className="max-w-md">
          <ModalHeader>Invite Company Member</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="company-member-email">Email *</Label>
                <Input
                  id="company-member-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="person@example.com"
                  disabled={inviting}
                />
              </div>
              <div>
                <Label htmlFor="company-member-full-name">Full Name</Label>
                <Input
                  id="company-member-full-name"
                  type="text"
                  value={inviteForm.fullName}
                  onChange={(event) =>
                    setInviteForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                  placeholder="Optional"
                  disabled={inviting}
                />
              </div>
              <div>
                <Label htmlFor="company-member-role">Company Role</Label>
                <select
                  id="company-member-role"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  value={inviteForm.roleInCompany}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      roleInCompany: event.target.value,
                    }))
                  }
                  disabled={inviting}
                >
                  {COMPANY_MEMBER_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                The invitee will receive a setup link and appear as pending until they set their
                password.
              </p>
              {inviteError && (
                <div
                  role="alert"
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div role="status" className="rounded-md bg-success/10 p-3 text-sm text-success">
                  {inviteSuccess}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={closeInviteModal} disabled={inviting}>
              Close
            </Button>
            <Button
              type="button"
              onClick={handleInvite}
              disabled={inviting || !inviteForm.email.trim()}
            >
              {inviting ? 'Sending...' : 'Send Invite'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {removeTarget && (
        <Modal onClose={closeRemoveModal} className="max-w-md">
          <ModalHeader>
            {getMemberStatus(removeTarget) === 'pending'
              ? 'Cancel Company Invitation'
              : 'Remove Company Member'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {getMemberStatus(removeTarget) === 'pending'
                  ? `Cancel the pending invitation for ${removeTarget.email}? They will no longer count toward your user limit.`
                  : `Remove ${removeTarget.fullName || removeTarget.email} from this company and all company projects?`}
              </p>
              {removeError && (
                <div
                  role="alert"
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {removeError}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={closeRemoveModal} disabled={removing}>
              Close
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleRemoveMember()}
              disabled={removing}
            >
              {removing
                ? 'Working...'
                : getMemberStatus(removeTarget) === 'pending'
                  ? 'Cancel Invitation'
                  : 'Remove Member'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
