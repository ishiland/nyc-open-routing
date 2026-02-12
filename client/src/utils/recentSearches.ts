import { GeosupportFeature } from "../types/interfaces"

const RECENT_SEARCHES_KEY = "nyc-routing-recent-searches"
const MAX_RECENT_SEARCHES = 5

export interface RecentSearch {
  feature: GeosupportFeature
  timestamp: number
  label: string
}

/**
 * Get recent searches from localStorage
 * Returns empty array if none found or parsing fails
 */
export const getRecentSearches = (): RecentSearch[] => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!stored) return []

    const searches: RecentSearch[] = JSON.parse(stored)

    // Validate structure
    if (!Array.isArray(searches)) return []

    return searches
  } catch (error) {
    console.warn("Failed to load recent searches:", error)
    return []
  }
}

/**
 * Add a new search to recent searches
 * Maintains max limit and removes duplicates
 */
export const addRecentSearch = (feature: GeosupportFeature): void => {
  try {
    const label =
      feature.properties?.label || feature.properties?.address || ""
    if (!label) return

    const searches = getRecentSearches()

    // Remove existing entry with same label (case-insensitive)
    const filtered = searches.filter(
      (s) => s.label.toLowerCase() !== label.toLowerCase(),
    )

    // Add new search at the beginning
    const newSearch: RecentSearch = {
      feature,
      timestamp: Date.now(),
      label,
    }

    const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES)

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch (error) {
    console.warn("Failed to save recent search:", error)
  }
}

/**
 * Clear all recent searches
 */
export const clearRecentSearches = (): void => {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch (error) {
    console.warn("Failed to clear recent searches:", error)
  }
}

/**
 * Get recent searches for a specific type (Start or End)
 * Returns all recent searches (they're universal across both inputs)
 */
export const getRecentSearchesForType = (_type: "Start" | "End"): RecentSearch[] => {
  // Recent searches are shared between Start and End for simplicity
  // Could be split by type in the future if needed
  return getRecentSearches()
}
