// M71: header project switcher for the role dashboards. Lets a user on several
// projects pick which one's dashboard to view; the selection is made sticky by
// the caller (?projectId + localStorage via useDashboardProjectId).

export interface DashboardSwitcherProject {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
}

interface ProjectSwitcherProps {
  projects: DashboardSwitcherProject[];
  value?: string;
  onChange: (projectId: string) => void;
}

export function ProjectSwitcher({ projects, value, onChange }: ProjectSwitcherProps) {
  // Nothing to switch between with a single project.
  if (projects.length <= 1) {
    return null;
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Project</span>
      <select
        aria-label="Switch project"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[14rem] truncate rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.projectNumber} — {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}
