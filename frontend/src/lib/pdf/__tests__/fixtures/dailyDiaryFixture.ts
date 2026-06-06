import type { DailyDiaryPDFData } from '../../../pdfGenerator';

export const submittedDailyDiaryFixture: DailyDiaryPDFData = {
  diary: {
    id: 'diary-1',
    date: '2026-05-28T12:00:00.000Z',
    status: 'submitted',
    weatherConditions: 'Cloudy with light rain',
    temperatureMin: 14,
    temperatureMax: 22,
    rainfallMm: 6,
    weatherNotes: 'Light rain paused excavation around lunch.',
    generalNotes:
      '<p>Morning toolbox completed before crews opened drainage trench.</p><p>Inspection photos uploaded.</p>',
    isLate: true,
    submittedBy: {
      fullName: 'Riley Foreman',
      email: 'riley@example.com',
    },
    submittedAt: '2026-05-28T08:30:00.000Z',
    createdAt: '2026-05-28T00:30:00.000Z',
    updatedAt: '2026-05-28T08:30:00.000Z',
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
  personnel: [
    {
      id: 'person-1',
      name: 'Nina Foreman',
      company: 'SiteProof Civil',
      role: 'Foreman',
      startTime: '06:30',
      finishTime: '15:00',
      hours: 8.5,
    },
    {
      id: 'person-2',
      name: 'Drainage Crew A',
      company: 'Drainage Crew',
      role: 'Pipe layer',
      startTime: '07:00',
      finishTime: '14:30',
      hours: 7.5,
    },
  ],
  plant: [
    {
      id: 'plant-1',
      description: 'Excavator 20t',
      idRego: 'EX-204',
      company: 'Drainage Crew',
      hoursOperated: 7,
      notes: 'Trimmed trench invert',
    },
  ],
  activities: [
    {
      id: 'activity-1',
      description: 'Drainage trench excavation',
      lot: { lotNumber: 'DR-010' },
      quantity: 24,
      unit: 'm',
      notes: 'Reached inspection hold point',
    },
  ],
  delays: [
    {
      id: 'delay-1',
      delayType: 'Weather',
      description: 'Short rain delay during bedding',
      startTime: '11:15',
      endTime: '12:00',
      durationHours: 0.75,
      impact: 'Delayed bedding compaction',
    },
  ],
  addendums: [
    {
      id: 'addendum-1',
      content: 'Client requested photo set attached after inspection.',
      addedBy: {
        fullName: 'Riley Reviewer',
        email: 'reviewer@example.com',
      },
      addedAt: '2026-05-28T09:10:00.000Z',
    },
  ],
};
