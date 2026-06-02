import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { sendNotificationIfEnabled } from '../notifications.js';
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
  hasProjectAccess: boolean;
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

  // POST /api/projects/:id/users - Invite a user to a project
  projectTeamRouter.post(
    '/:id/users',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const email = normalizeProjectUserEmail(req.body.email);
      const role = parseProjectTeamRole(req.body.role);
      const currentUser = req.user!;

      const access = await getProjectAccessContext(projectId, currentUser);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can invite users');
      }

      // Project team assignment links an existing company member to a project;
      // it does not create a new company seat.
      const invitedUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, fullName: true, companyId: true },
      });

      if (!invitedUser) {
        throw AppError.notFound('User');
      }

      if (invitedUser.companyId !== access.project.companyId) {
        throw AppError.forbidden(
          'User must belong to this company before they can be added to the project',
        );
      }

      // Check if already a member
      const existingMember = await prisma.projectUser.findFirst({
        where: { projectId, userId: invitedUser.id },
      });

      if (existingMember) {
        throw AppError.badRequest('User is already a member of this project');
      }

      // Create project user
      const newProjectUser = await prisma.projectUser.create({
        data: {
          projectId,
          userId: invitedUser.id,
          role,
          status: 'active',
          acceptedAt: new Date(), // Auto-accept for now
        },
      });

      // Audit log
      await createAuditLog({
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

      // Feature #939 - Send team invitation notification to invited user
      try {
        // Get project details for the notification
        const projectDetails = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, projectNumber: true },
        });

        const inviterName = currentUser.fullName || currentUser.email || 'A team member';

        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId: invitedUser.id,
            projectId,
            type: 'team_invitation',
            title: 'Team Invitation',
            message: `${inviterName} has invited you to join ${projectDetails?.name || 'a project'} as ${role.replace('_', ' ')}.`,
            linkUrl: `/projects/${projectId}`,
          },
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
      const role = parseProjectTeamRole(req.body.role);
      const currentUser = req.user!;

      const access = await getProjectAccessContext(projectId, currentUser);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can change user roles');
      }

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

        const oldRole = targetProjectUser.role;
        if (!isProjectAdminRole(role)) {
          await assertCanReduceProjectAdmin(tx, projectId, targetProjectUser);
        }

        // Update role while the project-admin rows are locked when this reduces admin coverage.
        const updatedProjectUser = await tx.projectUser.update({
          where: { id: targetProjectUser.id },
          data: { role },
        });

        return {
          targetProjectUser,
          oldRole,
          updated: updatedProjectUser,
        };
      });

      // Audit log
      await createAuditLog({
        projectId,
        userId: currentUser.id,
        entityType: 'project_user',
        entityId: targetForAudit.id,
        action: AuditAction.USER_ROLE_CHANGED,
        changes: {
          targetUserId,
          targetUserEmail: targetForAudit.user.email,
          oldRole,
          newRole: role,
        },
        req,
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
          await prisma.notification.create({
            data: {
              userId: targetUserId,
              projectId,
              type: 'role_change',
              title: 'Role Changed',
              message: `Your role on ${projectDetails?.name || 'a project'} has been changed from ${formattedOldRole} to ${formattedNewRole} by ${changerName}.`,
              linkUrl: `/projects/${projectId}`,
            },
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

      const access = await getProjectAccessContext(projectId, currentUser);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can remove users');
      }

      // Can't remove yourself
      if (targetUserId === currentUser.id) {
        throw AppError.badRequest('You cannot remove yourself from the project');
      }

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

        await assertCanReduceProjectAdmin(tx, projectId, targetProjectUser);

        // Delete the project user while the active project-admin rows remain locked.
        await tx.projectUser.delete({
          where: { id: targetProjectUser.id },
        });

        return targetProjectUser;
      });

      // Audit log
      await createAuditLog({
        projectId,
        userId: currentUser.id,
        entityType: 'project_user',
        entityId: removedProjectUser.id,
        action: AuditAction.USER_REMOVED,
        changes: {
          removedUserId: targetUserId,
          removedUserEmail: removedProjectUser.user.email,
          removedUserRole: removedProjectUser.role,
        },
        req,
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
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            projectId: null, // Project access has been removed, so we don't link to the project
            type: 'project_removal',
            title: 'Removed from Project',
            message: `You have been removed from ${projectDetails?.name || 'a project'} by ${removerName}. Your previous role was ${formattedRole}.`,
            linkUrl: '/projects', // Link to projects list since they no longer have access to this project
          },
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
