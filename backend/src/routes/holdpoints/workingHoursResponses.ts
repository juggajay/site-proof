type ProjectWorkingHoursSource = {
  id: string;
  name: string;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  workingDays: string | null;
};

type NotificationTimeProjectSource = Omit<ProjectWorkingHoursSource, 'id' | 'name'>;

type NotificationTimeResult = {
  scheduledTime: Date;
  adjustedForWorkingHours: boolean;
  reason?: string;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function resolveWorkingHours(project: NotificationTimeProjectSource) {
  return {
    start: project.workingHoursStart || '07:00',
    end: project.workingHoursEnd || '17:00',
    days: project.workingDays || '1,2,3,4,5',
  };
}

export function buildNotificationTimeResponse(
  requestedDate: Date,
  result: NotificationTimeResult,
  project: NotificationTimeProjectSource,
) {
  return {
    requestedDateTime: requestedDate.toISOString(),
    scheduledNotificationTime: result.scheduledTime.toISOString(),
    adjustedForWorkingHours: result.adjustedForWorkingHours,
    adjustmentReason: result.reason,
    workingHours: resolveWorkingHours(project),
  };
}

export function buildProjectWorkingHoursResponse(project: ProjectWorkingHoursSource) {
  const workingHours = resolveWorkingHours(project);
  const workingDaysList = workingHours.days.split(',').map(Number);

  return {
    projectId: project.id,
    projectName: project.name,
    workingHours: {
      ...workingHours,
      dayNames: workingDaysList.map((dayIndex) => DAY_NAMES[dayIndex]),
    },
  };
}
