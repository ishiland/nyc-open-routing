import React, { useState, useRef, useEffect, useContext } from "react"
import TextField from "@mui/material/TextField"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import InputAdornment from "@mui/material/InputAdornment"
import { Close } from "@mui/icons-material"
import {
  IMapFeature,
  SearchResponse,
  GeosupportFeature,
} from "../../types/interfaces"
import useDebouncedFetch from "../../hooks/useDebouncedFetch"
import useKeyboardNavigation from "../../hooks/useKeyboardNavigation"
import useAutofillPrevention from "../../hooks/useAutofillPrevention"
import SuggestionDropdown from "./SuggestionDropdown"
import { RoutingContext } from "../../contexts/RoutingContext"
import { commonStyles } from "../../utils/themeUtils"
import debug from "../../utils/debug"
import { SEARCH_MIN_LENGTH, SEARCH_BLUR_DELAY_MS } from "../../utils/constants"
import { getAddressLabel, getSuggestionId } from "../../utils/suggestionHelpers"

interface WaypointSearchProps {
  index: number // waypoint index in the array
  waypoint: IMapFeature // the current waypoint data
}

// Helper to map the GeoSearch API response to the expected format
const transformSearchResult = (
  feature: GeosupportFeature,
): IMapFeature | null => {
  if (!feature || !feature.geometry || !feature.geometry.coordinates) {
    debug.error("Invalid feature data", feature)
    return null
  }

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

const WaypointSearchComponent: React.FC<WaypointSearchProps> = ({
  index,
  waypoint,
}) => {
  const { removeWaypoint, updateWaypoint, isInputEnabled } =
    useContext(RoutingContext)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const blurTimeoutRef = useRef<NodeJS.Timeout>()
  const inputIdRef = useRef(`auto-suggest-waypoint-${index}-${Date.now()}`)

  const [inputValue, setInputValue] = useState<string>(
    (waypoint.properties?.label as string) || "",
  )

  // Use autofill prevention hook
  const {
    isReadOnly,
    handleFocus: handleAutofillFocus,
    randomAutoComplete,
  } = useAutofillPrevention()

  // Use debounced fetch for address search
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

  const suggestions = data?.features || []

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: GeosupportFeature) => {
    const transformedFeature = transformSearchResult(suggestion)
    if (!transformedFeature) return

    updateWaypoint(index, transformedFeature)
    setInputValue(getAddressLabel(suggestion) || "")
    setSearchQuery("")
    resetHighlight()
  }

  // Use keyboard navigation hook
  const { highlightedIndex, handleKeyDown, resetHighlight } =
    useKeyboardNavigation({
      items: suggestions,
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

  // Update input value and trigger search
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setInputValue(newValue)
    setSearchQuery(newValue)
  }

  // Handle focus with autofill prevention
  const handleFocus = () => {
    handleAutofillFocus(inputRef)
  }

  // Hide suggestions on blur with delay
  const handleBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }
    blurTimeoutRef.current = setTimeout(
      () => setSearchQuery(""),
      SEARCH_BLUR_DELAY_MS,
    )
  }

  // Handle remove waypoint
  const handleRemove = () => {
    removeWaypoint(index)
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
        label={`Stop ${index + 1}`}
        placeholder="e.g., 350 5th Ave, Manhattan"
        disabled={!isInputEnabled}
        inputRef={node => {
          inputRef.current = node
          setAnchorEl(node)
        }}
        id={inputIdRef.current}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        helperText={
          inputValue.length > 0 && inputValue.length < SEARCH_MIN_LENGTH
            ? `Enter at least ${SEARCH_MIN_LENGTH} characters to search`
            : inputValue.length >= SEARCH_MIN_LENGTH &&
                !loading &&
                suggestions.length === 0 &&
                data
              ? "Try a street address (e.g., 350 5th Ave) or building number"
              : ""
        }
        error={false}
        aria-controls={
          suggestions.length > 0
            ? `waypoint-${index}-suggestions-list`
            : undefined
        }
        aria-activedescendant={
          highlightedIndex >= 0
            ? getSuggestionId(`waypoint-${index}`, highlightedIndex)
            : undefined
        }
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleRemove}
                  size="small"
                  edge="end"
                  aria-label={`Remove stop ${index + 1}`}
                  sx={{
                    minWidth: 44,
                    minHeight: 44,
                    color: "text.secondary",
                    "&:hover": {
                      color: "error.main",
                    },
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
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
      {(loading || error || suggestions.length > 0) &&
        inputValue.length >= SEARCH_MIN_LENGTH && (
          <SuggestionDropdown
            anchorEl={anchorEl}
            type={`Waypoint-${index}` as "Start"}
            query={inputValue}
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

const WaypointSearch = React.memo(WaypointSearchComponent)

export default WaypointSearch
