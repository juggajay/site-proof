import { describe, expect, it } from 'vitest';

import {
  buildDiaryDelaysResponse,
  buildDiaryTimelineResponse,
  buildWeatherResponse,
  buildWeatherUnavailableResponse,
} from './diaryReportingResponses.js';

describe('diary reporting response helpers', () => {
  const location = {
    latitude: -33.8688,
    longitude: 151.2093,
    fromProjectState: true,
  };

  it('builds weather success and unavailable payloads with existing keys', () => {
    expect(
      buildWeatherResponse(
        {
          time: ['2026-06-02'],
          temperature_2m_min: [7],
          temperature_2m_max: [18],
          precipitation_sum: [0],
        },
        'Fine',
        location,
      ),
    ).toEqual({
      date: '2026-06-02',
      weatherConditions: 'Fine',
      temperatureMin: 7,
      temperatureMax: 18,
      rainfallMm: 0,
      source: 'Open-Meteo',
      unavailable: false,
      location,
    });

    expect(buildWeatherUnavailableResponse('2026-06-02', location)).toEqual({
      date: '2026-06-02',
      weatherConditions: null,
      temperatureMin: null,
      temperatureMax: null,
      rainfallMm: null,
      source: null,
      unavailable: true,
      message: 'Weather auto-population unavailable. Enter weather manually.',
      location,
    });
  });

  it('summarizes delays and sorts newest diary dates first', () => {
    const older = {
      id: 'delay-1',
      diaryDate: new Date('2026-06-01T00:00:00.000Z'),
      delayType: 'weather',
      durationHours: 1.5,
    };
    const newer = {
      id: 'delay-2',
      diaryDate: new Date('2026-06-02T00:00:00.000Z'),
      delayType: 'weather',
      durationHours: null,
    };
    const third = {
      id: 'delay-3',
      diaryDate: new Date('2026-05-31T00:00:00.000Z'),
      delayType: 'access',
      durationHours: 2,
    };

    expect(buildDiaryDelaysResponse([older, newer, third])).toEqual({
      delays: [newer, older, third],
      summary: {
        totalDelays: 3,
        totalHours: 3.5,
        byType: {
          weather: { count: 2, totalHours: 1.5 },
          access: { count: 1, totalHours: 2 },
        },
      },
    });
  });

  it('wraps diary timeline items without modifying them', () => {
    const timeline = [{ id: 'activity-1', type: 'activity' as const }];

    expect(buildDiaryTimelineResponse(timeline)).toEqual({ timeline });
  });
});
