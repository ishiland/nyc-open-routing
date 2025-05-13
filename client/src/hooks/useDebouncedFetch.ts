import { useState, useEffect, useCallback } from 'react';

interface UseDebouncedFetchOptions {
  url: string;
  queryParam: string;
  minLength?: number;
  delay?: number;
  enabled?: boolean;
}

/**
 * Hook for debounced fetching of data from an API
 * @param options Configuration options
 * @returns Object containing loading state, data, error, and a reset function
 */
function useDebouncedFetch<T>({
  url,
  queryParam,
  minLength = 3,
  delay = 300,
  enabled = true
}: UseDebouncedFetchOptions) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Reset the data
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  // Update query with debouncing
  useEffect(() => {
    if (!query || query.trim().length < minLength || !enabled) {
      reset();
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let abortController: AbortController | null = null;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      const cacheKey = `search-${url}-${queryParam}-${query}`;
      try {
        // Check cache first
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
          setData(JSON.parse(cachedData));
          setLoading(false);
          return;
        }

        abortController = new AbortController();
        const fullUrl = `${url}?${queryParam}=${encodeURIComponent(query)}`;
        
        const response = await fetch(fullUrl, {
          signal: abortController.signal
        });
        
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
        // Store in cache
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (err) {
        // Only set error if it's not an abort error
        if ((err as Error).name !== 'AbortError') {
          setError(err as Error);
          console.error('Error fetching data:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    // Set up debounce timeout
    timeoutId = setTimeout(fetchData, delay);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [query, url, queryParam, minLength, delay, enabled, reset]);

  return {
    setQuery,
    query,
    loading,
    data,
    error,
    reset
  };
}

export default useDebouncedFetch; 