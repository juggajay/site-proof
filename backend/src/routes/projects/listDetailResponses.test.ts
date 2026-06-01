import { describe, expect, it } from 'vitest';

import { buildProjectDetailResponse, buildProjectListResponse } from './listDetailResponses.js';

describe('project list/detail response helpers', () => {
  it('preserves head-contractor project list values', () => {
    const projects = [
      {
        id: 'project-1',
        name: 'Gateway Upgrade',
        projectNumber: 'GW-001',
        contractValue: '250000',
      },
    ];

    expect(buildProjectListResponse(projects, false)).toEqual({ projects });
  });

  it('preserves subcontractor commercial isolation on project lists', () => {
    const projects = [
      {
        id: 'project-1',
        name: 'Gateway Upgrade',
        projectNumber: 'GW-001',
        contractValue: '250000',
      },
    ];

    expect(buildProjectListResponse(projects, true)).toEqual({
      projects: [
        {
          id: 'project-1',
          name: 'Gateway Upgrade',
          projectNumber: 'GW-001',
          contractValue: null,
        },
      ],
    });
  });

  it('preserves project detail code alias and chainage number conversion', () => {
    expect(
      buildProjectDetailResponse({
        id: 'project-1',
        name: 'Gateway Upgrade',
        projectNumber: 'GW-001',
        chainageStart: '12.5',
        chainageEnd: 42,
      }),
    ).toEqual({
      project: {
        id: 'project-1',
        name: 'Gateway Upgrade',
        projectNumber: 'GW-001',
        code: 'GW-001',
        chainageStart: 12.5,
        chainageEnd: 42,
      },
    });
  });

  it('preserves null chainage values', () => {
    expect(
      buildProjectDetailResponse({
        id: 'project-1',
        projectNumber: 'GW-001',
        chainageStart: null,
        chainageEnd: null,
      }).project,
    ).toMatchObject({
      code: 'GW-001',
      chainageStart: null,
      chainageEnd: null,
    });
  });
});
