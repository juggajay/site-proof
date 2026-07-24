import { prisma } from './prisma.js';

// Single source of truth for the company block that stamps generated documents
// (PDFs + CSV exports). The branding route layers access control + logo
// embedding on top; the delay-register CSV reuses it for its preamble. Keep the
// company select aligned with buildProjectBrandingResponse's needs.
export type ProjectBrandingSource = {
  companyId: string | null;
  company: {
    id: string;
    name: string;
    abn: string | null;
    address: string | null;
    logoUrl: string | null;
  } | null;
  projectName: string | null;
};

export async function getProjectBrandingSource(
  projectId: string,
): Promise<ProjectBrandingSource | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      companyId: true,
      company: {
        select: { id: true, name: true, abn: true, address: true, logoUrl: true },
      },
    },
  });

  if (!project) {
    return null;
  }

  return {
    companyId: project.companyId,
    company: project.company,
    projectName: project.name,
  };
}
