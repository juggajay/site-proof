import { useNavigate } from 'react-router-dom';
import type { ITPTemplate, Lot } from '../types';
import {
  isItpTemplateActivityMatch,
  sortItpTemplatesForLotActivity,
} from './itpChecklistTabHelpers';

// The lot ITP tab before a template is attached: the assignment card plus its
// picker for managers, and execution guidance for field roles. Extracted from
// ITPChecklistTab unchanged.

interface ITPAssignTemplateSectionProps {
  lot: Lot;
  projectId: string;
  templates: ITPTemplate[];
  canAssignITPTemplate: boolean;
  assigningTemplate: boolean;
  onAssignTemplate: (templateId: string) => Promise<boolean>;
  /** Scrolled into view and auto-opened by the tab's deep-link effect. */
  cardRef: React.RefObject<HTMLDivElement>;
  showAssignModal: boolean;
  onShowAssignModal: (show: boolean) => void;
}

export function ITPAssignTemplateSection({
  lot,
  projectId,
  templates,
  canAssignITPTemplate,
  assigningTemplate,
  onAssignTemplate,
  cardRef,
  showAssignModal,
  onShowAssignModal,
}: ITPAssignTemplateSectionProps) {
  const navigate = useNavigate();

  return (
    <>
      <div ref={cardRef} className="rounded-lg border p-6 text-center">
        <div className="text-4xl mb-2">ITP</div>
        <h3 className="text-lg font-semibold mb-2">ITP Checklist</h3>
        {canAssignITPTemplate ? (
          <>
            <p className="text-muted-foreground mb-4">
              No ITP template assigned to this lot yet. Assign an ITP template to track quality
              checkpoints.
            </p>
            {templates.length > 0 ? (
              <button
                onClick={() => onShowAssignModal(true)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Assign ITP Template
              </button>
            ) : (
              <button
                onClick={() => navigate(`/projects/${encodeURIComponent(projectId)}/itp`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Create ITP Template First
              </button>
            )}
          </>
        ) : (
          <p className="text-muted-foreground mb-0">
            An ITP template needs to be assigned before this lot can be checked off. Ask your
            project manager or site engineer to assign one, then complete checklist items from the
            lot.
          </p>
        )}
      </div>

      {/* Assign Template Modal */}
      {canAssignITPTemplate && showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Assign ITP Template</h2>
            {lot.activityType && (
              <p className="text-sm text-muted-foreground mb-3">
                Templates matching{' '}
                <span className="font-medium text-foreground">{lot.activityType}</span> are
                suggested first. Other active templates remain available if this lot needs a
                different checklist.
              </p>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {/* Sort templates: matching activity type first, then others */}
              {sortItpTemplatesForLotActivity(templates, lot.activityType).map((template) => {
                const isMatch = isItpTemplateActivityMatch(template, lot.activityType);
                return (
                  <button
                    key={template.id}
                    onClick={async () => {
                      const assigned = await onAssignTemplate(template.id);
                      if (assigned) {
                        onShowAssignModal(false);
                      }
                    }}
                    disabled={assigningTemplate}
                    className={`w-full text-left p-3 border rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50 ${
                      isMatch ? 'border-primary/40 bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      {isMatch && (
                        <span className="text-xs bg-foreground/10 text-foreground px-2 py-0.5 rounded-full">
                          Suggested
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {template.activityType} - {template.checklistItems.length} items
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => onShowAssignModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={assigningTemplate}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
