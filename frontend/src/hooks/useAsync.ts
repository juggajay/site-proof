import { useState, useCallback } from 'react'

type AsyncStatus = 'idle' | 'pending' | 'success' | 'error'

interface UseAsyncReturn<T, E = Error> {
  status: AsyncStatus
  data: T | null
  error: E | null
  isIdle: boolean
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  execute: () => Promise<T | undefined>
  reset: () => void
}

/**
 * Hook for managing async operations with loading/error states.
 * Replaces repetitive useState patterns for saving/loading/error.
 *
 * @example
 * const { execute, isPending, isError, error } = useAsync(async () => {
 *   const response = await fetch('/api/data')
 *   return response.json()
 * })
 *
 * // In JSX:
 * <button onClick={execute} disabled={isPending}>
 *   {isPending ? 'Saving...' : 'Save'}
 * </button>
 * {isError && <p className="text-red-500">{error?.message}</p>}
 */
export function useAsync<T, E = Error>(
  asyncFunction: () => Promise<T>
): UseAsyncReturn<T, E> {
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<E | null>(null)

  const execute = useCallback(async () => {
    setStatus('pending')
    setError(null)
    try {
      const response = await asyncFunction()
      setData(response)
      setStatus('success')
      return response
    } catch (err) {
      setError(err as E)
      setStatus('error')
      return undefined
    }
  }, [asyncFunction])

  const reset = useCallback(() => {
    setStatus('idle')
    setData(null)
    setError(null)
  }, [])

  return {
    status,
    data,
    error,
    isIdle: status === 'idle',
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error',
    execute,
    reset,
  }
}

/**
 * Hook for managing form submission with loading state.
 * Simplified version of useAsync for common save/submit patterns.
 *
 * @example
 * const { saving, save } = useSaveAction(async (data) => {
 *   await api.saveLot(data)
 * })
 *
 * <button onClick={() => save(formData)} disabled={saving}>
 *   {saving ? 'Saving...' : 'Save'}
 * </button>
 */
export function useSaveAction<T, R = void>(
  saveFunction: (data: T) => Promise<R>
): {
  saving: boolean
  error: Error | null
  save: (data: T) => Promise<R | undefined>
  reset: () => void
} {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const save = useCallback(async (data: T) => {
    setSaving(true)
    setError(null)
    try {
      const result = await saveFunction(data)
      setSaving(false)
      return result
    } catch (err) {
      setError(err as Error)
      setSaving(false)
      return undefined
    }
  }, [saveFunction])

  const reset = useCallback(() => {
    setSaving(false)
    setError(null)
  }, [])

  return { saving, error, save, reset }
}

/**
 * Hook for managing data loading with automatic fetch on mount.
 *
 * @example
 * const { data, loading, error, refresh } = useLoadData(
 *   () => api.getLots(projectId),
 *   [projectId]
 * )
 */
export function useLoadData<T>(
  loadFunction: () => Promise<T>,
  deps: React.DependencyList = []
): {
  data: T | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await loadFunction()
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Auto-load on mount and when deps change
  useState(() => {
    load()
  })

  return { data, loading, error, refresh: load }
}
