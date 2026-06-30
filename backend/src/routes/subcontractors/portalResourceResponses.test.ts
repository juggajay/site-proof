import { describe, expect, it } from 'vitest';
import {
  buildSubcontractorPortalCompanyResponse,
  buildSubcontractorPortalEmployeeCreatedResponse,
  buildSubcontractorPortalPlantCreatedResponse,
  buildSubcontractorPortalResourceDeletedResponse,
} from './portalResourceResponses.js';

const decimal = (value: number) => ({ toNumber: () => value });

describe('portalResourceResponses', () => {
  const defaultPortalAccess = {
    dockets: false,
    documents: true,
  };

  it('builds the subcontractor portal company response', () => {
    const company = {
      id: 'subbie-1',
      companyName: 'Civil Subbie Pty Ltd',
      abn: null,
      projectId: 'project-1',
      project: { name: 'M1 Upgrade' },
      primaryContactName: null,
      primaryContactEmail: null,
      primaryContactPhone: null,
      status: 'approved',
      portalAccess: null,
      employeeRoster: [
        {
          id: 'employee-1',
          name: 'Jane',
          phone: null,
          role: 'Operator',
          hourlyRate: decimal(85),
          status: 'counter',
          counterRate: decimal(82),
        },
      ],
      plantRegister: [
        {
          id: 'plant-1',
          type: 'Excavator',
          description: null,
          idRego: null,
          dryRate: decimal(120),
          wetRate: null,
          status: 'counter',
          counterDryRate: decimal(110),
          counterWetRate: decimal(150),
        },
      ],
    };
    const user = { fullName: 'Sam Subbie', email: 'subbie@example.com' };
    const subcontractorUsers = [
      { subcontractorCompany: company },
      {
        subcontractorCompany: {
          ...company,
          id: 'subbie-2',
          companyName: 'Civil Subbie Other Project',
          projectId: 'project-2',
          project: { name: 'Pacific Highway' },
          status: 'pending_approval',
          portalAccess: { dockets: true },
        },
      },
    ];

    expect(
      buildSubcontractorPortalCompanyResponse(
        company,
        user,
        subcontractorUsers,
        defaultPortalAccess,
      ),
    ).toEqual({
      company: {
        id: 'subbie-1',
        companyName: 'Civil Subbie Pty Ltd',
        abn: '',
        projectId: 'project-1',
        projectName: 'M1 Upgrade',
        primaryContactName: 'Sam Subbie',
        primaryContactEmail: 'subbie@example.com',
        primaryContactPhone: '',
        status: 'approved',
        availableProjects: [
          {
            id: 'subbie-1',
            subcontractorCompanyId: 'subbie-1',
            companyName: 'Civil Subbie Pty Ltd',
            projectId: 'project-1',
            projectName: 'M1 Upgrade',
            status: 'approved',
            portalAccess: defaultPortalAccess,
          },
          {
            id: 'subbie-2',
            subcontractorCompanyId: 'subbie-2',
            companyName: 'Civil Subbie Other Project',
            projectId: 'project-2',
            projectName: 'Pacific Highway',
            status: 'pending_approval',
            portalAccess: { dockets: true },
          },
        ],
        employees: [
          {
            id: 'employee-1',
            name: 'Jane',
            phone: '',
            role: 'Operator',
            hourlyRate: 85,
            status: 'counter',
            counterRate: 82,
          },
        ],
        plant: [
          {
            id: 'plant-1',
            type: 'Excavator',
            description: '',
            idRego: '',
            dryRate: 120,
            wetRate: 0,
            status: 'counter',
            counterDryRate: 110,
            counterWetRate: 150,
          },
        ],
        portalAccess: defaultPortalAccess,
      },
    });
  });

  it('builds created employee and plant responses', () => {
    expect(
      buildSubcontractorPortalEmployeeCreatedResponse({
        id: 'employee-1',
        name: 'Jane',
        phone: null,
        role: 'Operator',
        hourlyRate: decimal(85),
      }),
    ).toEqual({
      employee: {
        id: 'employee-1',
        name: 'Jane',
        phone: '',
        role: 'Operator',
        hourlyRate: 85,
        status: 'pending',
      },
    });

    expect(
      buildSubcontractorPortalPlantCreatedResponse({
        id: 'plant-1',
        type: 'Excavator',
        description: null,
        idRego: null,
        dryRate: decimal(120),
        wetRate: null,
      }),
    ).toEqual({
      plant: {
        id: 'plant-1',
        type: 'Excavator',
        description: '',
        idRego: '',
        dryRate: 120,
        wetRate: 0,
        status: 'pending',
      },
    });
  });

  it('builds delete responses', () => {
    expect(
      buildSubcontractorPortalResourceDeletedResponse('Employee deleted successfully'),
    ).toEqual({
      message: 'Employee deleted successfully',
    });
  });
});
