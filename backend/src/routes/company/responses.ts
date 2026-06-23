import { buildCompanyLogoDisplayUrl } from './logoStorage.js';

type CompanyRecord = {
  id: string;
  name: string;
  abn: string | null;
  address: string | null;
  logoUrl: string | null;
  subscriptionTier: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CompanyUserRecord = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  roleInCompany: string;
  companyId: string | null;
  avatarUrl: string | null;
  passwordHash?: string | null;
};

type CompanyProfileLimits = {
  projectCount: number;
  projectLimit: number | null;
  userCount: number;
  userLimit: number | null;
};

type CompanyMember = {
  id: string;
  email: string;
  fullName: string | null;
  roleInCompany: string;
  passwordHash?: string | null;
  oauthProvider?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type NewOwner = {
  id: string;
  email: string;
  fullName: string | null;
};

function serializeCompanyLogo<TCompany extends CompanyRecord>(company: TCompany): TCompany {
  return {
    ...company,
    logoUrl: buildCompanyLogoDisplayUrl(company.id, company.logoUrl),
  };
}

export function buildCompanyCreatedResponse(company: CompanyRecord, user: CompanyUserRecord) {
  const serializedCompany = serializeCompanyLogo(company);

  return {
    company: serializedCompany,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.roleInCompany,
      roleInCompany: user.roleInCompany,
      companyId: user.companyId,
      companyName: serializedCompany.name,
      avatarUrl: user.avatarUrl,
      hasPassword: Boolean(user.passwordHash),
    },
  };
}

export function buildCompanyProfileResponse(company: CompanyRecord, limits: CompanyProfileLimits) {
  return {
    company: {
      ...serializeCompanyLogo(company),
      projectCount: limits.projectCount,
      projectLimit: limits.projectLimit,
      userCount: limits.userCount,
      userLimit: limits.userLimit,
    },
  };
}

export function buildCompanyLeftResponse(leftAt: Date) {
  return {
    message: 'Successfully left the company',
    leftAt: leftAt.toISOString(),
  };
}

export function buildCompanyMembersResponse(members: CompanyMember[]) {
  return {
    members: members.map((member) => ({
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      roleInCompany: member.roleInCompany,
      hasPassword: Boolean(member.passwordHash),
      status: member.passwordHash || member.oauthProvider ? 'active' : 'pending',
      ...(member.createdAt ? { createdAt: member.createdAt.toISOString() } : {}),
      ...(member.updatedAt ? { updatedAt: member.updatedAt.toISOString() } : {}),
    })),
  };
}

export function buildCompanyMemberInvitedResponse(
  member: CompanyMember,
  invitation: { expiresAt: Date | null },
) {
  return {
    message:
      member.passwordHash || member.oauthProvider
        ? 'Company member updated successfully'
        : 'Company invitation sent successfully',
    member: {
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      roleInCompany: member.roleInCompany,
      hasPassword: Boolean(member.passwordHash),
      status: member.passwordHash || member.oauthProvider ? 'active' : 'pending',
      ...(member.createdAt ? { createdAt: member.createdAt.toISOString() } : {}),
      ...(member.updatedAt ? { updatedAt: member.updatedAt.toISOString() } : {}),
    },
    invitation: {
      setupRequired: !member.passwordHash && !member.oauthProvider,
      expiresAt: invitation.expiresAt?.toISOString() ?? null,
    },
  };
}

export function buildCompanyMemberRemovedResponse(params: {
  memberId: string;
  status: 'removed' | 'cancelled';
  removedAt: Date;
}) {
  return {
    message:
      params.status === 'cancelled'
        ? 'Company invitation cancelled successfully'
        : 'Company member removed successfully',
    memberId: params.memberId,
    status: params.status,
    removedAt: params.removedAt.toISOString(),
  };
}

export function buildCompanyMemberRoleChangedResponse(params: {
  memberId: string;
  roleInCompany: string;
  previousRole: string;
}) {
  return {
    message: 'Company member role updated successfully',
    member: {
      id: params.memberId,
      roleInCompany: params.roleInCompany,
    },
    previousRole: params.previousRole,
  };
}

export function buildCompanyOwnershipTransferredResponse(newOwner: NewOwner, transferredAt: Date) {
  return {
    message: 'Ownership transferred successfully',
    newOwner: {
      id: newOwner.id,
      email: newOwner.email,
      fullName: newOwner.fullName,
    },
    transferredAt: transferredAt.toISOString(),
  };
}

export function buildCompanyLogoUploadedResponse(logoUrl: string, company: CompanyRecord) {
  const serializedCompany = serializeCompanyLogo(company);
  return { logoUrl: serializedCompany.logoUrl ?? logoUrl, company: serializedCompany };
}

export function buildCompanyUpdatedResponse(company: CompanyRecord) {
  return {
    message: 'Company settings updated successfully',
    company: serializeCompanyLogo(company),
  };
}
