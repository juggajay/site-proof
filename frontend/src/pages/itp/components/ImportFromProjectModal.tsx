import { useState } from 'react';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useCrossProjectItpTemplatesQuery } from '../itpPageData';
import { formatActivityTypeLabel } from '../itpTemplateFormData';

export function ImportFromProjectModal({
  onClose,
  onImport,
  currentProjectId,
}: {
  onClose: () => void;
  onImport: (templateId: string) => Promise<boolean>;
  currentProjectId: string;
}) {
  const [importing, setImporting] = useState<string | null>(null);
  const [userSelectedProject, setUserSelectedProject] = useState<string | null>(null);
  const [importedTemplates, setImportedTemplates] = useState<Set<string>>(new Set());

  const crossProjectQuery = useCrossProjectItpTemplatesQuery(currentProjectId);
  const projects = crossProjectQuery.data ?? [];
  const loading = crossProjectQuery.isFetching && !crossProjectQuery.data;
  const error =
    crossProjectQuery.error && !crossProjectQuery.data
      ? extractErrorMessage(
          crossProjectQuery.error,
          'Failed to load templates from other projects.',
        )
      : null;
  // Default to the first project once data arrives (matching the old fetch's
  // `setSelectedProject(projects[0].id)`); a manual pick takes precedence.
  const selectedProject = userSelectedProject ?? projects[0]?.id ?? '';

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
              onClick={() => void crossProjectQuery.refetch()}
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
                onChange={(e) => setUserSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg"
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
                      <span className="bg-muted px-2 py-0.5 rounded">
                        {formatActivityTypeLabel(template.activityType)}
                      </span>
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
                        ? 'bg-muted text-muted-foreground'
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
