import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  EmployeeRosterSection,
  MyCompanyInfoCard,
  MyCompanyProjectSwitcher,
  PendingApprovalsAlert,
  PlantRegisterSection,
} from './MyCompanySections';
import type { CompanyData } from './myCompanyData';

const companyData: CompanyData = {
  id: 'subbie-company-1',
  companyName: 'Civil Subbie Co',
  abn: '51 824 753 556',
  projectId: 'project-1',
  projectName: 'Eastern Bypass',
  primaryContactName: 'Pat Subbie',
  primaryContactEmail: 'pat@example.com',
  primaryContactPhone: '0400 000 000',
  status: 'approved',
  availableProjects: [
    {
      id: 'subbie-company-1',
      subcontractorCompanyId: 'subbie-company-1',
      projectId: 'project-1',
      projectName: 'Eastern Bypass',
      companyName: 'Civil Subbie Co',
      status: 'approved',
    },
    {
      id: 'subbie-company-2',
      subcontractorCompanyId: 'subbie-company-2',
      projectId: 'project-2',
      projectName: 'Western Drainage',
      companyName: 'Civil Subbie West',
      status: 'approved',
    },
  ],
  employees: [
    {
      id: 'employee-1',
      name: 'Sam Operator',
      phone: '',
      role: 'Operator',
      hourlyRate: 85,
      status: 'pending',
    },
  ],
  plant: [
    {
      id: 'plant-1',
      type: 'Excavator',
      description: '30t Excavator',
      idRego: '',
      dryRate: 180,
      wetRate: 250,
      status: 'approved',
    },
  ],
};

describe('MyCompanyProjectSwitcher', () => {
  it('switches the selected project through search params', () => {
    const onSearchParamsChange = vi.fn();
    render(
      <MyCompanyProjectSwitcher
        companyData={companyData}
        searchParams={new URLSearchParams('projectId=project-1')}
        onSearchParamsChange={onSearchParamsChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Project / company'), {
      target: { value: 'subbie-company-2' },
    });

    expect(onSearchParamsChange).toHaveBeenCalledTimes(1);
    expect(onSearchParamsChange.mock.calls[0][0].get('projectId')).toBe('project-2');
    expect(onSearchParamsChange.mock.calls[0][0].get('subcontractorCompanyId')).toBe(
      'subbie-company-2',
    );
  });

  it('distinguishes multiple subcontractor companies on the same project', () => {
    const onSearchParamsChange = vi.fn();
    const sameProjectData: CompanyData = {
      ...companyData,
      availableProjects: [
        companyData.availableProjects![0],
        {
          id: 'subbie-company-3',
          subcontractorCompanyId: 'subbie-company-3',
          projectId: 'project-1',
          projectName: 'Eastern Bypass',
          companyName: 'Civil Subbie Joint Venture',
          status: 'approved',
        },
      ],
    };
    render(
      <MyCompanyProjectSwitcher
        companyData={sameProjectData}
        searchParams={
          new URLSearchParams('projectId=project-1&subcontractorCompanyId=subbie-company-1')
        }
        onSearchParamsChange={onSearchParamsChange}
      />,
    );

    expect(
      screen.getByRole('option', { name: 'Eastern Bypass - Civil Subbie Co' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Eastern Bypass - Civil Subbie Joint Venture' }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Project / company'), {
      target: { value: 'subbie-company-3' },
    });

    expect(onSearchParamsChange.mock.calls[0][0].get('projectId')).toBe('project-1');
    expect(onSearchParamsChange.mock.calls[0][0].get('subcontractorCompanyId')).toBe(
      'subbie-company-3',
    );
  });

  it('does not render when only one project is available', () => {
    render(
      <MyCompanyProjectSwitcher
        companyData={{ ...companyData, availableProjects: [companyData.availableProjects![0]] }}
        searchParams={new URLSearchParams()}
        onSearchParamsChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Project / company')).not.toBeInTheDocument();
  });
});

describe('MyCompanyInfoCard', () => {
  it('renders company identity and primary contact details', () => {
    render(<MyCompanyInfoCard companyData={companyData} />);

    expect(screen.getByText('Civil Subbie Co')).toBeInTheDocument();
    expect(screen.getByText('Project: Eastern Bypass')).toBeInTheDocument();
    expect(screen.getByText('ABN: 51 824 753 556')).toBeInTheDocument();
    expect(screen.getByText('Pat Subbie')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
});

describe('PendingApprovalsAlert', () => {
  it('summarizes pending employee and plant approval counts', () => {
    render(<PendingApprovalsAlert pendingEmployees={1} pendingPlant={2} />);

    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText(/1 employee rate\(s\) pending approval/)).toHaveTextContent(
      '1 employee rate(s) pending approval • 2 plant rate(s) pending approval',
    );
  });
});

describe('EmployeeRosterSection', () => {
  it('renders employee rows and management actions', () => {
    const onDeleteEmployee = vi.fn();
    render(
      <EmployeeRosterSection
        employees={companyData.employees}
        canManageRoster
        saving={false}
        onAddEmployee={vi.fn()}
        onDeleteEmployee={onDeleteEmployee}
      />,
    );

    expect(screen.getByText('Sam Operator')).toBeInTheDocument();
    expect(screen.getByText('$85/hr')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDeleteEmployee).toHaveBeenCalledWith('employee-1');
  });

  it('renders read-only empty copy for non-admin users', () => {
    render(
      <EmployeeRosterSection
        employees={[]}
        canManageRoster={false}
        saving={false}
        onAddEmployee={vi.fn()}
        onDeleteEmployee={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Add Employee' })).not.toBeInTheDocument();
    expect(screen.getByText('No employees registered yet.')).toBeInTheDocument();
  });
});

describe('PlantRegisterSection', () => {
  it('renders plant rows and management actions', () => {
    const onDeletePlant = vi.fn();
    render(
      <PlantRegisterSection
        plant={companyData.plant}
        canManageRoster
        saving={false}
        onAddPlant={vi.fn()}
        onDeletePlant={onDeletePlant}
      />,
    );

    expect(screen.getByText('Excavator')).toBeInTheDocument();
    expect(screen.getByText('30t Excavator')).toBeInTheDocument();
    expect(screen.getByText('$250/hr')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDeletePlant).toHaveBeenCalledWith('plant-1');
  });

  it('renders admin empty copy and add action', () => {
    const onAddPlant = vi.fn();
    render(
      <PlantRegisterSection
        plant={[]}
        canManageRoster
        saving={false}
        onAddPlant={onAddPlant}
        onDeletePlant={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Plant' }));
    expect(onAddPlant).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('No plant registered yet. Click "Add Plant" to get started.'),
    ).toBeInTheDocument();
  });
});
