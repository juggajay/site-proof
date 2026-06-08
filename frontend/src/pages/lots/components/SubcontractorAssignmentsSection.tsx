import { Plus } from 'lucide-react';
import type { Lot, LotSubcontractorAssignment } from '../types';

export interface SubcontractorAssignmentsSectionProps {
  lot: Lot;
  assignments: LotSubcontractorAssignment[];
  canManageLot: boolean;
  removeAssignmentPending: boolean;
  onAddSubcontractor: () => void;
  onEditAssignment: (assignment: LotSubcontractorAssignment) => void;
  onRemoveAssignment: (assignmentId: string) => void;
}

export function SubcontractorAssignmentsSection({
  lot,
  assignments,
  canManageLot,
  removeAssignmentPending,
  onAddSubcontractor,
  onEditAssignment,
  onRemoveAssignment,
}: SubcontractorAssignmentsSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Assigned Subcontractors</h3>
        {canManageLot && (
          <button
            onClick={onAddSubcontractor}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        )}
      </div>

      {/* Show legacy assignment if exists but not in new assignments table */}
      {lot.assignedSubcontractor &&
        !assignments.some((a) => a.subcontractorCompany.id === lot.assignedSubcontractorId) && (
          <div className="mb-3 p-3 bg-warning/10 border border-warning/30 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">
                  {lot.assignedSubcontractor.companyName}
                </div>
                <div className="text-sm text-warning">
                  Legacy assignment - click Add to set ITP permissions
                </div>
              </div>
            </div>
          </div>
        )}

      {assignments.length === 0 && !lot.assignedSubcontractor ? (
        <p className="text-sm text-muted-foreground">No subcontractors assigned</p>
      ) : assignments.length > 0 ? (
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between p-3 bg-muted rounded-md"
            >
              <div>
                <div className="font-medium">{assignment.subcontractorCompany.companyName}</div>
                <div className="text-sm text-muted-foreground">
                  ITP:{' '}
                  {assignment.canCompleteITP ? (
                    <>
                      <span className="text-muted-foreground">Can complete</span>
                      {assignment.itpRequiresVerification && (
                        <span className="text-warning ml-2">Requires verification</span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">View only</span>
                  )}
                </div>
              </div>
              {canManageLot && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditAssignment(assignment)}
                    className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted border rounded-md transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemoveAssignment(assignment.id)}
                    disabled={removeAssignmentPending}
                    className="px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 border border-destructive/30 rounded-md transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
