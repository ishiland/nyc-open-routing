import React, { FC } from "react"
import Paper from "@mui/material/Paper"
import MenuItem from "@mui/material/MenuItem"
import Popper from "@mui/material/Popper"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import ErrorIcon from "@mui/icons-material/Error"
import { GeosupportFeature } from "../../types/interfaces"
import { commonStyles } from "../../utils/themeUtils"
import { DROPDOWN_Z_INDEX } from "../../utils/constants"
import {
  getAddressLabel,
  getSuggestionId,
  getSuggestionKey,
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
  highlightedIndex,
  onSuggestionSelect,
}) => {
  if (!anchorEl) return null

  // Render suggestion content with simple highlighting.
  const renderSuggestionContent = (suggestion: GeosupportFeature) => {
    const suggestionText = getAddressLabel(suggestion)
    if (!suggestionText) return null
    return <Box component="div">{highlightText(suggestionText, query)}</Box>
  }

  return (
    <Popper
      open={true}
      anchorEl={anchorEl}
      placement="bottom-start"
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
        {!loading && !error && suggestions.length === 0 && (
          <MenuItem disabled>
            No addresses found. Try a different search.
          </MenuItem>
        )}
        {!loading &&
          !error &&
          suggestions.map((suggestion, index) => (
            <MenuItem
              key={getSuggestionKey(type, suggestion)}
              id={getSuggestionId(type, index)}
              selected={index === highlightedIndex}
              onMouseDown={() => onSuggestionSelect(suggestion)}
              component="div"
              role="option"
              aria-selected={index === highlightedIndex}
              sx={commonStyles.suggestionItem}
            >
              {renderSuggestionContent(suggestion)}
            </MenuItem>
          ))}
      </Paper>
    </Popper>
  )
}

export default SuggestionDropdown
