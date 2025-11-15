import React from "react"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Box from "@mui/material/Box"
import match from "autosuggest-highlight/match"
import parse from "autosuggest-highlight/parse"
import { AddressProperties } from "../types/interfaces"

// ------------------------
// Autosuggest search utils
// ------------------------

interface InputProps {
  [key: string]: any
}

// Suggestion type for autosuggest - currently using AddressProperties directly

interface RenderSuggestionParams {
  query: string
  isHighlighted: boolean
}

export function renderInputComponent(inputProps: InputProps) {
  const { ...other } = inputProps

  return <TextField fullWidth {...other} />
}

export function renderSuggestion(
  suggestion: AddressProperties,
  { query, isHighlighted }: RenderSuggestionParams,
) {
  const suggestionText = getAddressLabel(suggestion)
  if (!suggestionText) return null
  const matches = match(suggestionText, query)
  const parts = parse(suggestionText, matches)

  return (
    <MenuItem
      selected={isHighlighted}
      component="div"
      sx={{ fontSize: "14px" }}
    >
      <Box component="div">
        {parts.map((part, index) => (
          <Box
            component="span"
            key={index}
            sx={{ fontWeight: part.highlight ? 600 : 400 }}
          >
            {part.text}
          </Box>
        ))}
      </Box>
    </MenuItem>
  )
}

export function getSuggestionValue(suggestion: AddressProperties): string {
  return getAddressLabel(suggestion) || ""
}

export const getAddressLabel = (suggestion: AddressProperties): string => {
  const parts: string[] = []
  if (suggestion["House Number - Display Format"]) {
    parts.push(suggestion["House Number - Display Format"])
  }
  if (suggestion["First Street Name Normalized"]) {
    parts.push(suggestion["First Street Name Normalized"])
  }
  if (suggestion["First Borough Name"]) {
    parts.push(suggestion["First Borough Name"])
  }
  return parts.join(" ")
}
