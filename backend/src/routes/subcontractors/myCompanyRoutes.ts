import { Router, type Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { activeSubcontractorCompanyWhere } from '../../lib/projectAccess.js';
import { prisma } from '../../lib/prisma.js';
import {
  buildSubcontractorPortalCompanyResponse,
  buildSubcontractorPortalEmployeeCreatedResponse,
  buildSubcontractorPortalPlantCreatedResponse,
  buildSubcontractorPortalResourceDeletedResponse,
} from './portalResourceResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;
type ScopedSubcontractorUser = {
  role: string;
  subcontractorCompanyId: string;
  subcontractorCompany: {
    id: string;
    status: string;
  };
};

type NormalizeRateOptions = { required?: boolean; allowZero?: boolean };

export interface SubcontractorMyCompanyRouterDependencies {
  defaultPortalAccess: unknown;
  assertStandaloneSubcontractorPortalUser(user: AuthenticatedUser): void;
  assertSubcontractorPortalActive(company: { status: string }): void;
  canManageLinkedSubcontractorCompany(user: AuthenticatedUser, linkRole: string): boolean;
  getScopedSubcontractorUserLink(
    req: Request,
    user: AuthenticatedUser,
  ): Promise<ScopedSubcontractorUser>;
  normalizeIdParam(value: unknown, field?: string): string;
  normalizeRequiredText(value: unknown, field: string, maxLength: number): string;
  normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null;
  normalizeOptionalPhone(value: unknown, field: string): string | null;
  normalizeRate(value: unknown, field: string, options?: NormalizeRateOptions): number;
  personNameMaxLength: number;
  roleMaxLength: number;
  equipmentTextMaxLength: number;
}

export function createSubcontractorMyCompanyRouter({
  defaultPortalAccess,
  assertStandaloneSubcontractorPortalUser,
  assertSubcontractorPortalActive,
  canManageLinkedSubcontractorCompany,
  getScopedSubcontractorUserLink,
  normalizeIdParam,
  normalizeRequiredText,
  normalizeOptionalText,
  normalizeOptionalPhone,
  normalizeRate,
  personNameMaxLength,
  roleMaxLength,
  equipmentTextMaxLength,
}: SubcontractorMyCompanyRouterDependencies): Router {
  const router = Router();

  // GET /api/subcontractors/my-company - Get the current user's subcontractor company
  router.get(
    '/my-company',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      assertStandaloneSubcontractorPortalUser(user);
      const requestedProjectId =
        req.query.projectId === undefined
          ? null
          : normalizeIdParam(req.query.projectId, 'projectId');

      // Get every active project link for this subcontractor portal user. A single subcontractor
      // identity can work across multiple head-contractor projects, so the portal must not silently
      // pin them to whichever link Postgres happens to return first.
      const subcontractorUsers = await prisma.subcontractorUser.findMany({
        where: {
          userId: user.id,
          subcontractorCompany: activeSubcontractorCompanyWhere(),
        },
        include: {
          subcontractorCompany: {
            include: {
              employeeRoster: true,
              plantRegister: true,
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const subcontractorUser = requestedProjectId
        ? subcontractorUsers.find(
            (link) => link.subcontractorCompany.projectId === requestedProjectId,
          )
        : subcontractorUsers[0];

      if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
        throw AppError.forbidden(
          requestedProjectId
            ? 'You do not have subcontractor portal access to this project'
            : 'Only subcontractors can access this endpoint',
        );
      }

      const company = subcontractorUser.subcontractorCompany;
      assertSubcontractorPortalActive(company);

      res.json(
        buildSubcontractorPortalCompanyResponse(
          company,
          user,
          subcontractorUsers,
          defaultPortalAccess,
        ),
      );
    }),
  );

  // POST /api/subcontractors/my-company/employees - Add a new employee
  router.post(
    '/my-company/employees',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      assertStandaloneSubcontractorPortalUser(user);
      const subcontractorUser = await getScopedSubcontractorUserLink(req, user);

      if (!canManageLinkedSubcontractorCompany(user, subcontractorUser.role)) {
        throw AppError.forbidden('Only subcontractor admins can add employees');
      }

      assertSubcontractorPortalActive(subcontractorUser.subcontractorCompany);

      const { name, phone, role, hourlyRate } = req.body;

      const normalizedName = normalizeRequiredText(name, 'name', personNameMaxLength);
      const normalizedPhone = normalizeOptionalPhone(phone, 'phone');
      const normalizedRole = normalizeRequiredText(role, 'role', roleMaxLength);
      const normalizedHourlyRate = normalizeRate(hourlyRate, 'hourlyRate');

      const employee = await prisma.employeeRoster.create({
        data: {
          subcontractorCompanyId: subcontractorUser.subcontractorCompany.id,
          name: normalizedName,
          phone: normalizedPhone,
          role: normalizedRole,
          hourlyRate: normalizedHourlyRate,
          status: 'pending', // Needs head contractor approval
        },
      });

      res.status(201).json(buildSubcontractorPortalEmployeeCreatedResponse(employee));
    }),
  );

  // POST /api/subcontractors/my-company/plant - Add new plant
  router.post(
    '/my-company/plant',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      assertStandaloneSubcontractorPortalUser(user);
      const subcontractorUser = await getScopedSubcontractorUserLink(req, user);

      if (!canManageLinkedSubcontractorCompany(user, subcontractorUser.role)) {
        throw AppError.forbidden('Only subcontractor admins can add plant');
      }

      assertSubcontractorPortalActive(subcontractorUser.subcontractorCompany);

      const { type, description, idRego, dryRate, wetRate } = req.body;

      const normalizedType = normalizeRequiredText(type, 'type', equipmentTextMaxLength);
      const normalizedDescription = normalizeRequiredText(
        description,
        'description',
        equipmentTextMaxLength,
      );
      const normalizedIdRego = normalizeOptionalText(idRego, 'idRego', equipmentTextMaxLength);
      const normalizedDryRate = normalizeRate(dryRate, 'dryRate');
      const normalizedWetRate = normalizeRate(wetRate, 'wetRate', {
        required: false,
        allowZero: true,
      });

      const plant = await prisma.plantRegister.create({
        data: {
          subcontractorCompanyId: subcontractorUser.subcontractorCompany.id,
          type: normalizedType,
          description: normalizedDescription,
          idRego: normalizedIdRego,
          dryRate: normalizedDryRate,
          wetRate: normalizedWetRate,
          status: 'pending', // Needs head contractor approval
        },
      });

      res.status(201).json(buildSubcontractorPortalPlantCreatedResponse(plant));
    }),
  );

  // DELETE /api/subcontractors/my-company/employees/:id - Delete an employee
  router.delete(
    '/my-company/employees/:id',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const id = normalizeIdParam(req.params.id, 'Employee ID');
      assertStandaloneSubcontractorPortalUser(user);
      const subcontractorUser = await getScopedSubcontractorUserLink(req, user);

      if (!canManageLinkedSubcontractorCompany(user, subcontractorUser.role)) {
        throw AppError.forbidden('Only subcontractor admins can delete employees');
      }

      assertSubcontractorPortalActive(subcontractorUser.subcontractorCompany);

      // Verify the employee belongs to this company
      const employee = await prisma.employeeRoster.findUnique({
        where: { id },
      });

      if (
        !employee ||
        employee.subcontractorCompanyId !== subcontractorUser.subcontractorCompanyId
      ) {
        throw AppError.notFound('Employee');
      }

      await prisma.employeeRoster.delete({
        where: { id },
      });

      res.json(buildSubcontractorPortalResourceDeletedResponse('Employee deleted successfully'));
    }),
  );

  // DELETE /api/subcontractors/my-company/plant/:id - Delete plant
  router.delete(
    '/my-company/plant/:id',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const id = normalizeIdParam(req.params.id, 'Plant ID');
      assertStandaloneSubcontractorPortalUser(user);
      const subcontractorUser = await getScopedSubcontractorUserLink(req, user);

      if (!canManageLinkedSubcontractorCompany(user, subcontractorUser.role)) {
        throw AppError.forbidden('Only subcontractor admins can delete plant');
      }

      assertSubcontractorPortalActive(subcontractorUser.subcontractorCompany);

      // Verify the plant belongs to this company
      const plant = await prisma.plantRegister.findUnique({
        where: { id },
      });

      if (!plant || plant.subcontractorCompanyId !== subcontractorUser.subcontractorCompanyId) {
        throw AppError.notFound('Plant');
      }

      await prisma.plantRegister.delete({
        where: { id },
      });

      res.json(buildSubcontractorPortalResourceDeletedResponse('Plant deleted successfully'));
    }),
  );

  return router;
}
