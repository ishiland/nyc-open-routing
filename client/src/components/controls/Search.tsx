// Search.tsx
import React, { useState, FC, useRef, useEffect, useContext } from "react";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import MenuItem from "@mui/material/MenuItem";
import Popper from "@mui/material/Popper";
import Box from "@mui/material/Box";
import { AddressProperties, IMapFeature } from "../../types/interfaces";
import useDebouncedFetch from "../../hooks/useDebouncedFetch";
import { RoutingContext } from "../../contexts/RoutingContext";
import { commonStyles } from "../../utils/themeUtils";

interface SearchProps {
  type: "Start" | "End";
}

interface SearchResponse {
  features: any[];
}

// Updated to handle NYC Planning Labs GeoSearch API response format
const getAddressLabel = (feature: any) => {
  if (!feature || !feature.properties) return "";
  return feature.properties.label || "";
};

// Utility to escape regex special characters in the query string.
function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Simple function to highlight parts of the text matching the query.
function highlightText(text: string, query: string) {
  if (!query) return text;
  const escapedQuery = escapeRegExp(query);
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    regex.test(part) ? (
      <span key={index} style={{ fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

// Helper to map the GeoSearch API response to the expected format
const transformSearchResult = (feature: any): IMapFeature | null => {
  if (!feature || !feature.geometry || !feature.geometry.coordinates) {
    console.error("Invalid feature data", feature);
    return null;
  }
  
  // GeoSearch API returns [longitude, latitude]
  const [longitude, latitude] = feature.geometry.coordinates;
  
  if (isNaN(latitude) || isNaN(longitude)) {
    console.error("Invalid coordinates", feature);
    return null;
  }
  
  return {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [longitude, latitude]
    },
    properties: feature.properties
  };
};

const Search: FC<SearchProps> = ({ type }) => {
  const {
    setAddress,
    startAddressInput,
    endAddressInput,
    setAddressInput,
    isInputEnabled,
  } = useContext(RoutingContext);

  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout>();

  const query = type === "Start" ? startAddressInput : endAddressInput;

  // Use our custom hook for debounced API fetching
  const { data, setQuery: setSearchQuery } = useDebouncedFetch<SearchResponse>({
    url: '/api/search',
    queryParam: 'address',
    minLength: 3,
    enabled: isInputEnabled
  });

  // Extract suggestions from the fetched data
  const suggestions = data?.features || [];

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Update the input value and trigger search
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setAddressInput(newValue, type.toLowerCase() as 'start' | 'end');
    setSearchQuery(newValue);
  };

  // Handle keyboard navigation (arrow keys and Enter key).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        event.preventDefault();
        handleSuggestionSelect(suggestions[highlightedIndex]);
      }
    }
  };

  // Handle suggestion selection either by click or by pressing Enter.
  const handleSuggestionSelect = (suggestion: any) => {
    const transformedFeature = transformSearchResult(suggestion);
    if (!transformedFeature) return;
    setAddress(transformedFeature, type.toLowerCase() as 'start' | 'end');
    setAddressInput(getAddressLabel(suggestion) || "", type.toLowerCase() as 'start' | 'end');
    setSearchQuery(""); // This will clear suggestions
    setHighlightedIndex(-1);
  };

  // Hide suggestions when the input loses focus (with a slight delay to allow suggestion clicks).
  const handleBlur = () => {
    // Clear previous timeout if exists
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    
    blurTimeoutRef.current = setTimeout(() => setSearchQuery(""), 200);
  };

  // Render suggestion content with simple highlighting.
  const renderSuggestionContent = (suggestion: any) => {
    const suggestionText = getAddressLabel(suggestion);
    if (!suggestionText) return null;
    return <Box component="div">{highlightText(suggestionText, query)}</Box>;
  };

  // Generate a unique ID for each suggestion item to use with aria-activedescendant
  const getSuggestionId = (index: number) => `${type.toLowerCase()}-suggestion-${index}`;
  
  // Helper to generate a stable key from suggestion
  const getSuggestionKey = (suggestion: any) => {
    // Use the suggestion's ID if available
    if (suggestion.properties?.id) {
      return `${type}-${suggestion.properties.id}`;
    }
    
    // Otherwise try to make a relatively stable composite key
    const label = suggestion.properties?.label || '';
    const coords = suggestion.geometry?.coordinates || [];
    return `${type}-${label}-${coords.join(',')}`;
  };

  return (
    <Box sx={commonStyles.formGroup}>
      <TextField
        fullWidth
        placeholder="Type an address"
        disabled={!isInputEnabled}
        inputRef={(node) => {
          inputRef.current = node;
          setAnchorEl(node);
        }}
        id={`auto-suggest-${type}`}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        aria-controls={suggestions.length > 0 ? `${type.toLowerCase()}-suggestions-list` : undefined}
        aria-activedescendant={highlightedIndex >= 0 ? getSuggestionId(highlightedIndex) : undefined}
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
      />
      {anchorEl && suggestions.length > 0 && (
        <Popper
          open={true}
          anchorEl={anchorEl}
          placement="bottom-start"
          sx={{ zIndex: 101, width: anchorEl.clientWidth }}
        >
          <Paper 
            square 
            elevation={4}
            id={`${type.toLowerCase()}-suggestions-list`}
            role="listbox"
            aria-label={`${type} address suggestions`}
          >
            {suggestions.map((suggestion, index) => (
              <MenuItem
                key={getSuggestionKey(suggestion)}
                id={getSuggestionId(index)}
                selected={index === highlightedIndex}
                onMouseDown={() => handleSuggestionSelect(suggestion)}
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
      )}
    </Box>
  );
};

export default Search;
