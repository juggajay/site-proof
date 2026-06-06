import type { Request } from 'express';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';

type OAuthAuditFlow = 'google_identity' | 'oauth_callback' | 'mock_oauth';

export async function auditOAuthLogin(
  req: Request,
  userId: string,
  provider: string,
  flow: OAuthAuditFlow,
) {
  await createAuditLog({
    userId,
    entityType: 'user',
    entityId: userId,
    action: AuditAction.USER_LOGIN,
    changes: {
      method: 'oauth',
      provider,
      flow,
    },
    req,
  });
}

export async function auditOAuthRegistration(
  req: Request,
  userId: string,
  provider: string,
  flow: OAuthAuditFlow,
  emailVerified: boolean,
) {
  await createAuditLog({
    userId,
    entityType: 'user',
    entityId: userId,
    action: AuditAction.USER_REGISTERED,
    changes: {
      method: 'oauth',
      provider,
      flow,
      emailVerified,
    },
    req,
  });
}
