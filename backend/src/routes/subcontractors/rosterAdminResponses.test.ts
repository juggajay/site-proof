import { describe, expect, it } from 'vitest';
import {
  buildAdminEmployeeCreatedResponse,
  buildAdminEmployeeStatusResponse,
  buildAdminPlantCreatedResponse,
  buildAdminPlantStatusResponse,
} from './rosterAdminResponses.js';

describe('rosterAdminResponses', () => {
  it('builds admin employee create and status responses', () => {
    const employee = {
      id: 'employee-1',
      name: 'Jane',
      role: null,
      hourlyRate: '85.50',
      status: 'pending',
    };

    expect(buildAdminEmployeeCreatedResponse(employee)).toEqual({
      employee: {
        id: 'employee-1',
        name: 'Jane',
        role: '',
        hourlyRate: 85.5,
        status: 'pending',
      },
    });

    expect(buildAdminEmployeeStatusResponse(employee, 'counter', 90)).toEqual({
      employee: {
        id: 'employee-1',
        name: 'Jane',
        role: '',
        hourlyRate: 85.5,
        status: 'pending',
        counterRate: 90,
      },
    });
  });

  it('builds admin plant create and status responses', () => {
    const plant = {
      id: 'plant-1',
      type: 'Excavator',
      description: null,
      idRego: null,
      dryRate: '120',
      wetRate: null,
      status: 'pending',
    };

    expect(buildAdminPlantCreatedResponse(plant)).toEqual({
      plant: {
        id: 'plant-1',
        type: 'Excavator',
        description: '',
        idRego: '',
        dryRate: 120,
        wetRate: 0,
        status: 'pending',
      },
    });

    expect(buildAdminPlantStatusResponse(plant, 'counter', 130, 180)).toEqual({
      plant: {
        id: 'plant-1',
        type: 'Excavator',
        description: '',
        idRego: '',
        dryRate: 120,
        wetRate: 0,
        status: 'pending',
        counterDryRate: 130,
        counterWetRate: 180,
      },
    });
  });
});
