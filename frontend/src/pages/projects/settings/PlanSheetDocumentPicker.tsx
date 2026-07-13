import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatDocumentDate, isPdfDocument } from '@/pages/documents/documentsDisplayData';

export interface PickerDocument {
  id: string;
  filename: string;
  mimeType: string | null;
  uploadedAt: string;
}

interface DocumentsListResponse {
  documents?: PickerDocument[];
}

// The picker lists the project's most recent documents (one page). A project
// with a very deep document history could have older PDFs beyond this window;
// ponytail: server-side search can be wired in if that ceiling is ever hit.
const DOC_PICKER_LIMIT = 100;

function isPdf(doc: PickerDocument): boolean {
  return isPdfDocument(doc.mimeType) || /\.pdf$/i.test(doc.filename);
}

interface PlanSheetDocumentPickerProps {
  projectId: string;
  disabled?: boolean;
  selectedId?: string | null;
  onSelect: (doc: PickerDocument) => void;
}

/**
 * Lists the project's PDF documents so an existing drawing can be turned into a
 * plan sheet without re-uploading. Presentational only — the parent downloads
 * the chosen document (via the authenticated file route) and feeds it through
 * the same rasterise pipeline as a fresh upload.
 */
export function PlanSheetDocumentPicker({
  projectId,
  disabled,
  selectedId,
  onSelect,
}: PlanSheetDocumentPickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.documents(projectId), 'plan-sheet-picker'] as const,
    queryFn: () =>
      apiFetch<DocumentsListResponse>(
        `/api/documents/${encodeURIComponent(projectId)}?limit=${DOC_PICKER_LIMIT}`,
      ),
    enabled: Boolean(projectId),
  });

  const pdfs = useMemo(() => (data?.documents ?? []).filter(isPdf), [data?.documents]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? pdfs.filter((doc) => doc.filename.toLowerCase().includes(query)) : pdfs;
  }, [pdfs, search]);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
      </p>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {extractErrorMessage(error, 'Failed to load documents.')}
      </div>
    );
  }

  if (pdfs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No PDF documents in this project yet. Upload a drawing to the Documents area first, or use
        the Upload file tab.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          disabled={disabled}
          className="pl-8"
          aria-label="Search documents"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No documents match &quot;{search.trim()}&quot;.
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border">
          {filtered.map((doc) => {
            const selected = doc.id === selectedId;
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => onSelect(doc)}
                  disabled={disabled}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected ? 'bg-primary/10' : ''
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{doc.filename}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDocumentDate(doc.uploadedAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
