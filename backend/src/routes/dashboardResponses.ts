export function buildPortfolioCashFlowResponse(
  totalClaimed: number,
  totalCertified: number,
  totalPaid: number,
) {
  return {
    totalClaimed,
    totalCertified,
    totalPaid,
    outstanding: totalCertified - totalPaid,
  };
}

export function buildPortfolioNcrsResponse(ncrs: unknown[]) {
  return { ncrs };
}

export function buildProjectsAtRiskResponse(projectsAtRisk: unknown[]) {
  return { projectsAtRisk };
}
