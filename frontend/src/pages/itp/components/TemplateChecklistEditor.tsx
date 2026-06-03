import type { ChecklistItem } from '../itpPageData';
import type { ChecklistEditorItem, ChecklistItemChange } from '../itpTemplateFormData';

/**
 * The checklist-items editor shared by the create and edit template modals.
 *
 * The markup is identical between the two modals; only the section label
 * differs ("Checklist Items" vs "Checklist Items (drag to reorder)"), so it is
 * a prop. Each modal still owns its own item state and the add/remove/move/
 * change handlers, which keeps every behavior (including the two sequential
 * `onItemChange` calls fired by the responsible-party select) exactly as it was
 * when this lived inline.
 */
export function TemplateChecklistEditor({
  label,
  items,
  onAddItem,
  onItemChange,
  onRemoveItem,
  onMoveUp,
  onMoveDown,
}: {
  label: string;
  items: ChecklistEditorItem[];
  onAddItem: () => void;
  onItemChange: ChecklistItemChange;
  onRemoveItem: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium">{label}</label>
        <button type="button" onClick={onAddItem} className="text-sm text-primary hover:underline">
          + Add Item
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
            {/* Reorder controls */}
            <div className="flex flex-col gap-1 pt-1">
              <button
                type="button"
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
                className="w-6 h-6 rounded border text-xs hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(index)}
                disabled={index === items.length - 1}
                className="w-6 h-6 rounded border text-xs hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                ↓
              </button>
              <span className="text-xs text-muted-foreground text-center w-6">{index + 1}</span>
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={item.description}
                onChange={(e) => onItemChange(index, 'description', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Checklist item description"
              />
              <div className="flex items-center gap-4">
                <select
                  value={item.responsibleParty || 'contractor'}
                  onChange={(e) => {
                    const responsibleParty = e.target.value as ChecklistItem['responsibleParty'];
                    onItemChange(index, 'responsibleParty', responsibleParty);
                    onItemChange(index, 'category', e.target.value);
                  }}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="contractor">Contractor</option>
                  <option value="subcontractor">Subcontractor</option>
                  <option value="superintendent">Superintendent</option>
                </select>
                <select
                  value={item.pointType || 'standard'}
                  onChange={(e) => {
                    const newPointType = e.target.value as 'standard' | 'witness' | 'hold_point';
                    onItemChange(index, 'pointType', newPointType);
                    onItemChange(index, 'isHoldPoint', newPointType === 'hold_point');
                  }}
                  className="px-2 py-1 text-sm border rounded"
                >
                  <option value="standard">S - Standard</option>
                  <option value="witness">W - Witness</option>
                  <option value="hold_point">H - Hold Point</option>
                </select>
                <select
                  value={item.evidenceRequired || 'none'}
                  onChange={(e) =>
                    onItemChange(
                      index,
                      'evidenceRequired',
                      e.target.value as ChecklistItem['evidenceRequired'],
                    )
                  }
                  className="px-2 py-1 text-sm border rounded"
                >
                  <option value="none">No Evidence</option>
                  <option value="photo">📷 Photo</option>
                  <option value="test">🧪 Test</option>
                  <option value="document">📄 Document</option>
                </select>
                {item.evidenceRequired === 'test' && (
                  <input
                    type="text"
                    value={item.testType || ''}
                    onChange={(e) => onItemChange(index, 'testType', e.target.value)}
                    className="px-2 py-1 text-sm border rounded w-28"
                    placeholder="Test type"
                  />
                )}
              </div>
            </div>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveItem(index)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
