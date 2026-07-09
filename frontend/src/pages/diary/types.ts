/**
 * Type definitions for Daily Diary pages and components.
 * Extracted from DailyDiaryPage.tsx for reusability.
 */

export interface Personnel {
  id: string;
  name: string;
  company?: string;
  role?: string;
  startTime?: string;
  finishTime?: string;
  hours?: number;
  // Provenance: 'docket' rows are pulled from an approved subcontractor docket.
  source?: string;
  docketId?: string | null;
  lotId?: string | null;
  lot?: { id: string; lotNumber: string } | null;
  createdAt: string;
}

export interface Plant {
  id: string;
  description: string;
  idRego?: string;
  company?: string;
  hoursOperated?: number;
  notes?: string;
  source?: string;
  docketId?: string | null;
  lotId?: string | null;
  lot?: { id: string; lotNumber: string } | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  description: string;
  lotId?: string;
  lot?: { id: string; lotNumber: string };
  quantity?: number;
  unit?: string;
  notes?: string;
  createdAt: string;
}

export interface Delay {
  id: string;
  delayType: string;
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  description: string;
  impact?: string;
  lotId?: string | null;
  lot?: { id: string; lotNumber: string } | null;
  createdAt: string;
}

export interface DiaryVisitor {
  id: string;
  name: string;
  company?: string | null;
  purpose?: string | null;
  timeInOut?: string | null;
}

export interface Delivery {
  id: string;
  description: string;
  supplier?: string;
  docketNumber?: string;
  quantity?: number;
  unit?: string;
  lotId?: string;
  lot?: { id: string; lotNumber: string };
  notes?: string;
  createdAt: string;
}

export interface DiaryEvent {
  id: string;
  eventType: string;
  description: string;
  notes?: string;
  lotId?: string;
  lot?: { id: string; lotNumber: string };
  createdAt: string;
}

export interface Addendum {
  id: string;
  content: string;
  addedBy: { id: string; fullName: string; email: string };
  addedAt: string;
}

export interface DailyDiary {
  id: string;
  projectId: string;
  date: string;
  status: 'draft' | 'submitted';
  weatherConditions?: string;
  temperatureMin?: number;
  temperatureMax?: number;
  rainfallMm?: number;
  weatherNotes?: string;
  generalNotes?: string;
  personnel: Personnel[];
  plant: Plant[];
  activities: Activity[];
  delays: Delay[];
  deliveries: Delivery[];
  events: DiaryEvent[];
  visitors?: DiaryVisitor[];
  submittedBy?: { id: string; fullName: string; email: string };
  submittedAt?: string;
  lockedAt?: string | null;
  isLate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lot {
  id: string;
  lotNumber: string;
}

export type DiaryTab = 'weather' | 'personnel' | 'plant' | 'activities' | 'delays';

export interface WeatherFormState {
  weatherConditions: string;
  temperatureMin: string;
  temperatureMax: string;
  rainfallMm: string;
  weatherNotes: string;
  generalNotes: string;
}

export interface PersonnelFormState {
  name: string;
  company: string;
  role: string;
  startTime: string;
  finishTime: string;
  hours: string;
}

export interface PlantFormState {
  description: string;
  idRego: string;
  company: string;
  hoursOperated: string;
  notes: string;
}

export interface ActivityFormState {
  description: string;
  lotId: string;
  quantity: string;
  unit: string;
  notes: string;
}

export interface DelayFormState {
  delayType: string;
  startTime: string;
  endTime: string;
  durationHours: string;
  description: string;
  impact: string;
}
