export type DiaryReminderResult = {
  projectId: string;
  projectName: string;
  date: string;
  usersNotified: string[];
};

export type MissingDiaryAlertResult = {
  projectId: string;
  projectName: string;
  missingDate: string;
  usersNotified: string[];
};

type NotificationUser = {
  id: string;
  email: string;
};

type NotificationProject = {
  id: string;
  name: string;
};

export function buildDiaryReminderCheckResponse(
  dateString: string,
  projectsChecked: number,
  remindersCreated: DiaryReminderResult[],
  usersNotified: Set<string>,
) {
  return {
    success: true,
    date: dateString,
    projectsChecked,
    remindersCreated: remindersCreated.length,
    uniqueUsersNotified: usersNotified.size,
    details: remindersCreated,
  };
}

export function buildDiaryReminderSendResponse(
  project: NotificationProject,
  dateString: string,
  users: NotificationUser[],
  notificationCount: number,
) {
  return {
    success: true,
    projectId: project.id,
    projectName: project.name,
    date: dateString,
    usersNotified: users.map((user) => ({ id: user.id, email: user.email })),
    notificationCount,
  };
}

export function buildMissingDiaryAlertsResponse(
  missingDate: string,
  projectsChecked: number,
  alertsCreated: MissingDiaryAlertResult[],
  usersNotified: Set<string>,
) {
  return {
    success: true,
    missingDate,
    projectsChecked,
    alertsCreated: alertsCreated.length,
    uniqueUsersNotified: usersNotified.size,
    details: alertsCreated,
  };
}
