import type { FilterConfig } from '@/components/mobile/FilterBottomSheet';
import { isRecord, parseJsonPreference } from '@/lib/storagePreferences';

import { STATUS_OPTIONS, type SavedFilter } from './lotFilterConfig';

interface ActiveLotFilterValues {
  statusFilters: string[];
  activityFilter: string;
  searchQuery: string;
  chainageMinFilter: string;
  chainageMaxFilter: string;
  subcontractorFilter: string;
  areaZoneFilter: string;
}

interface SavedFilterSnapshotInput {
  name: string;
  id: string;
  createdAt: string;
  statusFilters: string[];
  activityFilter: string;
  searchQuery: string;
  subcontractorFilter: string;
  areaZoneFilter: string;
}

interface MobileLotFilterConfigInput {
  statusFilters: string[];
  activityFilter: string;
  activityTypes: (string | null | undefined)[];
  isSubcontractor: boolean;
  subcontractors: { id: string; companyName: string }[];
  subcontractorFilter: string;
  areaZones: string[];
  areaZoneFilter: string;
}

function isSavedFilter(value: unknown): value is SavedFilter {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.status === 'string' &&
    typeof value.activity === 'string' &&
    typeof value.search === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.subcontractor === undefined || typeof value.subcontractor === 'string') &&
    (value.areaZone === undefined || typeof value.areaZone === 'string')
  );
}

export function parseSavedFiltersPreference(raw: string | null): SavedFilter[] {
  return parseJsonPreference(raw, [], (value) => {
    if (!Array.isArray(value)) return null;
    return value.filter(isSavedFilter);
  });
}

export function countActiveLotFilters({
  statusFilters,
  activityFilter,
  searchQuery,
  chainageMinFilter,
  chainageMaxFilter,
  subcontractorFilter,
  areaZoneFilter,
}: ActiveLotFilterValues): number {
  let count = 0;
  if (statusFilters.length > 0) count++;
  if (activityFilter) count++;
  if (searchQuery) count++;
  if (chainageMinFilter || chainageMaxFilter) count++;
  if (subcontractorFilter) count++;
  if (areaZoneFilter) count++;
  return count;
}

export function createSavedFilterSnapshot({
  name,
  id,
  createdAt,
  statusFilters,
  activityFilter,
  searchQuery,
  subcontractorFilter,
  areaZoneFilter,
}: SavedFilterSnapshotInput): SavedFilter | null {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  return {
    id,
    name: trimmedName,
    status: statusFilters.join(','),
    activity: activityFilter,
    search: searchQuery,
    subcontractor: subcontractorFilter,
    areaZone: areaZoneFilter,
    createdAt,
  };
}

export function buildMobileLotFilterConfigs({
  statusFilters,
  activityFilter,
  activityTypes,
  isSubcontractor,
  subcontractors,
  subcontractorFilter,
  areaZones,
  areaZoneFilter,
}: MobileLotFilterConfigInput): FilterConfig[] {
  return [
    {
      type: 'multiselect',
      id: 'status',
      label: 'Status',
      options: STATUS_OPTIONS,
      value: statusFilters,
    },
    {
      type: 'select',
      id: 'activity',
      label: 'Activity Type',
      options: activityTypes
        .filter((type): type is string => type !== null && type !== undefined)
        .map((type) => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) })),
      value: activityFilter || null,
    },
    ...(!isSubcontractor && subcontractors.length > 0
      ? [
          {
            type: 'select' as const,
            id: 'subcontractor',
            label: 'Subcontractor',
            options: [
              { value: 'unassigned', label: 'Unassigned' },
              ...subcontractors.map((subcontractor) => ({
                value: subcontractor.id,
                label: subcontractor.companyName,
              })),
            ],
            value: subcontractorFilter || null,
          },
        ]
      : []),
    ...(areaZones.length > 0
      ? [
          {
            type: 'select' as const,
            id: 'areaZone',
            label: 'Area/Zone',
            options: [
              { value: 'unassigned', label: 'Unassigned' },
              ...areaZones.map((zone) => ({ value: zone, label: zone })),
            ],
            value: areaZoneFilter || null,
          },
        ]
      : []),
  ];
}
