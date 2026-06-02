type ProjectListRecord = {
  contractValue: unknown | null;
  [key: string]: unknown;
};

type ProjectDetailRecord = {
  projectNumber: string;
  chainageStart: unknown | null;
  chainageEnd: unknown | null;
  [key: string]: unknown;
};

function toNullableNumber(value: unknown): number | null {
  return value ? Number(value) : null;
}

export function buildProjectListResponse(projects: ProjectListRecord[], isSubcontractor: boolean) {
  return {
    projects: isSubcontractor
      ? projects.map((project) => ({ ...project, contractValue: null }))
      : projects,
  };
}

export function buildProjectDetailResponse(project: ProjectDetailRecord) {
  return {
    project: {
      ...project,
      code: project.projectNumber,
      chainageStart: toNullableNumber(project.chainageStart),
      chainageEnd: toNullableNumber(project.chainageEnd),
    },
  };
}

export function buildProjectDeletedResponse(project: { id: string; name: string }) {
  return {
    message: 'Project deleted successfully',
    deletedProject: { id: project.id, name: project.name },
  };
}
