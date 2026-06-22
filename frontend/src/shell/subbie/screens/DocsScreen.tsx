/**
 * DocsScreen — /p/docs — the subbie shell's read-only project documents surface.
 *
 * Implements docs/design-subbie-shell-mock-v1.html #docs on the inner ShellScreen.
 * View-only: documents are grouped by category; tapping a row opens the file via
 * the shared signed-URL idiom. There is deliberately NO upload affordance (the
 * backend allows subbie upload only against an assigned lot, but the classic
 * portal surface — and this rebuild — exposes none; research doc 16/17).
 *
 * NEW PRESENTATION over EXISTING LOGIC. Reuses the SAME TanStack query the classic
 * SubcontractorDocumentsPage uses (queryKeys.portalDocuments, cache shared):
 *   GET /api/documents/:projectId?subcontractorView=true
 * and delegates open to `openDocumentAccessUrl(doc.id)` from
 * lib/documentAccess (imported, never duplicated).
 */
import { ChevronRight, FileText, FolderOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { extractErrorMessage } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import { logError } from '@/lib/logger';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import { ShellAccessDenied } from './ShellAccessDenied';
import { useSubbieShellContext } from '../subbieShellContext';

interface DocItem {
  id: string;
  filename: string;
  fileUrl?: string | null;
  category: string;
  description?: string;
  uploadedAt: string;
  fileSize?: number;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(parsed);
}

function DocCard({ doc }: { doc: DocItem }) {
  const handleOpen = async () => {
    try {
      await openDocumentAccessUrl(doc.id, doc.fileUrl);
    } catch (err) {
      logError('Failed to open subcontractor document:', err);
      toast({
        title: 'Failed to open document',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  const meta = [doc.description, formatUploadedDate(doc.uploadedAt), formatFileSize(doc.fileSize)]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      className="shell-card flex items-center gap-3"
      onClick={() => void handleOpen()}
      aria-label={`Open ${doc.filename}`}
    >
      <span className="shell-hub-ico !h-10 !w-10 !rounded-[10px]" aria-hidden="true">
        <FileText size={19} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-semibold text-foreground">
          {doc.filename}
        </span>
        {meta && (
          <span className="mt-[2px] block truncate text-[13px] text-muted-foreground">{meta}</span>
        )}
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground/50" aria-hidden="true" />
    </button>
  );
}

export function DocsScreen() {
  const { user } = useAuth();
  const { projectId, subcontractorCompanyId, companyName, projectName, isModuleEnabled } =
    useSubbieShellContext();
  const canViewDocuments = isModuleEnabled('documents');
  const encodedProjectId = projectId ? encodeURIComponent(projectId) : '';
  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });
  const parentPath = `/p${projectQuery}`;

  const {
    data: documents = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.portalDocuments(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const scopeQuery = buildPortalCompanyQuery({ subcontractorCompanyId });
      const res = await apiFetch<{ documents: DocItem[] }>(
        `/api/documents/${encodedProjectId}${scopeQuery ? `${scopeQuery}&` : '?'}subcontractorView=true`,
      );
      return res.documents || [];
    },
    enabled: !!user?.id && !!projectId && canViewDocuments,
  });

  if (!canViewDocuments) {
    return <ShellAccessDenied title="Documents" moduleName="Documents" />;
  }

  // Group by category, alphabetised (classic behaviour).
  const grouped = documents.reduce<Record<string, DocItem[]>>((acc, doc) => {
    const cat = doc.category || 'Other';
    (acc[cat] ??= []).push(doc);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  const sub = (
    <span className="text-muted-foreground">
      {[companyName ? `Shared with ${companyName}` : null, projectName, 'view only']
        .filter(Boolean)
        .join(' — ')}
    </span>
  );

  if (isLoading) {
    return (
      <ShellScreen variant="inner" title="Documents" parent={parentPath} sub={sub}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="Documents" parent={parentPath} sub={sub}>
      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          {extractErrorMessage(error, 'Failed to load documents')}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          <FolderOpen size={28} className="text-muted-foreground/50" aria-hidden="true" />
          <span>Project documents shared with you will appear here.</span>
        </div>
      ) : (
        categories.map((category) => (
          <div key={category} className="contents">
            <div className="mt-1 font-mono text-[11.5px] font-semibold tracking-[0.12em] text-muted-foreground">
              {category.toUpperCase()}
            </div>
            {grouped[category].map((doc) => (
              <DocCard key={doc.id} doc={doc} />
            ))}
          </div>
        ))
      )}
    </ShellScreen>
  );
}
