type NumericLike = number | string | { toString(): string } | null | undefined;

type AdminEmployeeSource = {
  id: string;
  name: string;
  role: string | null;
  hourlyRate: NumericLike;
  status: string;
};

type AdminPlantSource = {
  id: string;
  type: string;
  description: string | null;
  idRego: string | null;
  dryRate: NumericLike;
  wetRate: NumericLike;
  status: string;
};

export function buildAdminEmployeeCreatedResponse(employee: AdminEmployeeSource) {
  return {
    employee: {
      id: employee.id,
      name: employee.name,
      role: employee.role || '',
      hourlyRate: Number(employee.hourlyRate),
      status: employee.status,
    },
  };
}

export function buildAdminEmployeeStatusResponse(
  employee: AdminEmployeeSource,
  status: string,
  counterRate?: number,
) {
  return {
    employee: {
      id: employee.id,
      name: employee.name,
      role: employee.role || '',
      hourlyRate: Number(employee.hourlyRate),
      status: employee.status,
      ...(status === 'counter' && counterRate !== undefined && { counterRate }),
    },
  };
}

export function buildAdminPlantCreatedResponse(plant: AdminPlantSource) {
  return {
    plant: {
      id: plant.id,
      type: plant.type,
      description: plant.description || '',
      idRego: plant.idRego || '',
      dryRate: Number(plant.dryRate),
      wetRate: Number(plant.wetRate) || 0,
      status: plant.status,
    },
  };
}

export function buildAdminPlantStatusResponse(
  plant: AdminPlantSource,
  status: string,
  counterDryRate?: number,
  counterWetRate?: number,
) {
  return {
    plant: {
      id: plant.id,
      type: plant.type,
      description: plant.description || '',
      idRego: plant.idRego || '',
      dryRate: Number(plant.dryRate),
      wetRate: Number(plant.wetRate) || 0,
      status: plant.status,
      ...(status === 'counter' && {
        counterDryRate,
        ...(counterWetRate !== undefined && {
          counterWetRate,
        }),
      }),
    },
  };
}
