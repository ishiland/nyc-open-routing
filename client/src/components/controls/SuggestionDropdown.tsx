import React, { FC } from "react"
import Paper from "@mui/material/Paper"
import MenuItem from "@mui/material/MenuItem"
import Popper from "@mui/material/Popper"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import ErrorIcon from "@mui/icons-material/Error"
import LocationOnIcon from "@mui/icons-material/LocationOn"
import HomeIcon from "@mui/icons-material/Home"
import { GeosupportFeature } from "../../types/interfaces"
import { commonStyles } from "../../utils/themeUtils"
import { DROPDOWN_Z_INDEX } from "../../utils/constants"
import {
  getAddressLabel,
  getSuggestionId,
  getSuggestionKey,
  getCategoryInfo,
  getSecondaryText,
} from "../../utils/suggestionHelpers"

// Utility to escape regex special characters in the query string.
function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Simple function to highlight parts of the text matching the query.
function highlightText(text: string, query: string) {
  if (!query) return text
  const escapedQuery = escapeRegExp(query)
  const regex = new RegExp(`(${escapedQuery})`, "gi")
  const parts = text.split(regex)
  return parts.map((part, index) =>
    regex.test(part) ? (
      <span key={index} style={{ fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

interface SuggestionDropdownProps {
  anchorEl: HTMLElement | null
  type: "Start" | "End"
  query: string
  loading: boolean
  error: Error | null
  suggestions: GeosupportFeature[]
  recentSearches?: GeosupportFeature[]
  highlightedIndex: number
  onSuggestionSelect: (suggestion: GeosupportFeature) => void
}

/**
 * Dropdown component for displaying address search suggestions
 * Handles loading states, errors, and suggestion rendering
 */
const SuggestionDropdown: FC<SuggestionDropdownProps> = ({
  anchorEl,
  type,
  query,
  loading,
  error,
  suggestions,
  recentSearches = [],
  highlightedIndex,
  onSuggestionSelect,
}) => {
  if (!anchorEl) return null

  // Show recent searches if no query and not loading
  const showRecentSearches =
    !query && !loading && suggestions.length === 0 && recentSearches.length > 0
  const displayItems = showRecentSearches ? recentSearches : suggestions

  // Render suggestion content with highlighting, icon, and secondary info.
  const renderSuggestionContent = (suggestion: GeosupportFeature) => {
    const suggestionText = getAddressLabel(suggestion)
    if (!suggestionText) return null

    const categoryInfo = getCategoryInfo(suggestion)
    const secondaryText = getSecondaryText(suggestion)
    const Icon = categoryInfo.hasHouseNumber ? HomeIcon : LocationOnIcon

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.5,
          width: "100%",
        }}
      >
        <Icon
          sx={{
            fontSize: 20,
            color: "text.secondary",
            mt: 0.25,
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="div"
            variant="body2"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {highlightText(suggestionText, query)}
          </Typography>
          {secondaryText && (
            <Typography
              component="div"
              variant="caption"
              sx={{
                color: "text.secondary",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {secondaryText}
            </Typography>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Popper
      open={true}
      anchorEl={anchorEl}
      placement="bottom-start"
      disablePortal
      sx={{ zIndex: DROPDOWN_Z_INDEX, width: anchorEl.clientWidth }}
    >
      <Paper
        square
        elevation={4}
        id={`${type.toLowerCase()}-suggestions-list`}
        role="listbox"
        aria-label={`${type} address suggestions`}
      >
        {loading && (
          <MenuItem disabled>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            Searching addresses...
          </MenuItem>
        )}
        {!loading && error && (
          <MenuItem disabled>
            <ErrorIcon sx={{ mr: 1, color: "error.main" }} />
            Search failed. Please try again.
          </MenuItem>
        )}
        {!loading &&
          !error &&
          !showRecentSearches &&
          suggestions.length === 0 && (
            <MenuItem disabled>
              No addresses found. Try a different search.
            </MenuItem>
          )}
        {showRecentSearches && (
          <MenuItem
            disabled
            sx={{
              py: 0.75,
              px: 2,
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "text.secondary",
            }}
          >
            RECENT SEARCHES
          </MenuItem>
        )}
        {!loading &&
          !error &&
          displayItems.map((suggestion, index) => (
            <MenuItem
              key={getSuggestionKey(type, suggestion)}
              id={getSuggestionId(type, index)}
              selected={index === highlightedIndex}
              onMouseDown={() => onSuggestionSelect(suggestion)}
              component="div"
              role="option"
              aria-selected={index === highlightedIndex}
              sx={{
                ...commonStyles.suggestionItem,
                py: 1.5,
                px: 2,
                alignItems: "flex-start",
              }}
            >
              {renderSuggestionContent(suggestion)}
            </MenuItem>
          ))}
      </Paper>
    </Popper>
  )
}

export default SuggestionDropdown
