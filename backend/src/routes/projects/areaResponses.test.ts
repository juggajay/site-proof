import { describe, expect, it } from 'vitest';
import {
  buildProjectAreaDeletedResponse,
  buildProjectAreaResponse,
  buildProjectAreasResponse,
} from './areaResponses.js';

describe('project area response helpers', () => {
  const createdAt = new Date('2026-06-01T00:00:00.000Z');

  it('builds the project areas list response', () => {
    expect(
      buildProjectAreasResponse([
        {
          id: 'area-1',
          name: 'Northbound',
          chainageStart: '10.5',
          chainageEnd: 20,
          colour: '#FF0000',
          createdAt,
        },
      ]),
    ).toEqual({
      areas: [
        {
          id: 'area-1',
          name: 'Northbound',
          chainageStart: 10.5,
          chainageEnd: 20,
          colour: '#FF0000',
          createdAt,
        },
      ],
    });
  });

  it('builds a single project area response and preserves null chainages', () => {
    expect(
      buildProjectAreaResponse({
        id: 'area-1',
        name: 'Northbound',
        chainageStart: null,
        chainageEnd: null,
        colour: null,
        createdAt,
      }),
    ).toEqual({
      area: {
        id: 'area-1',
        name: 'Northbound',
        chainageStart: null,
        chainageEnd: null,
        colour: null,
        createdAt,
      },
    });
  });

  it('builds the project area deleted response', () => {
    expect(buildProjectAreaDeletedResponse()).toEqual({ message: 'Area deleted successfully' });
  });
});
