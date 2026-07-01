import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { createNotification } from '../../lib/notificationDispatch.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireBrowserSession } from '../../middleware/browserSession.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import { assertProjectAllowsWrite } from '../../lib/projectAccess.js';
import {
  disableOwnedScheduledReportsForAccessRemoval,
  disableOwnedScheduledReportsForProjectManagerDemotion,
} from '../../lib/scheduledReports/ownershipCleanup.js';
import {
  buildProjectUserInvitedResponse,
  buildProjectUserRemovedResponse,
  buildProjectUserRoleUpdatedResponse,
  buildProjectUsersResponse,
} from './teamResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;

type ProjectAccessContext = {
  project: {
    id: string;
    companyId: string;
  };
  projectUser: { role: string } | null;
  hasProjectAccess: boolean;
  hasCompanyAdminAccess: boolean;
  isProjectAdmin: boolean;
};

type ProjectTeamRouterDependencies = {
  assertCanReduceProjectAdmin: (
    client: Prisma.TransactionClient,
    projectId: string,
    targetProjectUser: { role: string; status: string },
  ) => Promise<void>;
  getProjectAccessContext: (
    projectId: string,
    user: AuthenticatedUser,
  ) => Promise<ProjectAccessContext>;
  isProjectAdminRole: (role: string | null | undefined) => boolean;
  normalizeProjectUserEmail: (value: unknown) => string;
  parseProjectRouteParam: (value: unknown, fieldName: string) => string;
  parseProjectTeamRole: (value: unknown) => string;
};

const PROTECTED_PROJECT_MEMBER_ROLES = new Set(['owner', 'admin', 'project_manager']);
const SCHEDULED_REPORT_MANAGER_PROJECT_ROLES = new Set(['owner', 'admin', 'project_manager']);

function isProjectUserUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isProtectedProjectMemberRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && PROTECTED_PROJECT_MEMBER_ROLES.has(role);
}

function canProjectRoleManageScheduledReports(role: string | null | undefined): boolean {
  return typeof role === 'string' && SCHEDULED_REPORT_MANAGER_PROJECT_ROLES.has(role);
}

function assertActorMayManageProjectMemberRole(params: {
  actorProjectRole: string | null | undefined;
  actorHasCompanyAdminAccess: boolean;
  targetCurrentRole?: string | null;
  targetNewRole?: string | null;
}): void {
  if (params.actorHasCompanyAdminAccess || params.actorProjectRole === 'admin') {
    return;
  }

  if (isProtectedProjectMemberRole(params.targetCurrentRole)) {
    throw AppError.forbidden(
      'Only project admins can manage project administrators and project managers',
    );
  }

  if (isProtectedProjectMemberRole(params.targetNewRole)) {
    throw AppError.forbidden(
      'Only project admins can grant project administrator and project manager roles',
    );
  }
}

function isCompanyAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'owner';
}

function parseProjectTeamUserLookup(
  body: Record<string, unknown>,
  parseProjectRouteParam: (value: unknown, fieldName: string) => string,
  normalizeProjectUserEmail: (value: unknown) => string,
): { userId: string; email?: never } | { email: string; userId?: never } {
  if (body.userId !== undefined && body.userId !== null && body.userId !== '') {
    return { userId: parseProjectRouteParam(body.userId, 'userId') };
  }

  return { email: normalizeProjectUserEmail(body.email) };
}

export function createProjectTeamRouter({
  assertCanReduceProjectAdmin,
  getProjectAccessContext,
  isProjectAdminRole,
  normalizeProjectUserEmail,
  parseProjectRouteParam,
  parseProjectTeamRole,
}: ProjectTeamRouterDependencies) {
  const projectTeamRouter = Router();

  projectTeamRouter.use(requireAuth);

  async function getActorManagementAccessInTransaction(
    tx: Prisma.TransactionClient,
    projectId: string,
    user: AuthenticatedUser,
    forbiddenMessage: string,
  ) {
    const [project, actorUser, actorProjectUser] = await Promise.all([
      tx.project.findUnique({
        where: { id: projectId },
        select: { companyId: true },
      }),
      tx.user.findUnique({
        where: { id: user.id },
        select: { companyId: true, roleInCompany: true },
      }),
      tx.projectUser.findFirst({
        where: { projectId, userId: user.id, status: 'active' },
        select: { role: true },
      }),
    ]);

    if (!project) {
      throw AppError.notFound('Project');
    }

    const actorHasCompanyAdminAccess =
      isCompanyAdminRole(actorUser?.roleInCompany) && actorUser?.companyId === project.companyId;
    const actorProjectRole = actorProjectUser?.role ?? null;

    if (!isProjectAdminRole(actorProjectRole) && !actorHasCompanyAdminAccess) {
      throw AppError.forbidden(forbiddenMessage);
    }

    return {
      actorProjectRole,
      actorHasCompanyAdminAccess,
      projectCompanyId: project.companyId,
    };
  }

  // GET /api/projects/:id/users - Get all users in a project
  projectTeamRouter.get(
    '/:id/users',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;

      const access = await getProjectAccessContext(projectId, user);

      if (!access.hasProjectAccess) {
        throw AppError.forbidden('Access denied');
      }

      const projectUsers = await prisma.projectUser.findMany({
        where: { projectId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
        orderBy: { invitedAt: 'desc' },
      });

      res.json(buildProjectUsersResponse(projectUsers));
    }),
  );

  // GET /api/projects/:id/assignable-users - Get company users not already assigned to a project
  projectTeamRouter.get(
    '/:id/assignable-users',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;

      const access = await getProjectAccessContext(projectId, user);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can view assignable users');
      }

      const assignableUsers = await prisma.user.findMany({
        where: {
          companyId: access.project.companyId,
          projectUsers: {
            none: { projectId },
          },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          roleInCompany: true,
        },
        orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
      });

      res.json({ users: assignableUsers });
    }),
  );

  // POST /api/projects/:id/users - Invite a user to a project
  projectTeamRouter.post(
    '/:id/users',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const currentUser = req.user!;
      requireBrowserSession(req, 'Project team invitation');
      const lookup = parseProjectTeamUserLookup(
        req.body as Record<string, unknown>,
        parseProjectRouteParam,
        normalizeProjectUserEmail,
      );
      const role = parseProjectTeamRole(req.body.role);

      const access = await getProjectAccessContext(projectId, currentUser);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can invite users');
      }
      await assertProjectAllowsWrite(projectId);
      assertActorMayManageProjectMemberRole({
        actorProjectRole: access.projectUser?.role,
        actorHasCompanyAdminAccess: access.hasCompanyAdminAccess,
        targetNewRole: role,
      });

      const { invitedUser, newProjectUser } = await prisma.$transaction(async (tx) => {
        await assertProjectAllowsWrite(projectId, tx);
        const actorAccess = await getActorManagementAccessInTransaction(
          tx,
          projectId,
          currentUser,
          'Only admins can invite users',
        );
        assertActorMayManageProjectMemberRole({
          actorProjectRole: actorAccess.actorProjectRole,
          actorHasCompanyAdminAccess: actorAccess.actorHasCompanyAdminAccess,
          targetNewRole: role,
        });

        // Project team assignment links an existing company member to a project;
        // it does not create a new company seat.
        const invitedUser = await tx.user.findUnique({
          where: 'userId' in lookup ? { id: lookup.userId } : { email: lookup.email },
          select: { id: true, email: true, fullName: true, companyId: true },
        });

        if (!invitedUser) {
          throw AppError.notFound('User');
        }

        if (invitedUser.companyId !== actorAccess.projectCompanyId) {
          throw AppError.forbidden(
            'User must belong to this company before they can be added to the project',
          );
        }

        // Check if already a member
        const existingMember = await tx.projectUser.findFirst({
          where: { projectId, userId: invitedUser.id },
        });

        if (existingMember) {
          throw AppError.badRequest('User is already a member of this project');
        }

        const newProjectUser = await tx.projectUser
          .create({
            data: {
              projectId,
              userId: invitedUser.id,
              role,
              status: 'active',
              acceptedAt: new Date(), // Auto-accept for now
            },
          })
          .catch((error: unknown) => {
            if (isProjectUserUniqueConstraintError(error)) {
              throw AppError.badRequest('User is already a member of this project');
            }
            throw error;
          });

        await writeAuditLogInTransaction(tx, {
          projectId,
          userId: currentUser.id,
          entityType: 'project_user',
          entityId: newProjectUser.id,
          action: AuditAction.USER_INVITED,
          changes: {
            invitedUserId: invitedUser.id,
            invitedUserEmail: invitedUser.email,
            role,
          },
          req,
        });

        return { invitedUser, newProjectUser };
      });

      // Feature #939 - Send team invitation notification to invited user
      try {
        // Get project details for the notification
        const projectDetails = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, projectNumber: true },
        });

        const inviterName = currentUser.fullName || currentUser.email || 'A team member';

        // Create in-app notification
        await createNotification({
          userId: invitedUser.id,
          projectId,
          type: 'team_invitation',
          title: 'Team Invitation',
          message: `${inviterName} has invited you to join ${projectDetails?.name || 'a project'} as ${role.replace('_', ' ')}.`,
          linkUrl: `/projects/${projectId}`,
        });

        // Send email notification
        await sendNotificationIfEnabled(
          invitedUser.id,
          'mentions', // Using mentions type for team invitations
          {
            title: 'Team Invitation',
            message: `You've been invited to join ${projectDetails?.name || 'a project'} as ${role.replace('_', ' ')}. Project: ${projectDetails?.projectNumber || 'N/A'}`,
            linkUrl: `/projects/${projectId}`,
            projectName: projectDetails?.name || undefined,
          },
        );
      } catch {
        // Don't fail the main request if notifications fail
      }

      res.status(201).json(buildProjectUserInvitedResponse(newProjectUser, invitedUser, role));
    }),
  );

  // PATCH /api/projects/:id/users/:userId - Update user role in project
  projectTeamRouter.patch(
    '/:id/users/:userId',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const targetUserId = parseProjectRouteParam(req.params.userId, 'userId');
      const currentUser = req.user!;
      requireBrowserSession(req, 'Project team role change');
      const role = parseProjectTeamRole(req.body.role);

      const access = await getProjectAccessContext(projectId, currentUser);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can change user roles');
      }
      await assertProjectAllowsWrite(projectId);

      if (targetUserId === currentUser.id) {
        throw AppError.badRequest('You cannot change your own project role');
      }

      const {
        targetProjectUser: targetForAudit,
        oldRole,
        updated,
      } = await prisma.$transaction(async (tx) => {
        // Re-read inside the transaction so the invariant check sees the latest membership state.
        const targetProjectUser = await tx.projectUser.findFirst({
          where: { projectId, userId: targetUserId },
          include: {
            user: { select: { email: true, fullName: true } },
          },
        });

        if (!targetProjectUser) {
          throw AppError.notFound('User in project');
        }

        await assertProjectAllowsWrite(projectId, tx);
        const actorAccess = await getActorManagementAccessInTransaction(
          tx,
          projectId,
          currentUser,
          'Only admins can change user roles',
        );
        const oldRole = targetProjectUser.role;
        assertActorMayManageProjectMemberRole({
          actorProjectRole: actorAccess.actorProjectRole,
          actorHasCompanyAdminAccess: actorAccess.actorHasCompanyAdminAccess,
          targetCurrentRole: oldRole,
          targetNewRole: role,
        });

        if (!isProjectAdminRole(role)) {
          await assertCanReduceProjectAdmin(tx, projectId, targetProjectUser);
        }

        // Update role while the project-admin rows are locked when this reduces admin coverage.
        const updatedProjectUser = await tx.projectUser.update({
          where: { id: targetProjectUser.id },
          data: { role },
        });
        const disabledScheduledReportCount =
          canProjectRoleManageScheduledReports(oldRole) &&
          !canProjectRoleManageScheduledReports(role)
            ? await disableOwnedScheduledReportsForProjectManagerDemotion(tx, {
                userId: targetUserId,
                projectId,
              })
            : 0;

        // M73: write the audit record inside the transaction so a role change
        // cannot persist without it (hard-fail).
        await writeAuditLogInTransaction(tx, {
          projectId,
          userId: currentUser.id,
          entityType: 'project_user',
          entityId: targetProjectUser.id,
          action: AuditAction.USER_ROLE_CHANGED,
          changes: {
            targetUserId,
            targetUserEmail: targetProjectUser.user.email,
            oldRole,
            newRole: role,
            disabledScheduledReportCount,
          },
          req,
        });

        return {
          targetProjectUser,
          oldRole,
          updated: updatedProjectUser,
        };
      });

      // Feature #940 - Send role change notification to the user
      if (oldRole !== role) {
        try {
          // Get project details for the notification
          const projectDetails = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, name: true, projectNumber: true },
          });

          const changerName = currentUser.fullName || currentUser.email || 'An administrator';
          const formattedOldRole = oldRole.replace(/_/g, ' ');
          const formattedNewRole = role.replace(/_/g, ' ');

          // Create in-app notification
          await createNotification({
            userId: targetUserId,
            projectId,
            type: 'role_change',
            title: 'Role Changed',
            message: `Your role on ${projectDetails?.name || 'a project'} has been changed from ${formattedOldRole} to ${formattedNewRole} by ${changerName}.`,
            linkUrl: `/projects/${projectId}`,
          });

          // Send email notification
          await sendNotificationIfEnabled(
            targetUserId,
            'mentions', // Using mentions type for role changes
            {
              title: 'Role Changed',
              message: `Your role on ${projectDetails?.name || 'a project'} has been changed from ${formattedOldRole} to ${formattedNewRole}.`,
              projectName: projectDetails?.name,
              linkUrl: `/projects/${projectId}`,
            },
          );
        } catch {
          // Don't fail the main request if notifications fail
        }
      }

      res.json(
        buildProjectUserRoleUpdatedResponse(updated, targetUserId, targetForAudit.user.email),
      );
    }),
  );

  // DELETE /api/projects/:id/users/:userId - Remove user from project
  projectTeamRouter.delete(
    '/:id/users/:userId',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const targetUserId = parseProjectRouteParam(req.params.userId, 'userId');
      const currentUser = req.user!;
      requireBrowserSession(req, 'Project team member removal');

      const access = await getProjectAccessContext(projectId, currentUser);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can remove users');
      }
      await assertProjectAllowsWrite(projectId);

      // Can't remove yourself
      if (targetUserId === currentUser.id) {
        throw AppError.badRequest('You cannot remove yourself from the project');
      }

      let disabledScheduledReportCount = 0;
      const removedProjectUser = await prisma.$transaction(async (tx) => {
        // Re-read inside the transaction so concurrent role edits/removals cannot bypass the invariant.
        const targetProjectUser = await tx.projectUser.findFirst({
          where: { projectId, userId: targetUserId },
          include: {
            user: { select: { email: true, fullName: true } },
          },
        });

        if (!targetProjectUser) {
          throw AppError.notFound('User in project');
        }

        await assertProjectAllowsWrite(projectId, tx);
        const actorAccess = await getActorManagementAccessInTransaction(
          tx,
          projectId,
          currentUser,
          'Only admins can remove users',
        );
        assertActorMayManageProjectMemberRole({
          actorProjectRole: actorAccess.actorProjectRole,
          actorHasCompanyAdminAccess: actorAccess.actorHasCompanyAdminAccess,
          targetCurrentRole: targetProjectUser.role,
        });

        await assertCanReduceProjectAdmin(tx, projectId, targetProjectUser);

        // Delete the project user while the active project-admin rows remain locked.
        await tx.projectUser.delete({
          where: { id: targetProjectUser.id },
        });

        disabledScheduledReportCount = await disableOwnedScheduledReportsForAccessRemoval(tx, {
          userId: targetUserId,
          projectId,
        });

        // M73: write the audit record inside the transaction so the removal
        // cannot persist without it (hard-fail).
        await writeAuditLogInTransaction(tx, {
          projectId,
          userId: currentUser.id,
          entityType: 'project_user',
          entityId: targetProjectUser.id,
          action: AuditAction.USER_REMOVED,
          changes: {
            removedUserId: targetUserId,
            removedUserEmail: targetProjectUser.user.email,
            removedUserRole: targetProjectUser.role,
            disabledScheduledReportCount,
          },
          req,
        });

        return targetProjectUser;
      });

      // Feature #941 - Send removal notification to the removed user
      try {
        // Get project details for the notification
        const projectDetails = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, projectNumber: true },
        });

        const removerName = currentUser.fullName || currentUser.email || 'An administrator';
        const formattedRole = removedProjectUser.role.replace(/_/g, ' ');

        // Create in-app notification
        await createNotification({
          userId: targetUserId,
          projectId: null, // Project access has been removed, so we don't link to the project
          type: 'project_removal',
          title: 'Removed from Project',
          message: `You have been removed from ${projectDetails?.name || 'a project'} by ${removerName}. Your previous role was ${formattedRole}.`,
          linkUrl: '/projects', // Link to projects list since they no longer have access to this project
        });

        // Send email notification
        await sendNotificationIfEnabled(
          targetUserId,
          'mentions', // Using mentions type for removal notifications
          {
            title: 'Removed from Project',
            message: `You have been removed from ${projectDetails?.name || 'a project'}. Your previous role was ${formattedRole}.`,
            projectName: projectDetails?.name,
            linkUrl: '/projects',
          },
        );
      } catch {
        // Don't fail the main request if notifications fail
      }

      res.json(buildProjectUserRemovedResponse(removedProjectUser, targetUserId));
    }),
  );

  return projectTeamRouter;
}
