import { useEffect, useRef, useState, type DependencyList } from 'react'

export type AsyncState<T> = {
  data: T | null
  error: string
  loading: boolean
  reload: () => void
}

/**
 * Runs something that takes a while and keeps the last answer around while the
 * next one is on its way. `run` may be null, which means "nothing to ask yet":
 * the hook then simply stays idle until the dependencies change.
 */
export function useAsync<T>(run: (() => Promise<T>) | null, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(run))
  const [tick, setTick] = useState(0)
  const latest = useRef(run)
  latest.current = run

  useEffect(() => {
    const task = latest.current
    if (!task) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void task().then(
      (value) => {
        if (cancelled) return
        setData(value)
        setLoading(false)
      },
      (err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
    // The caller supplies the dependencies; `run` itself is a new closure each
    // render and would restart the request every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, error, loading, reload: () => setTick((t) => t + 1) }
}
