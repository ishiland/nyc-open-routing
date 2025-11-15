import { GeosupportFeature } from "../types/interfaces"

/**
 * Extract the address label from a Geosupport feature
 * Supports both 'label' (added by backend) and 'address' (native Geosupport field)
 */
export const getAddressLabel = (feature: GeosupportFeature | null): string => {
  if (!feature?.properties) return ""
  return feature.properties.label || feature.properties.address || ""
}

/**
 * Generate a unique ID for a suggestion element
 * Used for ARIA attributes
 */
export const getSuggestionId = (type: string, index: number): string => {
  return `${type.toLowerCase()}-suggestion-${index}`
}

/**
 * Generate a stable key for a suggestion item
 * Prefers feature ID if available, otherwise creates composite key from label and coordinates
 */
export const getSuggestionKey = (
  type: string,
  suggestion: GeosupportFeature,
): string => {
  // Use the suggestion's ID if available
  if (suggestion.properties?.id) {
    return `${type}-${suggestion.properties.id}`
  }

  // Otherwise try to make a relatively stable composite key
  const label = suggestion.properties?.label || ""
  const coords = suggestion.geometry?.coordinates || []
  return `${type}-${label}-${coords.join(",")}`
}
