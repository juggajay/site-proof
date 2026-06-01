type SubmittedDocketSource = {
  id: string;
  status: string;
  submittedAt: Date | null;
};

type NotifiedProjectUserSource = {
  user: {
    email: string;
    fullName: string | null;
  };
};

export function buildDocketSubmittedResponse(
  updatedDocket: SubmittedDocketSource,
  projectUsers: NotifiedProjectUserSource[],
) {
  return {
    message: 'Docket submitted for approval',
    docket: {
      id: updatedDocket.id,
      status: updatedDocket.status,
      submittedAt: updatedDocket.submittedAt,
    },
    notifiedUsers: projectUsers.map((projectUser) => ({
      email: projectUser.user.email,
      fullName: projectUser.user.fullName,
    })),
  };
}
