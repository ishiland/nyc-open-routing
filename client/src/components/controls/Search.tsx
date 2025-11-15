// Search.tsx
import React, { useState, FC, useRef, useEffect, useContext } from "react"
import TextField from "@mui/material/TextField"
import Box from "@mui/material/Box"
import {
  IMapFeature,
  SearchResponse,
  GeosupportFeature,
  SearchProps,
} from "../../types/interfaces"
import useDebouncedFetch from "../../hooks/useDebouncedFetch"
import useKeyboardNavigation from "../../hooks/useKeyboardNavigation"
import useAutofillPrevention from "../../hooks/useAutofillPrevention"
import SuggestionDropdown from "./SuggestionDropdown"
import { RoutingContext } from "../../contexts/RoutingContext"
import { commonStyles } from "../../utils/themeUtils"
import debug from "../../utils/debug"
import { SEARCH_MIN_LENGTH, SEARCH_BLUR_DELAY_MS } from "../../utils/constants"
import {
  getAddressLabel,
  getSuggestionId,
  getSuggestionKey,
} from "../../utils/suggestionHelpers"

// Helper to map the GeoSearch API response to the expected format
const transformSearchResult = (
  feature: GeosupportFeature,
): IMapFeature | null => {
  if (!feature || !feature.geometry || !feature.geometry.coordinates) {
    debug.error("Invalid feature data", feature)
    return null
  }

  // GeoSearch API returns [longitude, latitude]
  const [longitude, latitude] = feature.geometry.coordinates

  if (isNaN(latitude) || isNaN(longitude)) {
    debug.error("Invalid coordinates", feature)
    return null
  }

  return {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [longitude, latitude],
    },
    properties: feature.properties,
  }
}

const SearchComponent: FC<SearchProps> = ({ type }) => {
  const {
    setAddress,
    startAddressInput,
    endAddressInput,
    setAddressInput,
    isInputEnabled,
  } = useContext(RoutingContext)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const blurTimeoutRef = useRef<NodeJS.Timeout>()
  const inputIdRef = useRef(`auto-suggest-${type}-${Date.now()}`)

  // Use autofill prevention hook
  const { isReadOnly, handleFocus: handleAutofillFocus, randomAutoComplete } =
    useAutofillPrevention()

  const query = type === "Start" ? startAddressInput : endAddressInput

  // Use our custom hook for debounced API fetching
  const {
    data,
    loading,
    error,
    setQuery: setSearchQuery,
  } = useDebouncedFetch<SearchResponse>({
    url: "/api/search",
    queryParam: "address",
    minLength: SEARCH_MIN_LENGTH,
    enabled: isInputEnabled,
  })

  // Extract suggestions from the fetched data
  const suggestions = data?.features || []

  // Handle suggestion selection either by click or by pressing Enter.
  const handleSuggestionSelect = (suggestion: GeosupportFeature) => {
    const transformedFeature = transformSearchResult(suggestion)
    if (!transformedFeature) return
    setAddress(transformedFeature, type.toLowerCase() as "start" | "end")
    setAddressInput(
      getAddressLabel(suggestion) || "",
      type.toLowerCase() as "start" | "end",
    )
    setSearchQuery("") // This will clear suggestions
    resetHighlight()
  }

  // Use keyboard navigation hook
  const { highlightedIndex, handleKeyDown, resetHighlight } =
    useKeyboardNavigation({
      items: suggestions,
      onSelect: handleSuggestionSelect,
    })

  // Debug logging (development only)
  // debug.log("[Search Debug]", {
  //   type,
  //   query,
  //   dataPresent: !!data,
  //   featuresCount: data?.features?.length || 0,
  //   suggestionsLength: suggestions.length,
  //   hasAnchorEl: !!anchorEl,
  //   willShowDropdown: !!(anchorEl && suggestions.length > 0),
  // })

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  // Update the input value and trigger search
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setAddressInput(newValue, type.toLowerCase() as "start" | "end")
    setSearchQuery(newValue)
  }

  // Combine autofill focus handler with any additional focus logic
  const handleFocus = () => {
    handleAutofillFocus(inputRef)
  }

  // Hide suggestions when the input loses focus (with a slight delay to allow suggestion clicks).
  const handleBlur = () => {
    // Clear previous timeout if exists
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }

    blurTimeoutRef.current = setTimeout(() => setSearchQuery(""), SEARCH_BLUR_DELAY_MS)
  }

  return (
    <Box
      component="form"
      autoComplete="off"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault()
      }}
      sx={commonStyles.formGroup}
    >
      <TextField
        fullWidth
        label={type === "Start" ? "Starting location" : "Destination"}
        placeholder="Enter NYC address"
        disabled={!isInputEnabled}
        inputRef={node => {
          inputRef.current = node
          setAnchorEl(node)
        }}
        id={inputIdRef.current}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        helperText={
          query.length > 0 && query.length < SEARCH_MIN_LENGTH
            ? `Enter at least ${SEARCH_MIN_LENGTH} characters to search`
            : ""
        }
        error={query.length > 0 && query.length < SEARCH_MIN_LENGTH}
        aria-controls={
          suggestions.length > 0
            ? `${type.toLowerCase()}-suggestions-list`
            : undefined
        }
        aria-activedescendant={
          highlightedIndex >= 0
            ? getSuggestionId(type, highlightedIndex)
            : undefined
        }
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        inputProps={{
          readOnly: isReadOnly,
          autoComplete: randomAutoComplete,
          autoCorrect: "off",
          autoCapitalize: "off",
          spellCheck: "false",
        }}
      />
      {(loading || error || suggestions.length > 0) &&
        query.length >= SEARCH_MIN_LENGTH && (
          <SuggestionDropdown
            anchorEl={anchorEl}
            type={type}
            query={query}
            loading={loading}
            error={error}
            suggestions={suggestions}
            highlightedIndex={highlightedIndex}
            onSuggestionSelect={handleSuggestionSelect}
          />
        )}
    </Box>
  )
}

// Memoize component - only re-render when type changes
const Search = React.memo(SearchComponent, (prevProps, nextProps) => {
  return prevProps.type === nextProps.type
})

export default Search
