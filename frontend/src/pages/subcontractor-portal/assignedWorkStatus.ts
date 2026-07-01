export type AssignedWorkStatusGroup =
  | 'notStarted'
  | 'inProgress'
  | 'onHold'
  | 'completed'
  | 'other';

const STATUS_GROUP: Record<string, AssignedWorkStatusGroup> = {
  not_started: 'notStarted',
  in_progress: 'inProgress',
  awaiting_test: 'inProgress',
  on_hold: 'onHold',
  hold_point: 'onHold',
  ncr_raised: 'onHold',
  completed: 'completed',
  conformed: 'completed',
  claimed: 'completed',
};

export function getAssignedWorkStatusGroup(
  status: string | null | undefined,
): AssignedWorkStatusGroup {
  if (!status) return 'notStarted';
  return STATUS_GROUP[status] ?? 'other';
}
