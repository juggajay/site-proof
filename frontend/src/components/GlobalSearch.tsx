import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Search,
  X,
  FileText,
  File,
  PenTool,
  AlertTriangle,
  TestTube,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { rankResults } from '@/components/globalSearchRanking';
import { useClancyEnabled } from '@/components/copilot/clancyAccess';
import { openClancy } from '@/components/copilot/clancyChatState';

interface SearchResult {
  id: string;
  type: 'lot' | 'ncr' | 'test' | 'document' | 'drawing';
  title: string;
  subtitle: string;
  projectId: string;
}

interface LotSearchItem {
  id: string;
  lotNumber: string;
  description?: string | null;
  status?: string | null;
  activityType?: string | null;
  areaZone?: string | null;
  structureId?: string | null;
  structureElement?: string | null;
}

interface NcrSearchItem {
  id: string;
  projectId: string;
  ncrNumber?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  ncrLots?: Array<{
    lot?: {
      lotNumber?: string | null;
      description?: string | null;
    } | null;
  }>;
}

interface TestSearchItem {
  id: string;
  projectId: string;
  testType: string;
  testRequestNumber?: string | null;
  laboratoryReportNumber?: string | null;
  laboratoryName?: string | null;
  sampleLocation?: string | null;
  resultValue?: number | string | null;
  resultUnit?: string | null;
  status?: string | null;
  lot?: {
    lotNumber?: string | null;
  } | null;
}

// Documents: server strips fileUrl from list responses (buildDocumentResponse),
// so there is no raw Supabase URL to render here — results link to the documents
// page only, per the backend-mediated-access storage rule.
interface DocumentSearchItem {
  id: string;
  projectId: string;
  filename?: string | null;
  category?: string | null;
  documentType?: string | null;
  lot?: {
    lotNumber?: string | null;
    description?: string | null;
  } | null;
}

interface DrawingSearchItem {
  id: string;
  projectId: string;
  drawingNumber?: string | null;
  title?: string | null;
  revision?: string | null;
  status?: string | null;
}

const includesQuery = (value: string | number | null | undefined, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

const anyFieldIncludesQuery = (values: Array<string | number | null | undefined>, query: string) =>
  values.some((value) => includesQuery(value, query));

const buildSearchUrl = (path: string, projectId: string, searchTerm: string) => {
  const params = new URLSearchParams({
    projectId,
    search: searchTerm,
    page: '1',
    limit: '10',
  });

  return `${path}?${params.toString()}`;
};

// Documents and drawings list routes take the projectId as a path segment
// (/api/documents/:projectId, /api/drawings/:projectId) rather than a query param.
const buildProjectScopedSearchUrl = (basePath: string, projectId: string, searchTerm: string) => {
  const params = new URLSearchParams({ search: searchTerm, page: '1', limit: '10' });
  return `${basePath}/${encodeURIComponent(projectId)}?${params.toString()}`;
};

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const clancyEnabled = useClancyEnabled();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const activeProjectId = projectId ?? '';
  const searchTerm = debouncedQuery.trim();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchEnabled = !!activeProjectId && !!searchTerm;

  // Fetch lots, NCRs, and tests in parallel via TanStack Query
  const lotsQuery = useQuery({
    queryKey: queryKeys.globalSearch(activeProjectId, searchTerm, 'lots'),
    queryFn: () =>
      apiFetch<{ lots?: LotSearchItem[]; data?: LotSearchItem[] }>(
        buildSearchUrl('/api/lots', activeProjectId, searchTerm),
      ),
    enabled: searchEnabled,
    retry: false,
    staleTime: 30_000,
  });

  const ncrsQuery = useQuery({
    queryKey: queryKeys.globalSearch(activeProjectId, searchTerm, 'ncrs'),
    queryFn: () =>
      apiFetch<{ ncrs?: NcrSearchItem[]; data?: NcrSearchItem[] }>(
        buildSearchUrl('/api/ncrs', activeProjectId, searchTerm),
      ),
    enabled: searchEnabled,
    retry: false,
    staleTime: 30_000,
  });

  const testsQuery = useQuery({
    queryKey: queryKeys.globalSearch(activeProjectId, searchTerm, 'tests'),
    queryFn: () =>
      apiFetch<{ testResults: TestSearchItem[] }>(
        buildSearchUrl('/api/test-results', activeProjectId, searchTerm),
      ),
    enabled: searchEnabled,
    retry: false,
    staleTime: 30_000,
  });

  const documentsQuery = useQuery({
    queryKey: queryKeys.globalSearch(activeProjectId, searchTerm, 'documents'),
    queryFn: () =>
      apiFetch<{ documents?: DocumentSearchItem[] }>(
        buildProjectScopedSearchUrl('/api/documents', activeProjectId, searchTerm),
      ),
    enabled: searchEnabled,
    retry: false,
    staleTime: 30_000,
  });

  const drawingsQuery = useQuery({
    queryKey: queryKeys.globalSearch(activeProjectId, searchTerm, 'drawings'),
    queryFn: () =>
      apiFetch<{ drawings?: DrawingSearchItem[] }>(
        buildProjectScopedSearchUrl('/api/drawings', activeProjectId, searchTerm),
      ),
    enabled: searchEnabled,
    retry: false,
    staleTime: 30_000,
  });

  const scopeQueries = [lotsQuery, ncrsQuery, testsQuery, documentsQuery, drawingsQuery];

  const loading = searchEnabled && scopeQueries.some((q) => q.isFetching);
  const hasSearchError = searchEnabled && scopeQueries.some((q) => q.isError);
  const allSearchesFailed = searchEnabled && scopeQueries.every((q) => q.isError);

  const retrySearch = () => {
    scopeQueries.forEach((q) => void q.refetch());
  };

  // Derive search results from query data + client-side filtering
  const results = useMemo<SearchResult[]>(() => {
    if (!searchTerm || !activeProjectId) return [];

    const searchResults: SearchResult[] = [];
    const q = searchTerm.toLowerCase();

    // Filter lots
    const lots = lotsQuery.data?.lots ?? lotsQuery.data?.data ?? [];
    rankResults(
      lots.filter((lot) =>
        anyFieldIncludesQuery(
          [
            lot.lotNumber,
            lot.description,
            lot.status,
            lot.activityType,
            lot.areaZone,
            lot.structureId,
            lot.structureElement,
          ],
          q,
        ),
      ),
      searchTerm,
      (lot) => lot.lotNumber,
    )
      .slice(0, 5)
      .forEach((lot) => {
        searchResults.push({
          id: lot.id,
          type: 'lot',
          title: lot.lotNumber,
          subtitle: lot.description || lot.status || 'No description',
          projectId: activeProjectId,
        });
      });

    // Filter NCRs
    const ncrs = ncrsQuery.data?.ncrs ?? ncrsQuery.data?.data ?? [];
    rankResults(
      ncrs.filter((ncr) => {
        const linkedLotText = ncr.ncrLots
          ?.map((ncrLot) => `${ncrLot.lot?.lotNumber ?? ''} ${ncrLot.lot?.description ?? ''}`)
          .join(' ');

        return anyFieldIncludesQuery(
          [
            ncr.ncrNumber,
            ncr.title,
            ncr.description,
            ncr.category,
            ncr.severity,
            ncr.status,
            linkedLotText,
          ],
          q,
        );
      }),
      searchTerm,
      (ncr) => ncr.ncrNumber,
    )
      .slice(0, 5)
      .forEach((ncr) => {
        searchResults.push({
          id: ncr.id,
          type: 'ncr',
          title: ncr.ncrNumber || `NCR-${ncr.id.slice(0, 8)}`,
          subtitle: ncr.title || ncr.description || `Status: ${ncr.status}`,
          projectId: ncr.projectId || activeProjectId,
        });
      });

    // Filter tests
    const tests = testsQuery.data?.testResults || [];
    rankResults(
      tests.filter((test) =>
        anyFieldIncludesQuery(
          [
            test.testRequestNumber,
            test.laboratoryReportNumber,
            test.testType,
            test.laboratoryName,
            test.sampleLocation,
            test.resultUnit,
            test.status,
            test.lot?.lotNumber,
          ],
          q,
        ),
      ),
      searchTerm,
      (test) => test.testRequestNumber,
    )
      .slice(0, 5)
      .forEach((test) => {
        const resultText =
          test.resultValue != null
            ? `Result: ${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
            : `Status: ${test.status || 'Unknown'}`;

        searchResults.push({
          id: test.id,
          type: 'test',
          title:
            test.testRequestNumber || test.laboratoryReportNumber || `Test-${test.id.slice(0, 8)}`,
          subtitle: test.testType || resultText,
          projectId: test.projectId || activeProjectId,
        });
      });

    // Filter documents. Primary identifier is the filename; the row links to the
    // documents page (search-seeded), never a raw file URL.
    const documents = documentsQuery.data?.documents ?? [];
    rankResults(
      documents.filter((doc) =>
        anyFieldIncludesQuery(
          [doc.filename, doc.category, doc.documentType, doc.lot?.lotNumber, doc.lot?.description],
          q,
        ),
      ),
      searchTerm,
      (doc) => doc.filename,
    )
      .slice(0, 5)
      .forEach((doc) => {
        searchResults.push({
          id: doc.id,
          type: 'document',
          title: doc.filename || `Document-${doc.id.slice(0, 8)}`,
          subtitle: doc.category || doc.documentType || 'Document',
          projectId: doc.projectId || activeProjectId,
        });
      });

    // Filter drawings. Primary identifier is the drawing number.
    const drawings = drawingsQuery.data?.drawings ?? [];
    rankResults(
      drawings.filter((drawing) =>
        anyFieldIncludesQuery(
          [drawing.drawingNumber, drawing.title, drawing.revision, drawing.status],
          q,
        ),
      ),
      searchTerm,
      (drawing) => drawing.drawingNumber,
    )
      .slice(0, 5)
      .forEach((drawing) => {
        searchResults.push({
          id: drawing.id,
          type: 'drawing',
          title: drawing.drawingNumber || `Drawing-${drawing.id.slice(0, 8)}`,
          subtitle:
            drawing.title || (drawing.revision ? `Rev ${drawing.revision}` : drawing.status || ''),
          projectId: drawing.projectId || activeProjectId,
        });
      });

    return searchResults;
  }, [
    searchTerm,
    activeProjectId,
    lotsQuery.data,
    ncrsQuery.data,
    testsQuery.data,
    documentsQuery.data,
    drawingsQuery.data,
  ]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex((currentIndex) =>
      results.length === 0 ? 0 : Math.min(currentIndex, results.length - 1),
    );
  }, [results.length]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      navigateToResult(results[selectedIndex]);
    }
  };

  // Navigate to result
  const navigateToResult = (result: SearchResult) => {
    let path = '';
    const projectPath = encodeURIComponent(result.projectId);
    const resultId = encodeURIComponent(result.id);
    switch (result.type) {
      case 'lot':
        path = `/projects/${projectPath}/lots/${resultId}`;
        break;
      case 'ncr':
        path = `/projects/${projectPath}/ncr?${new URLSearchParams({ ncr: result.id }).toString()}`;
        break;
      case 'test':
        path = `/projects/${projectPath}/tests?${new URLSearchParams({ test: result.id }).toString()}`;
        break;
      case 'document':
        // Deep-link seeds the documents register search box (see DocumentsPage);
        // links to the backend-mediated surface, never a raw Supabase URL.
        path = `/projects/${projectPath}/documents?${new URLSearchParams({ search: result.title }).toString()}`;
        break;
      case 'drawing':
        path = `/projects/${projectPath}/drawings?${new URLSearchParams({ search: result.title }).toString()}`;
        break;
    }
    onClose();
    navigate(path);
  };

  // Get icon for result type
  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'lot':
        return <FileText className="h-4 w-4 text-primary" />;
      case 'ncr':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'test':
        return <TestTube className="h-4 w-4 text-success" />;
      case 'document':
        return <File className="h-4 w-4 text-primary" />;
      case 'drawing':
        return <PenTool className="h-4 w-4 text-primary" />;
    }
  };

  // Get type label
  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'lot':
        return 'Lot';
      case 'ncr':
        return 'NCR';
      case 'test':
        return 'Test';
      case 'document':
        return 'Document';
      case 'drawing':
        return 'Drawing';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50">
      <div
        ref={modalRef}
        className="w-full max-w-xl mx-4 rounded-lg border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search lots, NCRs, tests, documents, drawings..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-auto">
          {clancyEnabled && (
            <button
              type="button"
              onClick={() => {
                onClose();
                openClancy();
              }}
              className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left hover:bg-muted"
            >
              <Sparkles className="h-4 w-4 flex-shrink-0 text-[#2563EB]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Ask Clancy…</div>
                <div className="truncate text-xs text-muted-foreground">
                  Chat with your CIVOS copilot
                </div>
              </div>
            </button>
          )}
          {!projectId ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Select a project to search
            </div>
          ) : allSearchesFailed && !loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground" role="alert">
              <AlertCircle className="mx-auto mb-3 h-5 w-5 text-destructive" />
              <p className="font-medium text-foreground">Search failed</p>
              <p className="mt-1">Please try again.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retrySearch}
                className="mt-4 gap-2"
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : hasSearchError && results.length === 0 && !loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground" role="alert">
              <AlertCircle className="mx-auto mb-3 h-5 w-5 text-warning" />
              <p className="font-medium text-foreground">Some search results could not be loaded</p>
              <p className="mt-1">Try again before assuming there are no matches.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retrySearch}
                className="mt-4 gap-2"
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : searchTerm && results.length === 0 && !loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found for "{searchTerm}"
            </div>
          ) : results.length > 0 ? (
            <>
              {hasSearchError && (
                <div
                  className="mx-3 mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
                  role="alert"
                >
                  Some search results could not be loaded.
                  <button
                    type="button"
                    className="ml-2 font-medium underline"
                    onClick={retrySearch}
                    disabled={loading}
                  >
                    Retry
                  </button>
                </div>
              )}
              <ul className="py-2">
                {results.map((result, index) => (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      onClick={() => navigateToResult(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                        index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                      aria-selected={index === selectedIndex}
                    >
                      {getTypeIcon(result.type)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {getTypeLabel(result.type)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : !query ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <p>Type to search across lots, NCRs, tests, documents, and drawings</p>
              <p className="mt-2 text-xs">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs ml-1">
                  ↓
                </kbd>
                <span className="mx-2">to navigate</span>
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">Enter</kbd>
                <span className="ml-2">to select</span>
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs ml-4">
                  Esc
                </kbd>
                <span className="ml-2">to close</span>
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>{results.length > 0 ? `${results.length} results` : 'Quick Search'}</span>
          <span className="hidden sm:inline">
            Press <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-xs">⌘K</kbd> to
            open
          </span>
        </div>
      </div>
    </div>
  );
}
