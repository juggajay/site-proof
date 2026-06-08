import { useState } from 'react';
import type { ChecklistItem } from '../itpPageData';
import {
  TEMPLATE_ACTIVITY_TYPES,
  buildValidChecklistItems,
  createEmptyChecklistItem,
  type ChecklistEditorItem,
  type NewChecklistItem,
} from '../itpTemplateFormData';
import { TemplateChecklistEditor } from './TemplateChecklistEditor';

export function CreateTemplateModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    activityType: string;
    checklistItems: Omit<ChecklistItem, 'id' | 'order'>[];
  }) => void | Promise<void>;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('');
  const [checklistItems, setChecklistItems] = useState<NewChecklistItem[]>([
    createEmptyChecklistItem(),
  ]);

  const handleAddItem = () => {
    setChecklistItems([...checklistItems, createEmptyChecklistItem()]);
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

  // Feature #128 - Drag-and-drop reorder functions
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

    void onSubmit({
      name: trimmedName,
      description: description.trim(),
      activityType: trimmedActivityType,
      checklistItems: validItems,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Create ITP Template</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg"
                placeholder="e.g., Earthworks ITP"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Activity Type *</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg"
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
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg"
              rows={2}
              placeholder="Optional description of this ITP template"
            />
          </div>

          <TemplateChecklistEditor
            label="Checklist Items"
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
              {loading ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
