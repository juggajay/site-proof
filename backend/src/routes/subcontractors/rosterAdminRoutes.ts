import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { logError } from '../../lib/serverLogger.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import {
  buildAdminEmployeeCreatedResponse,
  buildAdminEmployeeStatusResponse,
  buildAdminPlantCreatedResponse,
  buildAdminPlantStatusResponse,
} from './rosterAdminResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;
type NormalizeRateOptions = { required?: boolean; allowZero?: boolean };

export interface SubcontractorRosterAdminRouterDependencies {
  normalizeIdParam(value: unknown, field?: string): string;
  normalizeRequiredText(value: unknown, field: string, maxLength: number): string;
  normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null;
  normalizeOptionalPhone(value: unknown, field: string): string | null;
  normalizeRate(value: unknown, field: string, options?: NormalizeRateOptions): number;
  requireSubcontractorProjectAccess(
    projectId: string,
    user: AuthenticatedUser,
    manage?: boolean,
    options?: { requireWritable?: boolean },
  ): Promise<unknown>;
  personNameMaxLength: number;
  roleMaxLength: number;
  equipmentTextMaxLength: number;
}

export function createSubcontractorRosterAdminRouter({
  normalizeIdParam,
  normalizeRequiredText,
  normalizeOptionalText,
  normalizeOptionalPhone,
  normalizeRate,
  requireSubcontractorProjectAccess,
  personNameMaxLength,
  roleMaxLength,
  equipmentTextMaxLength,
}: SubcontractorRosterAdminRouterDependencies): Router {
  const router = Router();

  router.use(requireAuth);

  // POST /api/subcontractors/:id/employees - Add employee to a subcontractor (admin)
  router.post(
    '/:id/employees',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
      const { name, role, hourlyRate, phone } = req.body;

      const normalizedName = normalizeRequiredText(name, 'name', personNameMaxLength);
      const normalizedRole = normalizeOptionalText(role, 'role', roleMaxLength) || '';
      const normalizedPhone = normalizeOptionalPhone(phone, 'phone') || '';
      const normalizedHourlyRate = normalizeRate(hourlyRate, 'hourlyRate');

      // Verify subcontractor exists
      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id },
      });

      if (!subcontractor) {
        throw AppError.notFound('Subcontractor');
      }

      await requireSubcontractorProjectAccess(subcontractor.projectId, user, true, {
        requireWritable: true,
      });

      const employee = await prisma.employeeRoster.create({
        data: {
          subcontractorCompanyId: id,
          name: normalizedName,
          role: normalizedRole,
          hourlyRate: normalizedHourlyRate,
          phone: normalizedPhone,
          status: 'pending',
        },
      });

      res.status(201).json(buildAdminEmployeeCreatedResponse(employee));
    }),
  );

  // PATCH /api/subcontractors/:id/employees/:empId/status - Update employee status
  router.patch(
    '/:id/employees/:empId/status',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
      const empId = normalizeIdParam(req.params.empId, 'Employee ID');
      const { status, counterRate } = req.body;
      const userId = user.id;

      const validStatuses = ['pending', 'approved', 'inactive', 'counter'];
      if (!validStatuses.includes(status)) {
        throw AppError.badRequest(
          'Invalid status. Must be: pending, approved, inactive, or counter',
        );
      }

      // Counter-proposals require a counter rate
      if (status === 'counter' && (counterRate === undefined || counterRate === null)) {
        throw AppError.badRequest('Counter-proposal requires a counterRate value');
      }
      const normalizedCounterRate =
        status === 'counter' ? normalizeRate(counterRate, 'counterRate') : undefined;

      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id },
        select: { projectId: true },
      });

      if (!subcontractor) {
        throw AppError.notFound('Subcontractor');
      }

      await requireSubcontractorProjectAccess(subcontractor.projectId, user, true, {
        requireWritable: true,
      });

      // Verify employee belongs to this subcontractor
      const employee = await prisma.employeeRoster.findFirst({
        where: {
          id: empId,
          subcontractorCompanyId: id,
        },
      });

      if (!employee) {
        throw AppError.notFound('Employee');
      }

      const updateData: Prisma.EmployeeRosterUpdateInput = {
        status,
        counterRate: status === 'counter' ? normalizedCounterRate : null,
      };
      if (status === 'approved') {
        updateData.approvedById = userId;
        updateData.approvedAt = new Date();
      } else {
        updateData.approvedById = null;
        updateData.approvedAt = null;
      }

      const updated = await prisma.employeeRoster.update({
        where: { id: empId },
        data: updateData,
      });

      // Feature #943 - Send notification when employee rate is approved
      if (status === 'approved') {
        try {
          // Get subcontractor company and project details
          const subcontractor = await prisma.subcontractorCompany.findUnique({
            where: { id },
            include: {
              project: { select: { id: true, name: true } },
            },
          });

          // Get subcontractor users to notify
          const subcontractorUsers = await prisma.subcontractorUser.findMany({
            where: { subcontractorCompanyId: id },
          });

          // Get user details for each subcontractor user
          const userIds = subcontractorUsers.map((su) => su.userId);
          const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          });

          // Create notification for each subcontractor user
          for (const u of users) {
            await prisma.notification.create({
              data: {
                userId: u.id,
                projectId: subcontractor?.project?.id || null,
                type: 'rate_approved',
                title: 'Employee Rate Approved',
                message: `The rate for ${updated.name} ($${Number(updated.hourlyRate).toFixed(2)}/hr) has been approved. You can now include this employee in your dockets.`,
                linkUrl: `/subcontractor-portal`,
              },
            });
          }
        } catch (notifError) {
          logError('[Rate Approval] Failed to send notification:', notifError);
          // Don't fail the main request
        }
      }

      // Feature #944 - Send notification when PM counter-proposes employee rate
      if (status === 'counter' && counterRate !== undefined) {
        try {
          // Get subcontractor company and project details
          const subcontractor = await prisma.subcontractorCompany.findUnique({
            where: { id },
            include: {
              project: { select: { id: true, name: true } },
            },
          });

          // Get subcontractor users to notify
          const subcontractorUsers = await prisma.subcontractorUser.findMany({
            where: { subcontractorCompanyId: id },
          });

          // Get user details for each subcontractor user
          const userIds2 = subcontractorUsers.map((su) => su.userId);
          const users2 = await prisma.user.findMany({
            where: { id: { in: userIds2 } },
            select: { id: true, email: true },
          });

          const originalRate = Number(employee.hourlyRate).toFixed(2);
          const proposedRate = Number(normalizedCounterRate).toFixed(2);

          // Create notification for each subcontractor user
          for (const u of users2) {
            await prisma.notification.create({
              data: {
                userId: u.id,
                projectId: subcontractor?.project?.id || null,
                type: 'rate_counter',
                title: 'Rate Counter-Proposal',
                message: `A counter-proposal has been made for ${updated.name}. Original rate: $${originalRate}/hr, Proposed rate: $${proposedRate}/hr. Please review and respond.`,
                linkUrl: `/subcontractor-portal`,
              },
            });
          }
        } catch (notifError) {
          logError('[Rate Counter] Failed to send notification:', notifError);
          // Don't fail the main request
        }
      }

      // Audit log for employee rate status change
      const subForAudit = await prisma.subcontractorCompany.findUnique({
        where: { id },
        select: { projectId: true, companyName: true },
      });
      await createAuditLog({
        projectId: subForAudit?.projectId,
        userId,
        entityType: 'subcontractor_employee',
        entityId: empId,
        action: AuditAction.SUBCONTRACTOR_EMPLOYEE_RATE_APPROVED,
        changes: {
          status,
          employeeName: updated.name,
          hourlyRate: Number(updated.hourlyRate),
          counterRate: normalizedCounterRate,
        },
        req,
      });

      res.json(buildAdminEmployeeStatusResponse(updated, status, normalizedCounterRate));
    }),
  );

  // POST /api/subcontractors/:id/plant - Add plant to a subcontractor (admin)
  router.post(
    '/:id/plant',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
      const { type, description, idRego, dryRate, wetRate } = req.body;

      const normalizedType = normalizeRequiredText(type, 'type', equipmentTextMaxLength);
      const normalizedDescription =
        normalizeOptionalText(description, 'description', equipmentTextMaxLength) || '';
      const normalizedIdRego =
        normalizeOptionalText(idRego, 'idRego', equipmentTextMaxLength) || '';
      const normalizedDryRate = normalizeRate(dryRate, 'dryRate');
      const normalizedWetRate = normalizeRate(wetRate, 'wetRate', {
        required: false,
        allowZero: true,
      });

      // Verify subcontractor exists
      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id },
      });

      if (!subcontractor) {
        throw AppError.notFound('Subcontractor');
      }

      await requireSubcontractorProjectAccess(subcontractor.projectId, user, true, {
        requireWritable: true,
      });

      const plant = await prisma.plantRegister.create({
        data: {
          subcontractorCompanyId: id,
          type: normalizedType,
          description: normalizedDescription,
          idRego: normalizedIdRego,
          dryRate: normalizedDryRate,
          wetRate: normalizedWetRate,
          status: 'pending',
        },
      });

      res.status(201).json(buildAdminPlantCreatedResponse(plant));
    }),
  );

  // PATCH /api/subcontractors/:id/plant/:plantId/status - Update plant status
  router.patch(
    '/:id/plant/:plantId/status',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
      const plantId = normalizeIdParam(req.params.plantId, 'Plant ID');
      const { status, counterDryRate, counterWetRate } = req.body;
      const userId = user.id;

      const validStatuses = ['pending', 'approved', 'inactive', 'counter'];
      if (!validStatuses.includes(status)) {
        throw AppError.badRequest(
          'Invalid status. Must be: pending, approved, inactive, or counter',
        );
      }

      // Counter-proposals require at least a counter dry rate
      if (status === 'counter' && (counterDryRate === undefined || counterDryRate === null)) {
        throw AppError.badRequest('Counter-proposal requires a counterDryRate value');
      }
      const normalizedCounterDryRate =
        status === 'counter' ? normalizeRate(counterDryRate, 'counterDryRate') : undefined;
      const normalizedCounterWetRate =
        status === 'counter' && counterWetRate !== undefined && counterWetRate !== null
          ? normalizeRate(counterWetRate, 'counterWetRate', { allowZero: true })
          : undefined;

      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id },
        select: { projectId: true },
      });

      if (!subcontractor) {
        throw AppError.notFound('Subcontractor');
      }

      await requireSubcontractorProjectAccess(subcontractor.projectId, user, true, {
        requireWritable: true,
      });

      // Verify plant belongs to this subcontractor
      const plant = await prisma.plantRegister.findFirst({
        where: {
          id: plantId,
          subcontractorCompanyId: id,
        },
      });

      if (!plant) {
        throw AppError.notFound('Plant');
      }

      const updateData: Prisma.PlantRegisterUpdateInput = {
        status,
        counterDryRate: status === 'counter' ? normalizedCounterDryRate : null,
        counterWetRate: status === 'counter' ? (normalizedCounterWetRate ?? null) : null,
      };
      if (status === 'approved') {
        updateData.approvedById = userId;
        updateData.approvedAt = new Date();
      } else {
        updateData.approvedById = null;
        updateData.approvedAt = null;
      }

      const updated = await prisma.plantRegister.update({
        where: { id: plantId },
        data: updateData,
      });

      // Feature #943 - Send notification when plant rate is approved
      if (status === 'approved') {
        try {
          // Get subcontractor company and project details
          const subcontractor = await prisma.subcontractorCompany.findUnique({
            where: { id },
            include: {
              project: { select: { id: true, name: true } },
            },
          });

          // Get subcontractor users to notify
          const subcontractorUsers = await prisma.subcontractorUser.findMany({
            where: { subcontractorCompanyId: id },
          });

          // Get user details for each subcontractor user
          const userIds3 = subcontractorUsers.map((su) => su.userId);
          const users3 = await prisma.user.findMany({
            where: { id: { in: userIds3 } },
            select: { id: true, email: true },
          });

          // Format rates for display
          const dryRateStr = `$${Number(updated.dryRate).toFixed(2)}`;
          const wetRateStr = updated.wetRate ? `/$${Number(updated.wetRate).toFixed(2)}` : '';
          const rateDisplay = `${dryRateStr}${wetRateStr}/hr (dry${wetRateStr ? '/wet' : ''})`;

          // Create notification for each subcontractor user
          for (const u of users3) {
            await prisma.notification.create({
              data: {
                userId: u.id,
                projectId: subcontractor?.project?.id || null,
                type: 'rate_approved',
                title: 'Plant Rate Approved',
                message: `The rate for ${updated.type}${updated.description ? ` - ${updated.description}` : ''} (${rateDisplay}) has been approved. You can now include this plant in your dockets.`,
                linkUrl: `/subcontractor-portal`,
              },
            });
          }
        } catch (notifError) {
          logError('[Rate Approval] Failed to send notification:', notifError);
          // Don't fail the main request
        }
      }

      // Feature #944 - Send notification when PM counter-proposes plant rate
      if (status === 'counter' && counterDryRate !== undefined) {
        try {
          // Get subcontractor company and project details
          const subcontractor = await prisma.subcontractorCompany.findUnique({
            where: { id },
            include: {
              project: { select: { id: true, name: true } },
            },
          });

          // Get subcontractor users to notify
          const subcontractorUsers4 = await prisma.subcontractorUser.findMany({
            where: { subcontractorCompanyId: id },
          });

          // Get user details for each subcontractor user
          const userIds4 = subcontractorUsers4.map((su) => su.userId);
          const users4 = await prisma.user.findMany({
            where: { id: { in: userIds4 } },
            select: { id: true, email: true },
          });

          // Format original rates
          const origDryRate = Number(plant.dryRate).toFixed(2);
          const origWetRate = plant.wetRate ? Number(plant.wetRate).toFixed(2) : null;
          const originalRates = origWetRate
            ? `$${origDryRate}/$${origWetRate}/hr`
            : `$${origDryRate}/hr`;

          // Format proposed rates
          const propDryRate = Number(normalizedCounterDryRate).toFixed(2);
          const propWetRate = normalizedCounterWetRate
            ? Number(normalizedCounterWetRate).toFixed(2)
            : null;
          const proposedRates = propWetRate
            ? `$${propDryRate}/$${propWetRate}/hr`
            : `$${propDryRate}/hr`;

          const plantDesc = `${updated.type}${updated.description ? ` - ${updated.description}` : ''}`;

          // Create notification for each subcontractor user
          for (const u of users4) {
            await prisma.notification.create({
              data: {
                userId: u.id,
                projectId: subcontractor?.project?.id || null,
                type: 'rate_counter',
                title: 'Plant Rate Counter-Proposal',
                message: `A counter-proposal has been made for ${plantDesc}. Original: ${originalRates}, Proposed: ${proposedRates}. Please review and respond.`,
                linkUrl: `/subcontractor-portal`,
              },
            });
          }
        } catch (notifError) {
          logError('[Rate Counter] Failed to send notification:', notifError);
          // Don't fail the main request
        }
      }

      // Audit log for plant rate status change
      const subForPlantAudit = await prisma.subcontractorCompany.findUnique({
        where: { id },
        select: { projectId: true, companyName: true },
      });
      await createAuditLog({
        projectId: subForPlantAudit?.projectId,
        userId,
        entityType: 'subcontractor_plant',
        entityId: plantId,
        action: AuditAction.SUBCONTRACTOR_PLANT_RATE_APPROVED,
        changes: {
          status,
          plantType: updated.type,
          dryRate: Number(updated.dryRate),
          wetRate: Number(updated.wetRate),
          counterDryRate: normalizedCounterDryRate,
          counterWetRate: normalizedCounterWetRate,
        },
        req,
      });

      res.json(
        buildAdminPlantStatusResponse(
          updated,
          status,
          normalizedCounterDryRate,
          normalizedCounterWetRate,
        ),
      );
    }),
  );

  return router;
}
