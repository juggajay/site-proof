import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Save, Trash2 } from 'lucide-react';
import { deleteView, listViews, saveView, type SavedView } from '@/lib/savedViews';

interface SavedViewsMenuProps {
  /** Namespace for this register's presets, e.g. 'ncrs', 'hold-points', 'test-results'. */
  registerKey: string;
}

/**
 * Compact "Views" control for a URL-searchParams register filter bar. Lists
 * named presets (saved per-browser via localStorage), applies one by navigating
 * to its stored querystring, saves the current filter querystring under a name,
 * and deletes presets. Self-contained: it reads/writes the register's
 * searchParams directly, so a bar only needs to render it with a registerKey.
 */
export function SavedViewsMenu({ registerKey }: SavedViewsMenuProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [views, setViews] = useState<SavedView[]>(() => listViews(registerKey));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const currentQuery = searchParams.toString();
  const canSave = currentQuery.length > 0;

  const closeMenu = () => {
    setOpen(false);
    setSaving(false);
    setNewName('');
  };

  const applyView = (view: SavedView) => {
    setSearchParams(new URLSearchParams(view.query));
    closeMenu();
  };

  const handleSave = () => {
    if (!newName.trim() || !canSave) return;
    setViews(saveView(registerKey, newName, currentQuery));
    setSaving(false);
    setNewName('');
  };

  const handleDelete = (id: string) => {
    setViews(deleteView(registerKey, id));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? closeMenu() : setOpen(true))}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted/50"
        title="Saved views"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bookmark className="h-4 w-4" />
        Views{views.length > 0 ? ` (${views.length})` : ''}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeMenu} />
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border bg-card shadow-lg">
            <div className="border-b p-2">
              <span className="text-xs font-medium text-muted-foreground">Saved views</span>
            </div>

            <div className="max-h-60 overflow-y-auto">
              {views.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No saved views yet.</p>
              ) : (
                views.map((view) => (
                  <div
                    key={view.id}
                    className="group flex items-center justify-between px-3 py-2 hover:bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => applyView(view)}
                      className="flex-1 truncate text-left text-sm"
                      title={`Apply view: ${view.name}`}
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(view.id);
                      }}
                      className="ml-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title="Delete view"
                      aria-label={`Delete view ${view.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t p-2">
              {saving ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleSave();
                      if (event.key === 'Escape') {
                        setSaving(false);
                        setNewName('');
                      }
                    }}
                    placeholder="View name"
                    aria-label="New view name"
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!newName.trim()}
                    className="rounded bg-primary px-2 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSaving(true)}
                  disabled={!canSave}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  title={canSave ? 'Save current filters as a view' : 'Apply a filter first'}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save current view…
                </button>
              )}
            </div>

            <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
              Saved on this device
            </div>
          </div>
        </>
      )}
    </div>
  );
}
