type ProjectAreaRecord = {
  id: string;
  name: string;
  chainageStart: unknown | null;
  chainageEnd: unknown | null;
  colour: string | null;
  createdAt: Date;
};

function buildAreaResponse(area: ProjectAreaRecord) {
  return {
    id: area.id,
    name: area.name,
    chainageStart: area.chainageStart ? Number(area.chainageStart) : null,
    chainageEnd: area.chainageEnd ? Number(area.chainageEnd) : null,
    colour: area.colour,
    createdAt: area.createdAt,
  };
}

export function buildProjectAreasResponse(areas: ProjectAreaRecord[]) {
  return {
    areas: areas.map(buildAreaResponse),
  };
}

export function buildProjectAreaResponse(area: ProjectAreaRecord) {
  return {
    area: buildAreaResponse(area),
  };
}

export function buildProjectAreaDeletedResponse() {
  return { message: 'Area deleted successfully' };
}
