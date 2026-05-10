import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getAuthToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';

interface ChecklistItem {
  id?: string;
  description: string;
  category: string;
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general';
  isHoldPoint: boolean;
  pointType: 'standard' | 'witness' | 'hold_point';
  evidenceRequired: 'none' | 'photo' | 'test' | 'document';
  verificationMethod?: string;
  acceptanceCriteria?: string;
  testType?: string;
  order: number;
}

type NewChecklistItem = Omit<ChecklistItem, 'id' | 'order'>;
type EditableChecklistItem = Omit<ChecklistItem, 'id'>;

interface ITPTemplate {
  id: string;
  name: string;
  description: string | null;
  activityType: string;
  checklistItems: ChecklistItem[];
  createdAt: string;
  isGlobalTemplate?: boolean;
  stateSpec?: string | null;
  isActive?: boolean;
}

interface CrossProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  activityType: string;
  checklistItemCount: number;
  holdPointCount: number;
}

interface ProjectWithTemplates {
  id: string;
  name: string;
  code: string;
  templates: CrossProjectTemplate[];
}

export function ITPPage() {
  const { projectId } = useParams();
  const [templates, setTemplates] = useState<ITPTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // Feature #128
  const [editingTemplate, setEditingTemplate] = useState<ITPTemplate | null>(null); // Feature #128
  const [creating, setCreating] = useState(false);
  const [togglingTemplateId, setTogglingTemplateId] = useState<string | null>(null);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);
  const [includeGlobalTemplates, setIncludeGlobalTemplates] = useState(true);
  const [projectSpecificationSet, setProjectSpecificationSet] = useState<string | null>(null);
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('');
  const [responsiblePartyFilter, setResponsiblePartyFilter] = useState<string>(''); // Feature #711
  const [error, setError] = useState<string | null>(null);

  const token = getAuthToken();

  const fetchTemplates = useCallback(async () => {
    if (!projectId || !token) {
      setTemplates([]);
      setProjectSpecificationSet(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ templates: ITPTemplate[]; projectSpecificationSet?: string }>(
        `/api/itp/templates?projectId=${encodeURIComponent(projectId)}&includeGlobal=${includeGlobalTemplates ? 'true' : 'false'}`,
      );
      setTemplates(data.templates || []);
      setProjectSpecificationSet(data.projectSpecificationSet || null);
    } catch (err) {
      logError('Failed to fetch ITP templates:', err);
      setTemplates([]);
      setProjectSpecificationSet(null);
      setError(extractErrorMessage(err, 'Failed to load ITP templates.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, token, includeGlobalTemplates]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateTemplate = async (data: {
    name: string;
    description: string;
    activityType: string;
    checklistItems: NewChecklistItem[];
  }) => {
    if (!projectId || !token || creating) return;

    setCreating(true);
    try {
      const result = await apiFetch<{ template: ITPTemplate }>('/api/itp/templates', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          ...data,
        }),
      });

      setTemplates((prev) => [result.template, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      logError('Failed to create template:', err);
      toast({
        title: 'Failed to create template',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (template: ITPTemplate) => {
    if (!token || template.isGlobalTemplate || togglingTemplateId === template.id) return;

    setTogglingTemplateId(template.id);
    try {
      const result = await apiFetch<{ template: ITPTemplate }>(
        `/api/itp/templates/${encodeURIComponent(template.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            isActive: !template.isActive,
          }),
        },
      );

      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, isActive: result.template.isActive } : t)),
      );
    } catch (err) {
      logError('Failed to toggle template status:', err);
      toast({
        title: 'Failed to update template status',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      setTogglingTemplateId(null);
    }
  };

  const handleCloneTemplate = async (template: ITPTemplate) => {
    if (!token || !projectId || cloningTemplateId === template.id) return;

    setCloningTemplateId(template.id);
    try {
      const result = await apiFetch<{ template: ITPTemplate }>(
        `/api/itp/templates/${encodeURIComponent(template.id)}/clone`,
        {
          method: 'POST',
          body: JSON.stringify({
            projectId,
          }),
        },
      );

      setTemplates((prev) => [result.template, ...prev]);
    } catch (err) {
      logError('Failed to clone template:', err);
      toast({
        title: 'Failed to copy template',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      setCloningTemplateId(null);
    }
  };

  // Feature #128 - Edit template handler
  const handleEditTemplate = (template: ITPTemplate) => {
    setEditingTemplate(template);
    setShowEditModal(true);
  };

  // Feature #128 - Update template after edit
  const handleUpdateTemplate = async (
    templateId: string,
    data: {
      name: string;
      description: string;
      activityType: string;
      checklistItems: Omit<ChecklistItem, 'id'>[];
    },
  ) => {
    if (!token || creating) return;

    setCreating(true);
    try {
      const result = await apiFetch<{ template: ITPTemplate }>(
        `/api/itp/templates/${encodeURIComponent(templateId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      );

      setTemplates((prev) => prev.map((t) => (t.id === templateId ? result.template : t)));
      setShowEditModal(false);
      setEditingTemplate(null);
    } catch (err) {
      logError('Failed to update template:', err);
      toast({
        title: 'Failed to update template',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleImportTemplate = async (templateId: string): Promise<boolean> => {
    if (!token || !projectId) return false;

    try {
      const result = await apiFetch<{ template: ITPTemplate }>(
        `/api/itp/templates/${encodeURIComponent(templateId)}/clone`,
        {
          method: 'POST',
          body: JSON.stringify({
            projectId,
          }),
        },
      );

      setTemplates((prev) => [result.template, ...prev]);
      return true;
    } catch (err) {
      logError('Failed to import template:', err);
      toast({
        title: 'Failed to import template',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inspection & Test Plans</h1>
          <p className="text-muted-foreground mt-1">
            Manage ITP templates for quality checkpoints
            {projectSpecificationSet && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                {projectSpecificationSet}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="rounded-lg border px-4 py-2 hover:bg-muted"
          >
            Import from Project
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Create ITP Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 pb-2 border-b">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeGlobalTemplates}
            onChange={(e) => setIncludeGlobalTemplates(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm">
            Include {projectSpecificationSet || 'MRTS'} library templates
          </span>
        </label>

        {/* Activity Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Activity Type:</label>
          <select
            value={activityTypeFilter}
            onChange={(e) => setActivityTypeFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="">All Activities</option>
            {[...new Set(templates.map((t) => t.activityType))].sort().map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Responsible Party Filter - Feature #711 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Responsible:</label>
          <select
            value={responsiblePartyFilter}
            onChange={(e) => setResponsiblePartyFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="">All Parties</option>
            <option value="contractor">Contractor</option>
            <option value="subcontractor">Subcontractor</option>
            <option value="superintendent">Superintendent</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8" role="status" aria-label="Loading ITP templates">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" role="alert">
          <h3 className="font-semibold text-destructive">Could not load ITP templates</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void fetchTemplates()}
            className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2">No ITP Templates</h3>
          <p className="text-muted-foreground mb-4">
            Create ITP templates to define quality checkpoints for different activity types.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates
            .filter((t) => !activityTypeFilter || t.activityType === activityTypeFilter)
            .filter(
              (t) =>
                !responsiblePartyFilter ||
                t.checklistItems.some((i) => i.responsibleParty === responsiblePartyFilter),
            ) // Feature #711
            .map((template) => (
              <div
                key={template.id}
                className={`rounded-lg border p-4 transition-colors ${
                  template.isActive === false ? 'opacity-60 bg-muted/30' : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{template.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {template.isGlobalTemplate && (
                        <span className="text-xs text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                          {template.stateSpec || 'Library'} Template
                        </span>
                      )}
                      {template.isActive === false && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded">
                    {template.activityType}
                  </span>
                </div>
                {template.description && (
                  <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {responsiblePartyFilter
                      ? `${template.checklistItems.filter((i) => i.responsibleParty === responsiblePartyFilter).length} ${responsiblePartyFilter} items`
                      : `${template.checklistItems.length} checklist items`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {
                      template.checklistItems.filter(
                        (i) =>
                          i.isHoldPoint &&
                          (!responsiblePartyFilter ||
                            i.responsibleParty === responsiblePartyFilter),
                      ).length
                    }{' '}
                    hold points
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCloneTemplate(template)}
                      disabled={cloningTemplateId === template.id}
                      className="text-xs px-2 py-1 rounded border hover:bg-muted disabled:opacity-50"
                      title="Clone template"
                    >
                      {cloningTemplateId === template.id ? 'Copying...' : 'Copy'}
                    </button>
                    {/* Feature #128 - Edit button */}
                    {!template.isGlobalTemplate && (
                      <button
                        type="button"
                        onClick={() => handleEditTemplate(template)}
                        className="text-xs px-2 py-1 rounded border hover:bg-muted"
                        title="Edit template"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {!template.isGlobalTemplate && (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(template)}
                      disabled={togglingTemplateId === template.id}
                      className={`text-xs px-2 py-1 rounded ${
                        template.isActive !== false
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      } disabled:opacity-50`}
                    >
                      {togglingTemplateId === template.id
                        ? 'Updating...'
                        : template.isActive !== false
                          ? 'Active'
                          : 'Inactive'}
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTemplate}
          loading={creating}
        />
      )}

      {showImportModal && projectId && (
        <ImportFromProjectModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportTemplate}
          currentProjectId={projectId}
        />
      )}

      {/* Feature #128 - Edit Template Modal */}
      {showEditModal && editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowEditModal(false);
            setEditingTemplate(null);
          }}
          onSubmit={(data) => handleUpdateTemplate(editingTemplate.id, data)}
          loading={creating}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({
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
    {
      description: '',
      category: 'general',
      responsibleParty: 'contractor',
      isHoldPoint: false,
      pointType: 'standard',
      evidenceRequired: 'none',
    },
  ]);

  const handleAddItem = () => {
    setChecklistItems([
      ...checklistItems,
      {
        description: '',
        category: 'general',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof NewChecklistItem>(
    index: number,
    field: K,
    value: NewChecklistItem[K],
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

    const validItems = checklistItems
      .map((item) => ({ ...item, description: item.description.trim() }))
      .filter((item) => item.description);

    void onSubmit({
      name: trimmedName,
      description: description.trim(),
      activityType: trimmedActivityType,
      checklistItems: validItems,
    });
  };

  const activityTypes = ['Earthworks', 'Drainage', 'Pavement', 'Concrete', 'Structures', 'General'];

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
                {activityTypes.map((type) => (
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Checklist Items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-sm text-primary hover:underline"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-3">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
                  {/* Feature #128 - Reorder controls */}
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="w-6 h-6 rounded border text-xs hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === checklistItems.length - 1}
                      className="w-6 h-6 rounded border text-xs hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <span className="text-xs text-muted-foreground text-center w-6">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Checklist item description"
                    />
                    <div className="flex items-center gap-4">
                      <select
                        value={item.responsibleParty || 'contractor'}
                        onChange={(e) => {
                          const responsibleParty = e.target
                            .value as ChecklistItem['responsibleParty'];
                          handleItemChange(index, 'responsibleParty', responsibleParty);
                          handleItemChange(index, 'category', e.target.value);
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
                          const newPointType = e.target.value as
                            | 'standard'
                            | 'witness'
                            | 'hold_point';
                          handleItemChange(index, 'pointType', newPointType);
                          handleItemChange(index, 'isHoldPoint', newPointType === 'hold_point');
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
                          handleItemChange(
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
                          onChange={(e) => handleItemChange(index, 'testType', e.target.value)}
                          className="px-2 py-1 text-sm border rounded w-28"
                          placeholder="Test type"
                        />
                      )}
                    </div>
                  </div>
                  {checklistItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

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

function ImportFromProjectModal({
  onClose,
  onImport,
  currentProjectId,
}: {
  onClose: () => void;
  onImport: (templateId: string) => Promise<boolean>;
  currentProjectId: string;
}) {
  const [projects, setProjects] = useState<ProjectWithTemplates[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [importedTemplates, setImportedTemplates] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchCrossProjectTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ projects: ProjectWithTemplates[] }>(
        `/api/itp/templates/cross-project?currentProjectId=${encodeURIComponent(currentProjectId)}`,
      );
      setProjects(data.projects || []);
      if (data.projects?.length > 0) {
        setSelectedProject(data.projects[0].id);
      } else {
        setSelectedProject('');
      }
    } catch (err) {
      logError('Failed to fetch cross-project templates:', err);
      setProjects([]);
      setSelectedProject('');
      setError(extractErrorMessage(err, 'Failed to load templates from other projects.'));
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    void fetchCrossProjectTemplates();
  }, [fetchCrossProjectTemplates]);

  const handleImport = async (templateId: string) => {
    if (importing === templateId || importedTemplates.has(templateId)) return;

    setImporting(templateId);
    try {
      const success = await onImport(templateId);
      if (success) {
        setImportedTemplates((prev) => new Set(prev).add(templateId));
      }
    } finally {
      setImporting(null);
    }
  };

  const currentProject = projects.find((p) => p.id === selectedProject);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Import ITP Template from Another Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div
            className="flex justify-center p-8"
            role="status"
            aria-label="Loading project templates"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
            role="alert"
          >
            <h3 className="font-semibold text-destructive">Could not load project templates</h3>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => void fetchCrossProjectTemplates()}
              className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No Templates Available</h3>
            <p className="text-muted-foreground">
              There are no ITP templates in other projects that you can import.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.code}) - {project.templates.length} template(s)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              {currentProject?.templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border-b last:border-b-0 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-medium">{template.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="bg-muted px-2 py-0.5 rounded">{template.activityType}</span>
                      <span>{template.checklistItemCount} checklist items</span>
                      <span>{template.holdPointCount} hold points</span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImport(template.id)}
                    disabled={importing === template.id || importedTemplates.has(template.id)}
                    className={`px-3 py-1.5 rounded text-sm ${
                      importedTemplates.has(template.id)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    } disabled:opacity-50`}
                  >
                    {importing === template.id
                      ? 'Importing...'
                      : importedTemplates.has(template.id)
                        ? '✓ Imported'
                        : 'Import'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end mt-4 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Feature #128 - Edit Template Modal with reorder functionality
function EditTemplateModal({
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
        description: '',
        category: 'general',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
        order: checklistItems.length,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof EditableChecklistItem>(
    index: number,
    field: K,
    value: EditableChecklistItem[K],
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

    const validItems = checklistItems
      .map((item) => ({ ...item, description: item.description.trim() }))
      .filter((item) => item.description);
    // Update order based on position in array
    const orderedItems = validItems.map((item, idx) => ({ ...item, order: idx }));
    void onSubmit({
      name: trimmedName,
      description: description.trim(),
      activityType: trimmedActivityType,
      checklistItems: orderedItems,
    });
  };

  const activityTypes = ['Earthworks', 'Drainage', 'Pavement', 'Concrete', 'Structures', 'General'];

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
                {activityTypes.map((type) => (
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Checklist Items (drag to reorder)</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-sm text-primary hover:underline"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-3">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
                  {/* Reorder controls */}
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="w-6 h-6 rounded border text-xs hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === checklistItems.length - 1}
                      className="w-6 h-6 rounded border text-xs hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <span className="text-xs text-muted-foreground text-center w-6">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Checklist item description"
                    />
                    <div className="flex items-center gap-4">
                      <select
                        value={item.responsibleParty || 'contractor'}
                        onChange={(e) => {
                          const responsibleParty = e.target
                            .value as ChecklistItem['responsibleParty'];
                          handleItemChange(index, 'responsibleParty', responsibleParty);
                          handleItemChange(index, 'category', e.target.value);
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
                          const newPointType = e.target.value as
                            | 'standard'
                            | 'witness'
                            | 'hold_point';
                          handleItemChange(index, 'pointType', newPointType);
                          handleItemChange(index, 'isHoldPoint', newPointType === 'hold_point');
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
                          handleItemChange(
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
                          onChange={(e) => handleItemChange(index, 'testType', e.target.value)}
                          className="px-2 py-1 text-sm border rounded w-28"
                          placeholder="Test type"
                        />
                      )}
                    </div>
                  </div>
                  {checklistItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

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
