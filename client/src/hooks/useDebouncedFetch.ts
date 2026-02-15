import { useState, useEffect, useCallback } from "react"
import debug from "../utils/debug"
import {
  SEARCH_MIN_LENGTH,
  SEARCH_DEBOUNCE_DELAY_MS,
  SEARCH_CACHE_TTL_MS,
  SEARCH_CACHE_MAX_SIZE,
} from "../utils/constants"

interface UseDebouncedFetchOptions {
  url: string
  queryParam: string
  minLength?: number
  delay?: number
  enabled?: boolean
  cacheTTL?: number // Cache time-to-live in milliseconds (default 1 hour)
  cacheMaxSize?: number // Maximum number of cache entries (default 100)
}

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// Cache key prefix for search results
const CACHE_PREFIX = "search-cache"
const CACHE_INDEX_KEY = `${CACHE_PREFIX}-index`

/**
 * Get all cache keys from the index
 */
function getCacheIndex(): string[] {
  try {
    const index = sessionStorage.getItem(CACHE_INDEX_KEY)
    return index ? JSON.parse(index) : []
  } catch {
    return []
  }
}

/**
 * Update the cache index
 */
function updateCacheIndex(keys: string[]): void {
  try {
    sessionStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keys))
  } catch (error) {
    console.warn("Failed to update cache index:", error)
  }
}

/**
 * Add a key to the cache index
 */
function addToCacheIndex(key: string): void {
  const index = getCacheIndex()
  if (!index.includes(key)) {
    index.push(key)
    updateCacheIndex(index)
  }
}

/**
 * Remove a key from the cache index
 */
function removeFromCacheIndex(key: string): void {
  const index = getCacheIndex().filter(k => k !== key)
  updateCacheIndex(index)
}

/**
 * Enforce cache size limit using LRU eviction
 */
function enforceCacheLimit(maxSize: number): void {
  const index = getCacheIndex()

  if (index.length <= maxSize) {
    return
  }

  // Get all cache entries with their timestamps
  const entries: Array<{ key: string; timestamp: number }> = []

  for (const key of index) {
    try {
      const item = sessionStorage.getItem(key)
      if (item) {
        const parsed = JSON.parse(item)
        entries.push({ key, timestamp: parsed.timestamp || 0 })
      }
    } catch {
      // Invalid entry, will be cleaned up
    }
  }

  // Sort by timestamp (oldest first)
  entries.sort((a, b) => a.timestamp - b.timestamp)

  // Remove oldest entries until we're under the limit
  const toRemove = entries.slice(0, entries.length - maxSize)
  for (const entry of toRemove) {
    try {
      sessionStorage.removeItem(entry.key)
      removeFromCacheIndex(entry.key)
    } catch (error) {
      console.warn("Failed to remove cache entry:", error)
    }
  }
}

/**
 * Hook for debounced fetching of data from an API with caching
 * @param options Configuration options
 * @returns Object containing loading state, data, error, and a reset function
 */
function useDebouncedFetch<T>({
  url,
  queryParam,
  minLength = SEARCH_MIN_LENGTH,
  delay = SEARCH_DEBOUNCE_DELAY_MS,
  enabled = true,
  cacheTTL = SEARCH_CACHE_TTL_MS,
  cacheMaxSize = SEARCH_CACHE_MAX_SIZE,
}: UseDebouncedFetchOptions) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Reset the data
  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  // Update query with debouncing
  useEffect(() => {
    if (!query || query.trim().length < minLength || !enabled) {
      reset()
      return
    }

    let abortController: AbortController | null = null

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      const cacheKey = `${CACHE_PREFIX}-${url}-${queryParam}-${query}`

      try {
        // Check cache first
        const cachedItem = sessionStorage.getItem(cacheKey)
        if (cachedItem) {
          const entry: CacheEntry<T> = JSON.parse(cachedItem)
          const age = Date.now() - entry.timestamp

          // Check if cache is still valid
          if (age < cacheTTL) {
            setData(entry.data)
            setLoading(false)
            debug.log(
              `Cache hit for "${query}" (age: ${Math.round(age / 1000)}s)`,
            )
            return
          } else {
            // Cache expired, remove it
            debug.log(
              `Cache expired for "${query}" (age: ${Math.round(age / 1000)}s)`,
            )
            sessionStorage.removeItem(cacheKey)
            removeFromCacheIndex(cacheKey)
          }
        }

        // Fetch from API
        abortController = new AbortController()
        const fullUrl = `${url}?${queryParam}=${encodeURIComponent(query)}`

        const response = await fetch(fullUrl, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const result = await response.json()
        setData(result)

        // Store in cache with timestamp
        try {
          const cacheEntry: CacheEntry<T> = {
            data: result,
            timestamp: Date.now(),
          }
          sessionStorage.setItem(cacheKey, JSON.stringify(cacheEntry))
          addToCacheIndex(cacheKey)

          // Enforce cache size limit
          enforceCacheLimit(cacheMaxSize)

          debug.log(`Cached new result for "${query}"`)
        } catch (cacheError) {
          // Cache storage failed (quota exceeded, etc.) - not critical
          debug.warn("Failed to cache result:", cacheError)
        }
      } catch (err) {
        // Only set error if it's not an abort error
        if ((err as Error).name !== "AbortError") {
          setError(err as Error)
          console.error("Error fetching data:", err)
        }
      } finally {
        setLoading(false)
      }
    }

    // Set up debounce timeout
    const timeoutId = setTimeout(fetchData, delay)

    // Cleanup function
    return () => {
      clearTimeout(timeoutId)
      if (abortController) {
        abortController.abort()
      }
    }
  }, [
    query,
    url,
    queryParam,
    minLength,
    delay,
    enabled,
    reset,
    cacheTTL,
    cacheMaxSize,
  ])

  return {
    setQuery,
    query,
    loading,
    data,
    error,
    reset,
  }
}

export default useDebouncedFetch
