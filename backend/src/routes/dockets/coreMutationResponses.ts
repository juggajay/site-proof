import { formatDocketDate, formatDocketNumber } from './formatting.js';

type NumericLike = number | string | { toString(): string } | null | undefined;

type DocketCreatedSource = {
  id: string;
  subcontractorCompany: { companyName: string };
  date: Date;
  status: string;
  totalLabourSubmitted: NumericLike;
  totalPlantSubmitted: NumericLike;
  notes: string | null;
};

type DocketUpdatedSource = {
  id: string;
  date: Date;
  status: string;
  notes: string | null;
  foremanNotes: string | null;
  subcontractorCompany: unknown;
};

export function buildDocketCreatedResponse(docket: DocketCreatedSource) {
  return {
    docket: {
      id: docket.id,
      docketNumber: formatDocketNumber(docket.id),
      subcontractor: docket.subcontractorCompany.companyName,
      date: formatDocketDate(docket.date),
      status: docket.status,
      labourHours: Number(docket.totalLabourSubmitted) || 0,
      plantHours: Number(docket.totalPlantSubmitted) || 0,
      notes: docket.notes,
    },
  };
}

export function buildDocketUpdatedResponse(docket: DocketUpdatedSource) {
  return {
    docket: {
      id: docket.id,
      docketNumber: formatDocketNumber(docket.id),
      date: formatDocketDate(docket.date),
      status: docket.status,
      notes: docket.notes,
      foremanNotes: docket.foremanNotes,
      subcontractor: docket.subcontractorCompany,
    },
  };
}
