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
 * Get category information for a suggestion
 * Determines if it's a specific address or general location
 */
export const getCategoryInfo = (
  feature: GeosupportFeature,
): { hasHouseNumber: boolean; category: string } => {
  const hasHouseNumber = Boolean(
    feature.properties?.["House Number - Display Format"],
  )

  return {
    hasHouseNumber,
    category: hasHouseNumber ? "Address" : "Street",
  }
}

/**
 * Get secondary text to display below the main address
 * Shows borough and/or ZIP code if available
 */
export const getSecondaryText = (feature: GeosupportFeature): string => {
  const props = feature.properties
  if (!props) return ""

  const parts: string[] = []

  // If there's a house number, we already showed the full address
  // So show category + borough as secondary info
  const categoryInfo = getCategoryInfo(feature)

  if (categoryInfo.hasHouseNumber) {
    // For specific addresses, show "Address in [Borough]"
    if (props["First Borough Name"]) {
      parts.push(`Address in ${props["First Borough Name"]}`)
    }
  } else {
    // For streets/general locations, show "Street in [Borough]"
    if (props["First Borough Name"]) {
      parts.push(`Street in ${props["First Borough Name"]}`)
    }
  }

  // Add ZIP code if available
  if (props["ZIP Code"]) {
    parts.push(props["ZIP Code"])
  }

  return parts.join(" • ")
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
