import { describe, expect, it } from 'vitest';

import {
  buildDiaryListResponse,
  buildPreviousPersonnelEmptyResponse,
  buildPreviousPersonnelResponse,
} from './diaryCoreResponses.js';

describe('diary core response helpers', () => {
  it('preserves diary list pagination response shape', () => {
    const diaries = [{ id: 'diary-1' }];

    expect(buildDiaryListResponse(diaries, 26, 2, 25)).toEqual({
      data: diaries,
      pagination: {
        total: 26,
        page: 2,
        limit: 25,
        totalPages: 2,
        hasNextPage: false,
        hasPrevPage: true,
      },
    });
  });

  it('preserves previous personnel empty response', () => {
    expect(buildPreviousPersonnelEmptyResponse()).toEqual({
      personnel: [],
      message: 'No personnel from previous day',
    });
  });

  it('preserves previous personnel copy response date and message', () => {
    const personnel = [
      {
        name: 'Sam',
        company: 'Civil Co',
        role: 'Leading Hand',
        startTime: '07:00',
        finishTime: '15:30',
        hours: 8.5,
      },
    ];

    expect(buildPreviousPersonnelResponse(personnel, new Date('2026-06-01T12:00:00.000Z'))).toEqual(
      {
        personnel,
        previousDate: '2026-06-01',
        message: 'Copied 1 personnel from previous diary',
      },
    );
  });
});
