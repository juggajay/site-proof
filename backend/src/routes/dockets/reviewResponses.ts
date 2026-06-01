type ReviewedDocket = {
  id: string;
  status: string;
};

type NotifiedUser = {
  email: string;
  fullName: string | null;
};

function mapNotifiedUsers(users: NotifiedUser[]): NotifiedUser[] {
  return users.map((su) => ({
    email: su.email,
    fullName: su.fullName,
  }));
}

export function buildDocketRejectedResponse(
  updatedDocket: ReviewedDocket,
  subcontractorUsers: NotifiedUser[],
) {
  return {
    message: 'Docket rejected',
    docket: {
      id: updatedDocket.id,
      status: updatedDocket.status,
    },
    notifiedUsers: mapNotifiedUsers(subcontractorUsers),
  };
}

export function buildDocketQueriedResponse(
  updatedDocket: ReviewedDocket,
  subcontractorUsers: NotifiedUser[],
) {
  return {
    message: 'Docket queried successfully',
    docket: {
      id: updatedDocket.id,
      status: updatedDocket.status,
    },
    notifiedUsers: mapNotifiedUsers(subcontractorUsers),
  };
}

export function buildDocketQueryResponseSubmittedResponse(updatedDocket: ReviewedDocket) {
  return {
    message: 'Query response submitted',
    docket: {
      id: updatedDocket.id,
      status: updatedDocket.status,
    },
  };
}
