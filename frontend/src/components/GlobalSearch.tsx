import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, X, FileText, AlertTriangle, TestTube, Loader2 } from 'lucide-react'
import { getAuthToken } from '@/lib/auth'

interface SearchResult {
  id: string
  type: 'lot' | 'ncr' | 'test'
  title: string
  subtitle: string
  projectId: string
}

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const searchResults: SearchResult[] = []

    try {
      // Search lots
      if (projectId) {
        const lotsRes = await fetch(`${apiUrl}/api/projects/${projectId}/lots`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (lotsRes.ok) {
          const data = await lotsRes.json()
          const lots = data.lots || []
          const matchedLots = lots.filter((lot: any) =>
            lot.lotNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lot.description?.toLowerCase().includes(searchQuery.toLowerCase())
          ).slice(0, 5)

          matchedLots.forEach((lot: any) => {
            searchResults.push({
              id: lot.id,
              type: 'lot',
              title: lot.lotNumber,
              subtitle: lot.description || lot.status || 'No description',
              projectId: projectId,
            })
          })
        }

        // Search NCRs
        const ncrsRes = await fetch(`${apiUrl}/api/projects/${projectId}/ncrs`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (ncrsRes.ok) {
          const data = await ncrsRes.json()
          const ncrs = data.ncrs || []
          const matchedNcrs = ncrs.filter((ncr: any) =>
            ncr.ncrNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ncr.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ncr.description?.toLowerCase().includes(searchQuery.toLowerCase())
          ).slice(0, 5)

          matchedNcrs.forEach((ncr: any) => {
            searchResults.push({
              id: ncr.id,
              type: 'ncr',
              title: ncr.ncrNumber || `NCR-${ncr.id.slice(0, 8)}`,
              subtitle: ncr.title || ncr.description || `Status: ${ncr.status}`,
              projectId: projectId,
            })
          })
        }

        // Search test results
        const testsRes = await fetch(`${apiUrl}/api/projects/${projectId}/tests`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (testsRes.ok) {
          const data = await testsRes.json()
          const tests = data.tests || []
          const matchedTests = tests.filter((test: any) =>
            test.testNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            test.testType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            test.description?.toLowerCase().includes(searchQuery.toLowerCase())
          ).slice(0, 5)

          matchedTests.forEach((test: any) => {
            searchResults.push({
              id: test.id,
              type: 'test',
              title: test.testNumber || `Test-${test.id.slice(0, 8)}`,
              subtitle: test.testType || test.description || `Result: ${test.result}`,
              projectId: projectId,
            })
          })
        }
      }
    } catch (err) {
      console.error('Search error:', err)
    }

    setResults(searchResults)
    setLoading(false)
    setSelectedIndex(0)
  }, [projectId])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault()
      navigateToResult(results[selectedIndex])
    }
  }

  // Navigate to result
  const navigateToResult = (result: SearchResult) => {
    let path = ''
    switch (result.type) {
      case 'lot':
        path = `/projects/${result.projectId}/lots/${result.id}`
        break
      case 'ncr':
        path = `/projects/${result.projectId}/ncr/${result.id}`
        break
      case 'test':
        path = `/projects/${result.projectId}/tests/${result.id}`
        break
    }
    onClose()
    navigate(path)
  }

  // Get icon for result type
  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'lot':
        return <FileText className="h-4 w-4 text-blue-500" />
      case 'ncr':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case 'test':
        return <TestTube className="h-4 w-4 text-green-500" />
    }
  }

  // Get type label
  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'lot':
        return 'Lot'
      case 'ncr':
        return 'NCR'
      case 'test':
        return 'Test'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50">
      <div
        ref={modalRef}
        className="w-full max-w-xl mx-4 rounded-lg border bg-card shadow-xl"
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
            placeholder="Search lots, NCRs, tests..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-auto">
          {!projectId ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Select a project to search
            </div>
          ) : query && results.length === 0 && !loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : results.length > 0 ? (
            <ul className="py-2">
              {results.map((result, index) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    onClick={() => navigateToResult(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                      index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
                    }`}
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
          ) : !query ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <p>Type to search across lots, NCRs, and tests</p>
              <p className="mt-2 text-xs">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs ml-1">↓</kbd>
                <span className="mx-2">to navigate</span>
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">Enter</kbd>
                <span className="ml-2">to select</span>
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs ml-4">Esc</kbd>
                <span className="ml-2">to close</span>
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {results.length > 0 ? `${results.length} results` : 'Quick Search'}
          </span>
          <span className="hidden sm:inline">
            Press <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-xs">⌘K</kbd> to open
          </span>
        </div>
      </div>
    </div>
  )
}
