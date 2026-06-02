type NumericLike = number | string | { toNumber(): number } | null | undefined;
type PortalAccessValue = unknown;

type PortalUserSummary = {
  fullName?: string | null;
  email: string;
};

type PortalEmployeeSource = {
  id: string;
  name: string;
  phone: string | null;
  role: string | null;
  hourlyRate: NumericLike;
  status?: string | null;
};

type PortalPlantSource = {
  id: string;
  type: string;
  description: string | null;
  idRego: string | null;
  dryRate: NumericLike;
  wetRate: NumericLike;
  status?: string | null;
};

type PortalCompanySource = {
  id: string;
  companyName: string;
  abn: string | null;
  projectId: string;
  project?: { name?: string | null } | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  status: string;
  portalAccess: PortalAccessValue | null;
  employeeRoster: PortalEmployeeSource[];
  plantRegister: PortalPlantSource[];
};

type PortalCompanyLinkSource = {
  subcontractorCompany: {
    id: string;
    companyName: string;
    projectId: string;
    project?: { name?: string | null } | null;
    status: string;
    portalAccess: PortalAccessValue | null;
  };
};

function numericValue(value: NumericLike): number {
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber() || 0;
  }

  return Number(value) || 0;
}

function mapPortalEmployee(employee: PortalEmployeeSource) {
  return {
    id: employee.id,
    name: employee.name,
    phone: employee.phone || '',
    role: employee.role || '',
    hourlyRate: numericValue(employee.hourlyRate),
    status: employee.status === 'approved' ? 'approved' : 'pending',
  };
}

function mapPortalPlant(plant: PortalPlantSource) {
  return {
    id: plant.id,
    type: plant.type,
    description: plant.description || '',
    idRego: plant.idRego || '',
    dryRate: numericValue(plant.dryRate),
    wetRate: numericValue(plant.wetRate),
    status: plant.status === 'approved' ? 'approved' : 'pending',
  };
}

export function buildSubcontractorPortalCompanyResponse(
  company: PortalCompanySource,
  user: PortalUserSummary,
  subcontractorUsers: PortalCompanyLinkSource[],
  defaultPortalAccess: PortalAccessValue,
) {
  return {
    company: {
      id: company.id,
      companyName: company.companyName,
      abn: company.abn || '',
      projectId: company.projectId,
      projectName: company.project?.name || '',
      primaryContactName: company.primaryContactName || user.fullName || '',
      primaryContactEmail: company.primaryContactEmail || user.email,
      primaryContactPhone: company.primaryContactPhone || '',
      status: company.status,
      availableProjects: subcontractorUsers.map((link) => ({
        id: link.subcontractorCompany.id,
        companyName: link.subcontractorCompany.companyName,
        projectId: link.subcontractorCompany.projectId,
        projectName: link.subcontractorCompany.project?.name || '',
        status: link.subcontractorCompany.status,
        portalAccess: link.subcontractorCompany.portalAccess || defaultPortalAccess,
      })),
      employees: company.employeeRoster.map(mapPortalEmployee),
      plant: company.plantRegister.map(mapPortalPlant),
      portalAccess: company.portalAccess || defaultPortalAccess,
    },
  };
}

export function buildSubcontractorPortalEmployeeCreatedResponse(employee: PortalEmployeeSource) {
  return { employee: mapPortalEmployee({ ...employee, status: 'pending' }) };
}

export function buildSubcontractorPortalPlantCreatedResponse(plant: PortalPlantSource) {
  return { plant: mapPortalPlant({ ...plant, status: 'pending' }) };
}

export function buildSubcontractorPortalResourceDeletedResponse(message: string) {
  return { message };
}
