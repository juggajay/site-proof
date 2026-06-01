import type { DigestItem } from '../../lib/email.js';
import { AppError } from '../../lib/AppError.js';

/**
 * Pure digest diagnostics helpers for the non-production notification routes.
 * Routes still own auth, diagnostics gating, queue persistence, sending, and
 * queue clearing. These helpers preserve the inline request parsing and JSON
 * response shapes from notifications.ts.
 */

export function buildDigestItemFromBody(
  body: Record<string, unknown>,
  now = new Date(),
): DigestItem {
  const { type, title, message, projectName, linkUrl } = body;

  if (
    typeof type !== 'string' ||
    typeof title !== 'string' ||
    typeof message !== 'string' ||
    !type ||
    !title ||
    !message
  ) {
    throw AppError.badRequest('type, title, and message are required');
  }

  return {
    type,
    title,
    message,
    projectName: typeof projectName === 'string' ? projectName : undefined,
    linkUrl: typeof linkUrl === 'string' ? linkUrl : undefined,
    timestamp: now,
  };
}

export function buildDigestItemAddedResponse(queuedItems: number): {
  success: true;
  message: 'Item added to digest';
  queuedItems: number;
} {
  return {
    success: true,
    message: 'Item added to digest',
    queuedItems,
  };
}

export function buildDigestSentResponse(params: {
  messageId: string | undefined;
  sentTo: string;
  itemCount: number;
}): {
  success: true;
  message: 'Daily digest sent successfully';
  messageId: string | undefined;
  sentTo: string;
  itemCount: number;
} {
  return {
    success: true,
    message: 'Daily digest sent successfully',
    messageId: params.messageId,
    sentTo: params.sentTo,
    itemCount: params.itemCount,
  };
}

export function buildDigestQueueResponse(items: DigestItem[]): {
  items: DigestItem[];
  count: number;
} {
  return {
    items,
    count: items.length,
  };
}

export function buildDigestQueueClearedResponse(): {
  success: true;
  message: 'Digest queue cleared';
} {
  return {
    success: true,
    message: 'Digest queue cleared',
  };
}
