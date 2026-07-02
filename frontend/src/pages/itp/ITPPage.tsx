import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken, useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { canManageItpTemplates, hasRoleInGroup, ROLE_GROUPS } from '@/lib/roles';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import {
  applyItpTemplatesUpdate,
  useItpTemplatesQuery,
  type ChecklistItem,
  type ITPTemplate,
} from './itpPageData';
import { formatActivityTypeLabel, type NewChecklistItem } from './itpTemplateFormData';
import { CreateTemplateModal } from './components/CreateTemplateModal';
import { EditTemplateModal } from './components/EditTemplateModal';
import { ImportFromProjectModal } from './components/ImportFromProjectModal';
import { PendingItpVerificationsSection } from './components/PendingItpVerificationsSection';

export function ITPPage() {
  const { projectId } = useParams();
  const { user, actualRole } = useAuth();
  // Foremen (and other field roles) can view ITP templates for context but must
  // not be led into template setup/admin work — those actions 403 on the backend.
  const canManage = canManageItpTemplates(actualRole);
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // Feature #128
  const [editingTemplate, setEditingTemplate] = useState<ITPTemplate | null>(null); // Feature #128
  const [editError, setEditError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [togglingTemplateId, setTogglingTemplateId] = useState<string | null>(null);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);
  const [includeGlobalTemplates, setIncludeGlobalTemplates] = useState(true);
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('');
  const [responsiblePartyFilter, setResponsiblePartyFilter] = useState<string>(''); // Feature #711

  const token = getAuthToken();

  const templatesQuery = useItpTemplatesQuery(projectId, includeGlobalTemplates);
  const templates = templatesQuery.data?.templates ?? [];
  const projectSpecificationSet = templatesQuery.data?.projectSpecificationSet ?? null;
  // Library (state spec) templates ride along in the same list when the
  // include-library filter is on; the project's own templates are the ones the
  // project actually owns. The split drives the empty/lead states below.
  const projectTemplates = templates.filter((t) => !t.isGlobalTemplate);
  const hasLibraryTemplates = templates.some((t) => t.isGlobalTemplate);
  // Project settings (where the specification set is chosen) is admin-gated in
  // App.tsx. Site/quality managers can manage templates but would be bounced by
  // that route, so library guidance must not link them to settings.
  const canOpenProjectSettings = hasRoleInGroup(actualRole, ROLE_GROUPS.ADMIN);
  // Spinner only while a fetch is genuinely in flight with nothing to show yet —
  // covers first load and the "Try again" refetch, and stays false when the
  // query is disabled (no projectId/token), matching the previous behavior.
  const loading = templatesQuery.isFetching && !templatesQuery.data;
  const error =
    templatesQuery.error && !templatesQuery.data
      ? extractErrorMessage(templatesQuery.error, 'Failed to load ITP templates.')
      : null;

  // Replaces the previous `setTemplates(...)` optimistic updates: write straight
  // to the active query's cache so create/clone/import/toggle/edit keep updating
  // the visible list instantly, with no refetch and identical ordering.
  const setTemplatesCache = (updater: (prev: ITPTemplate[]) => ITPTemplate[]) =>
    applyItpTemplatesUpdate(queryClient, projectId, includeGlobalTemplates, updater);

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

      setTemplatesCache((prev) => [result.template, ...prev]);
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

      setTemplatesCache((prev) =>
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

      setTemplatesCache((prev) => [result.template, ...prev]);
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
    setEditError(null);
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
    setEditError(null);
    try {
      const result = await apiFetch<{ template: ITPTemplate }>(
        `/api/itp/templates/${encodeURIComponent(templateId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      );

      setTemplatesCache((prev) => prev.map((t) => (t.id === templateId ? result.template : t)));
      setShowEditModal(false);
      setEditingTemplate(null);
    } catch (err) {
      logError('Failed to update template:', err);
      // Keep the explanation inside the open modal so the admin can read why the
      // save was blocked (e.g. an in-use template) and the next step to take,
      // rather than an auto-dismissing toast.
      setEditError(extractErrorMessage(err, 'Failed to update template. Please try again.'));
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

      setTemplatesCache((prev) => [result.template, ...prev]);
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
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Inspection & Test Plans</h1>
            <ContextHelp title={HELP_CONTENT.itp.title} content={HELP_CONTENT.itp.content} />
          </div>
          <p className="text-muted-foreground mt-1">
            {canManage
              ? 'Manage ITP templates for quality checkpoints'
              : 'View ITP templates and complete checklist items from each lot'}{' '}
            {projectSpecificationSet && (
              <span className="inline-flex text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                {projectSpecificationSet}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {canManage ? (
            <>
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
            </>
          ) : (
            projectId && (
              <Link
                to={`/projects/${projectId}/lots`}
                className="rounded-lg border px-4 py-2 hover:bg-muted"
              >
                Back to Lots
              </Link>
            )
          )}
        </div>
      </div>

      {/* H4: head-contractor pending-verifications queue (renders only for
          reviewers; the endpoint 403s for everyone else). */}
      {projectId && (
        <PendingItpVerificationsSection projectId={projectId} currentUserId={user?.id} />
      )}

      {/* Filters */}
      <div className="flex items-center gap-6 pb-2 border-b">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeGlobalTemplates}
            onChange={(e) => setIncludeGlobalTemplates(e.target.checked)}
            className="rounded border-border accent-primary"
          />
          {/* Spec set is legitimately nullable; fall back to neutral wording
              (matching the 'Library' template badge below) instead of a
              state-specific standard the project may not use. */}
          <span className="text-sm">
            Include {projectSpecificationSet || 'state spec'} library templates
          </span>
        </label>

        {/* Activity Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Activity Type:</label>
          <select
            value={activityTypeFilter}
            onChange={(e) => setActivityTypeFilter(e.target.value)}
            className="text-sm border border-border bg-background text-foreground rounded px-2 py-1"
          >
            <option value="">All Activities</option>
            {[...new Set(templates.map((t) => t.activityType))].sort().map((type) => (
              <option key={type} value={type}>
                {formatActivityTypeLabel(type)}
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
            className="text-sm border border-border bg-background text-foreground rounded px-2 py-1"
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
            onClick={() => void templatesQuery.refetch()}
            className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : templates.length === 0 ? (
        canManage ? (
          // The state-spec template library is the fastest start, so the empty
          // state leads with it and demotes build-from-scratch to secondary.
          // Library templates are keyed off the project's specification set, so
          // each branch is honest about why the library list is empty here.
          !projectSpecificationSet ? (
            <div className="rounded-lg border p-8 text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-lg font-semibold mb-2">Start from the state spec ITP library</h3>
              <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
                CIVOS includes ready-made ITP templates for each state road specification.
                {canOpenProjectSettings
                  ? " Choose this project's specification standard to unlock the matching library templates, or build a template from scratch."
                  : " Ask a project admin to choose this project's specification standard in project settings to unlock the matching library templates, or build a template from scratch."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {canOpenProjectSettings && projectId && (
                  <Link
                    to={`/projects/${projectId}/settings`}
                    className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
                  >
                    Choose a specification standard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className={
                    canOpenProjectSettings
                      ? 'rounded-lg border px-4 py-2 hover:bg-muted'
                      : 'rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90'
                  }
                >
                  Build a template from scratch
                </button>
              </div>
            </div>
          ) : !includeGlobalTemplates ? (
            <div className="rounded-lg border p-8 text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-lg font-semibold mb-2">No project templates yet</h3>
              <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
                Start from the {projectSpecificationSet} library — copy a ready-made template into
                this project instead of building checklists row by row.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIncludeGlobalTemplates(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
                >
                  Browse {projectSpecificationSet} library templates
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-lg border px-4 py-2 hover:bg-muted"
                >
                  Build a template from scratch
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border p-8 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold mb-2">
                No {projectSpecificationSet} library templates yet
              </h3>
              <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
                The template library has nothing for {projectSpecificationSet} yet. Build a template
                from scratch, or import one from another project.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
                >
                  Build a template from scratch
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="rounded-lg border px-4 py-2 hover:bg-muted"
                >
                  Import from Project
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-lg border p-8 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No ITP templates available</h3>
            <p className="text-muted-foreground mb-4">
              No ITP templates are available for this project yet. Ask your project manager or site
              engineer to assign a template, then complete checklist items from the lot.
            </p>
            {projectId && (
              <Link
                to={`/projects/${projectId}/lots`}
                className="inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Go to Lots
              </Link>
            )}
          </div>
        )
      ) : (
        <>
          {/* Library-led lead-in: the project owns no templates yet, but the
              spec-set library below is ready to copy from. Managers only —
              field roles must not be led into template setup work. */}
          {canManage && projectTemplates.length === 0 && hasLibraryTemplates && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  Start from the {projectSpecificationSet || 'state spec'} library
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This project has no ITP templates of its own yet. Copy a library template below to
                  add an editable version to this project.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted shrink-0"
              >
                Build a template from scratch
              </button>
            </div>
          )}
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
                    template.isActive === false
                      ? 'opacity-60 bg-muted/30'
                      : 'hover:border-primary/50'
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
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {formatActivityTypeLabel(template.activityType)}
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
                  {canManage && (
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
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
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
                  )}
                </div>
              ))}
          </div>
        </>
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
            setEditError(null);
          }}
          onSubmit={(data) => handleUpdateTemplate(editingTemplate.id, data)}
          loading={creating}
          errorMessage={editError}
        />
      )}
    </div>
  );
}
