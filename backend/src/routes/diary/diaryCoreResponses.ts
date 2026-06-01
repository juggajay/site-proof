import { getPaginationMeta } from '../../lib/pagination.js';

type PreviousPersonnel = {
  name: string;
  company: string | null;
  role: string | null;
  startTime: string | null;
  finishTime: string | null;
  hours: unknown | null;
};

export function buildDiaryListResponse(
  diaries: unknown[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    data: diaries,
    pagination: getPaginationMeta(total, page, limit),
  };
}

export function buildPreviousPersonnelEmptyResponse() {
  return { personnel: [], message: 'No personnel from previous day' };
}

export function buildPreviousPersonnelResponse(personnel: PreviousPersonnel[], previousDate: Date) {
  return {
    personnel,
    previousDate: previousDate.toISOString().split('T')[0],
    message: `Copied ${personnel.length} personnel from previous diary`,
  };
}
