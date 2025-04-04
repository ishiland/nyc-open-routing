// Search.tsx
import React, { useContext, useState, FC, useRef } from "react";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import MenuItem from "@mui/material/MenuItem";
import Popper from "@mui/material/Popper";
import Box from "@mui/material/Box";
import { AddressContext } from "../contexts/AddressContext";
import { AddressProperties, AddressContextType } from "../types/interfaces";

interface SearchProps {
  type: "Start" | "End";
}

const getAddressLabel = (data: AddressProperties) => {
  return `${data["House Number - Display Format"]} ${data["First Street Name Normalized"]}, ${data["First Borough Name"]}`;
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

// Helper to transform an address suggestion into a GeoJSON Feature
const transformAddressToFeature = (address: AddressProperties) => {
  if (!address["Latitude"] || !address["Longitude"]) {
    console.error("Invalid latitude or longitude", address);
    return null;
  }
  const latitude = parseFloat(address["Latitude"]);
  const longitude = parseFloat(address["Longitude"]);
  if (isNaN(latitude) || isNaN(longitude)) {
    console.error("Invalid latitude or longitude", address);
    return null;
  }
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [longitude, latitude]
    },
    properties: address
  };
};

const Search: FC<SearchProps> = ({ type }) => {
  const {
    setAddress,
    startAddressInput,
    endAddressInput,
    setAddressInput,
    isInputEnabled,
  } = useContext<AddressContextType>(AddressContext);

  const [stateSuggestions, setSuggestions] = useState<AddressProperties[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const query = type === "Start" ? startAddressInput : endAddressInput;

  // Fetch suggestions from the API if the input has at least 3 characters.
  const fetchSuggestions = (value: string) => {
    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    fetch(`/api/search?address=${encodeURIComponent(value)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Bad response from server: ${response.status} ${response.statusText}`
          );
        }
        return response.json();
      })
      .then((data: AddressProperties[] | { addresses?: AddressProperties[] }) => {
        const suggestions = Array.isArray(data) ? data : data.addresses || [];
        setSuggestions(suggestions);
        setHighlightedIndex(-1);
      })
      .catch((error) => {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      });
  };

  // Update the input value and fetch suggestions.
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setAddressInput(newValue, type);
    fetchSuggestions(newValue);
  };

  // Handle keyboard navigation (arrow keys and Enter key).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        prev < stateSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : stateSuggestions.length - 1
      );
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < stateSuggestions.length) {
        event.preventDefault();
        handleSuggestionSelect(stateSuggestions[highlightedIndex]);
      }
    }
  };

  // Handle suggestion selection either by click or by pressing Enter.
  const handleSuggestionSelect = (suggestion: AddressProperties) => {
    const geoFeature = transformAddressToFeature(suggestion);
    console.log("geoFeature", geoFeature);
    if (!geoFeature) return;
    setAddress(geoFeature, type);
    setAddressInput(getAddressLabel(suggestion) || "", type);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  // Hide suggestions when the input loses focus (with a slight delay to allow suggestion clicks).
  const handleBlur = () => {
    setTimeout(() => setSuggestions([]), 200);
  };

  // Render suggestion content with simple highlighting.
  const renderSuggestionContent = (suggestion: AddressProperties) => {
    const suggestionText = getAddressLabel(suggestion);
    if (!suggestionText) return null;
    return <Box component="div">{highlightText(suggestionText, query)}</Box>;
  };

  return (
    <Box sx={{ flexGrow: 1, margin: "10px 0", position: "relative" }}>
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
      />
      {anchorEl && stateSuggestions.length > 0 && (
        <Popper
          open={true}
          anchorEl={anchorEl}
          placement="bottom-start"
          sx={{ zIndex: 101, width: anchorEl.clientWidth }}
        >
          <Paper square elevation={4}>
            {stateSuggestions.map((suggestion, index) => (
              <MenuItem
                key={index}
                selected={index === highlightedIndex}
                onMouseDown={() => handleSuggestionSelect(suggestion)}
                component="div"
                sx={{ fontSize: "14px", zIndex: 101 }}
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
