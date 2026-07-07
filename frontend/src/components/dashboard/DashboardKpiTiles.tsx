interface DashboardKpiTilesProps {
  totalProjects: number;
  activeProjects: number;
  totalLots: number;
  canManageCompanySettings: boolean;
  onNavigate: (to: string) => void;
}

interface KpiTile {
  label: string;
  value: string;
  sub: string;
  to: string;
  title?: string;
}

export function DashboardKpiTiles({
  totalProjects,
  activeProjects,
  totalLots,
  canManageCompanySettings,
  onNavigate,
}: DashboardKpiTilesProps) {
  const accessTile: KpiTile = canManageCompanySettings
    ? {
        label: 'Team Members',
        value: '—',
        sub: 'company settings',
        to: '/company-settings',
        title: 'Manage company settings',
      }
    : {
        label: 'Project Access',
        value: '—',
        sub: 'view assigned projects',
        to: '/projects',
        title: 'View assigned projects',
      };

  const tiles: KpiTile[] = [
    {
      label: 'Total Projects',
      value: String(totalProjects),
      sub: 'across your company',
      to: '/projects',
    },
    {
      label: 'Active Projects',
      value: String(activeProjects),
      sub: 'currently on site',
      to: '/projects',
    },
    {
      label: 'Total Lots',
      value: String(totalLots),
      sub: 'in all projects',
      to: '/projects',
      title: 'View all lots in projects',
    },
    accessTile,
  ];

  // Hairline dividers between cells. At 2-col: vertical divider on odd cells,
  // horizontal divider on the second row. At lg 4-col (single row): vertical
  // divider on every cell except the first, no horizontal dividers.
  const cellBorder = [
    '',
    'border-l lg:border-l',
    'border-t lg:border-t-0 lg:border-l',
    'border-l border-t lg:border-t-0',
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
      {tiles.map((tile, index) => (
        <button
          key={tile.label}
          onClick={() => onNavigate(tile.to)}
          title={tile.title}
          type="button"
          className={`p-4 text-left transition-colors hover:bg-muted/50 ${cellBorder[index]}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tile.label}
          </p>
          <p className="mt-3 font-mono text-3xl font-medium tabular-nums tracking-tight text-foreground">
            {tile.value}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{tile.sub}</p>
        </button>
      ))}
    </div>
  );
}
