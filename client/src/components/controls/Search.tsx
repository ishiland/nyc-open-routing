// Search.tsx
import React, { useState, FC, useRef, useEffect, useContext } from "react"
import TextField from "@mui/material/TextField"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import CircularProgress from "@mui/material/CircularProgress"
import InputAdornment from "@mui/material/InputAdornment"
import { MyLocation } from "@mui/icons-material"
import {
  IMapFeature,
  SearchResponse,
  GeosupportFeature,
  SearchProps,
} from "../../types/interfaces"
import useDebouncedFetch from "../../hooks/useDebouncedFetch"
import useKeyboardNavigation from "../../hooks/useKeyboardNavigation"
import useAutofillPrevention from "../../hooks/useAutofillPrevention"
import { useGeolocation } from "../../hooks/useGeolocation"
import SuggestionDropdown from "./SuggestionDropdown"
import { RoutingContext } from "../../contexts/RoutingContext"
import { MessageContext } from "../../contexts/MessageContext"
import { commonStyles } from "../../utils/themeUtils"
import debug from "../../utils/debug"
import { SEARCH_MIN_LENGTH, SEARCH_BLUR_DELAY_MS } from "../../utils/constants"
import {
  getAddressLabel,
  getSuggestionId,
} from "../../utils/suggestionHelpers"
import {
  addRecentSearch,
  getRecentSearchesForType,
} from "../../utils/recentSearches"

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

  const { displayMessage } = useContext(MessageContext)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [recentSearches, setRecentSearches] = useState<GeosupportFeature[]>([])
  const blurTimeoutRef = useRef<NodeJS.Timeout>()
  const inputIdRef = useRef(`auto-suggest-${type}-${Date.now()}`)

  // Use autofill prevention hook
  const {
    isReadOnly,
    handleFocus: handleAutofillFocus,
    randomAutoComplete,
  } = useAutofillPrevention()

  // Use geolocation hook
  const {
    getCurrentPosition,
    loading: geoLoading,
    error: geoError,
  } = useGeolocation()

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

    // Save to recent searches
    addRecentSearch(suggestion)

    setAddress(transformedFeature, type.toLowerCase() as "start" | "end")
    setAddressInput(
      getAddressLabel(suggestion) || "",
      type.toLowerCase() as "start" | "end",
    )
    setSearchQuery("") // This will clear suggestions
    resetHighlight()
  }

  // Use keyboard navigation hook with either suggestions or recent searches
  const navigationItems = suggestions.length > 0 ? suggestions : recentSearches
  const { highlightedIndex, handleKeyDown, resetHighlight } =
    useKeyboardNavigation({
      items: navigationItems,
      onSelect: handleSuggestionSelect,
    })

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

    // Load recent searches when input is focused (only if empty)
    if (!query || query.length === 0) {
      const recent = getRecentSearchesForType(type)
      setRecentSearches(recent.map(r => r.feature))
    }
  }

  // Hide suggestions when the input loses focus (with a slight delay to allow suggestion clicks).
  const handleBlur = () => {
    // Clear previous timeout if exists
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }

    blurTimeoutRef.current = setTimeout(
      () => setSearchQuery(""),
      SEARCH_BLUR_DELAY_MS,
    )
  }

  // Handle "Use My Location" button click
  const handleUseMyLocation = async () => {
    try {
      const position = await getCurrentPosition()

      // Create a feature from the geolocation coordinates
      const locationFeature: IMapFeature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [position.longitude, position.latitude],
        },
        properties: {
          label: "Current Location",
        },
      }

      setAddress(locationFeature, type.toLowerCase() as "start" | "end")
      setAddressInput("Current Location", type.toLowerCase() as "start" | "end")
      displayMessage("Using your current location", "success")
    } catch (error) {
      // Error is already set in the hook, just display a message
      displayMessage(
        geoError || "Unable to get your location. Please check permissions.",
        "error",
      )
    }
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
        size="small"
        label={type === "Start" ? "From" : "To"}
        placeholder="e.g., 350 5th Ave, Manhattan"
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
            : query.length >= SEARCH_MIN_LENGTH &&
                !loading &&
                suggestions.length === 0 &&
                data
              ? "Try a street address (e.g., 350 5th Ave) or building number"
              : ""
        }
        error={false}
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
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Use my current location" placement="top">
                  <span>
                    <IconButton
                      onClick={handleUseMyLocation}
                      disabled={!isInputEnabled || geoLoading}
                      size="medium"
                      edge="end"
                      aria-label="Use my current location"
                      sx={{
                        minWidth: 44,
                        minHeight: 44,
                        color: "primary.main",
                        "&:hover": {
                          color: "primary.dark",
                        },
                        "&.Mui-disabled": {
                          color: "action.disabled",
                        },
                      }}
                    >
                      {geoLoading ? (
                        <CircularProgress size={20} />
                      ) : (
                        <MyLocation fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          },
          htmlInput: {
            readOnly: isReadOnly,
            autoComplete: randomAutoComplete,
            autoCorrect: "off",
            autoCapitalize: "off",
            spellCheck: "false",
          },
        }}
      />
      {(((loading || error || suggestions.length > 0) &&
        query.length >= SEARCH_MIN_LENGTH) ||
        (recentSearches.length > 0 && query.length === 0)) && (
        <SuggestionDropdown
          anchorEl={anchorEl}
          type={type}
          query={query}
          loading={loading}
          error={error}
          suggestions={suggestions}
          recentSearches={recentSearches}
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
