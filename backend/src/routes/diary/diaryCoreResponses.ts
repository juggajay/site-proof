import { getPaginationMeta } from '../../lib/pagination.js';

type PreviousPersonnel = {
  name: string;
  company: string | null;
  role: string | null;
  startTime: string | null;
  finishTime: string | null;
  hours: unknown | null;
};

type PreviousPlant = {
  description: string;
  idRego: string | null;
  company: string | null;
  hoursOperated: unknown | null;
  notes: string | null;
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

export function buildPreviousPlantEmptyResponse() {
  return { plant: [], message: 'No plant from previous day' };
}

export function buildPreviousPlantResponse(plant: PreviousPlant[], previousDate: Date) {
  return {
    plant,
    previousDate: previousDate.toISOString().split('T')[0],
    message: `Copied ${plant.length} plant from previous diary`,
  };
}
