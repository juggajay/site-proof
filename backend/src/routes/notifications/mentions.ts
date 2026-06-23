import { prisma } from '../../lib/prisma.js';
import { createNotification } from '../../lib/notificationDispatch.js';
import { buildProjectEntityLink } from './links.js';

/**
 * Mention notification helper, extracted verbatim from
 * backend/src/routes/notifications.ts as a slice of the notifications route
 * split (engineering-health Workstream 1).
 *
 * createMentionNotifications is the shared entry point used by the comments
 * route (imported through ./notifications.js), so its public surface is
 * preserved by a re-export from the route file. Behaviour is unchanged from the
 * inline implementation: the @mention regex, de-duplication of mention strings,
 * project-membership / company-admin scoping, the self-notification skip, the
 * 100-character message truncation, and the buildProjectEntityLink(...) comment
 * deep link are all identical.
 */

// Helper function to create mention notifications
export async function createMentionNotifications(
  content: string,
  authorId: string,
  entityType: string,
  entityId: string,
  commentId: string,
  projectId?: string,
): Promise<void> {
  // Extract @mentions from content (format: @email or @fullName)
  const mentionPattern = /@([\w.+-]+@[\w.-]+|[\w\s]+?)(?=\s|$|@)/g;
  const mentions = content.match(mentionPattern);

  if (!mentions || mentions.length === 0) return;

  // Get unique mention strings (remove @ prefix)
  const uniqueMentions = [...new Set(mentions.map((m) => m.slice(1).trim()))];
  const project = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        select: { companyId: true },
      })
    : null;

  // Find users by email or fullName. Postgres equality is case-sensitive, so
  // match insensitively against the original mention text — otherwise a
  // display-name @mention silently matches nobody and no notification is sent.
  for (const mention of uniqueMentions) {
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          {
            OR: [
              { email: { equals: mention, mode: 'insensitive' } },
              { fullName: { equals: mention, mode: 'insensitive' } },
            ],
          },
          projectId && project
            ? {
                OR: [
                  {
                    projectUsers: {
                      some: { projectId, status: 'active' },
                    },
                  },
                  {
                    companyId: project.companyId,
                    roleInCompany: { in: ['owner', 'admin'] },
                  },
                ],
              }
            : {},
        ],
      },
    });

    if (user && user.id !== authorId) {
      // Get author info for notification
      const author = await prisma.user.findUnique({
        where: { id: authorId },
        select: { fullName: true, email: true },
      });

      const authorName = author?.fullName || author?.email || 'Someone';

      // Create notification
      await createNotification({
        userId: user.id,
        projectId: projectId || null,
        type: 'mention',
        title: `${authorName} mentioned you in a comment`,
        message: content.length > 100 ? content.substring(0, 100) + '...' : content,
        linkUrl: buildProjectEntityLink(entityType, entityId, projectId, {
          tab: 'comments',
          commentId,
        }),
      });
    }
  }
}
