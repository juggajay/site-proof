import { useState } from 'react';
import type { ITPTemplate } from '../itpPageData';
import {
  TEMPLATE_ACTIVITY_TYPES,
  buildValidChecklistItems,
  createEmptyChecklistItem,
  type ChecklistEditorItem,
  type EditableChecklistItem,
} from '../itpTemplateFormData';
import { TemplateChecklistEditor } from './TemplateChecklistEditor';

// Feature #128 - Edit Template Modal with reorder functionality
export function EditTemplateModal({
  template,
  onClose,
  onSubmit,
  loading,
}: {
  template: ITPTemplate;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    activityType: string;
    checklistItems: EditableChecklistItem[];
  }) => void | Promise<void>;
  loading: boolean;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [activityType, setActivityType] = useState(template.activityType);
  const [checklistItems, setChecklistItems] = useState<EditableChecklistItem[]>(
    template.checklistItems
      .map((item) => ({
        description: item.description,
        category: item.category,
        responsibleParty: item.responsibleParty,
        isHoldPoint: item.isHoldPoint,
        pointType: item.pointType,
        evidenceRequired: item.evidenceRequired,
        verificationMethod: item.verificationMethod,
        acceptanceCriteria: item.acceptanceCriteria,
        testType: item.testType,
        order: item.order,
      }))
      .sort((a, b) => a.order - b.order),
  );

  const handleAddItem = () => {
    setChecklistItems([
      ...checklistItems,
      {
        ...createEmptyChecklistItem(),
        order: checklistItems.length,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof ChecklistEditorItem>(
    index: number,
    field: K,
    value: ChecklistEditorItem[K],
  ) => {
    const updated = [...checklistItems];
    updated[index] = { ...updated[index], [field]: value };
    setChecklistItems(updated);
  };

  // Feature #128 - Reorder functions
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...checklistItems];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setChecklistItems(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === checklistItems.length - 1) return;
    const updated = [...checklistItems];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setChecklistItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedName = name.trim();
    const trimmedActivityType = activityType.trim();
    if (!trimmedName || !trimmedActivityType) return;

    const validItems = buildValidChecklistItems(checklistItems);
    // Update order based on position in array
    const orderedItems = validItems.map((item, idx) => ({ ...item, order: idx }));
    void onSubmit({
      name: trimmedName,
      description: description.trim(),
      activityType: trimmedActivityType,
      checklistItems: orderedItems,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Edit ITP Template</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., Earthworks ITP"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Activity Type *</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                <option value="">Select activity type</option>
                {TEMPLATE_ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder="Optional description of this ITP template"
            />
          </div>

          <TemplateChecklistEditor
            label="Checklist Items (drag to reorder)"
            items={checklistItems}
            onAddItem={handleAddItem}
            onItemChange={handleItemChange}
            onRemoveItem={handleRemoveItem}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-muted"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              disabled={loading || !name.trim() || !activityType.trim()}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
