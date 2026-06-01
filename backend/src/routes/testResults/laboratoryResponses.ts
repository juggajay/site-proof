export function buildLaboratoriesResponse(laboratories: (string | null)[]) {
  return {
    laboratories: laboratories.filter((laboratory): laboratory is string => Boolean(laboratory)),
  };
}
