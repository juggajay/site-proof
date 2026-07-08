const DEFAULT_PROJECT_MODULES: Record<string, boolean> = {
  costTracking: true,
  progressClaims: true,
  subcontractors: true,
  dockets: true,
  dailyDiary: true,
};

const MODULE_NAV_MAPPING: Record<string, string[]> = {
  costTracking: ['Costs'],
  progressClaims: ['Progress Claims', 'Variations'],
  subcontractors: ['Subcontractors'],
  dockets: ['Docket Approvals'],
  dailyDiary: ['Daily Diary'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSettings(settings: unknown) {
  if (typeof settings === 'string') {
    try {
      const parsed: unknown = JSON.parse(settings);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isRecord(settings) ? settings : null;
}

export function getEnabledProjectModules(settings: unknown): Record<string, boolean> {
  const parsedSettings = parseSettings(settings);
  const enabledModulesSetting = parsedSettings?.enabledModules;

  if (isRecord(enabledModulesSetting)) {
    return Object.keys(DEFAULT_PROJECT_MODULES).reduce<Record<string, boolean>>(
      (modules, key) => {
        const value = enabledModulesSetting[key];
        if (typeof value === 'boolean') {
          modules[key] = value;
        }
        return modules;
      },
      { ...DEFAULT_PROJECT_MODULES },
    );
  }

  return DEFAULT_PROJECT_MODULES;
}

export function isProjectModuleNavigationItemEnabled(
  itemName: string,
  enabledModules: Record<string, boolean>,
): boolean {
  for (const [moduleKey, navNames] of Object.entries(MODULE_NAV_MAPPING)) {
    if (navNames.includes(itemName)) {
      return enabledModules[moduleKey] !== false;
    }
  }

  return true;
}
