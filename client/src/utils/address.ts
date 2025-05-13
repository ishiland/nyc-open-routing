import { AddressProperties } from "../types/interfaces";

/**
 * Formats an address properties object into a human-readable string
 * Handles both GeoSearch API and legacy Geosupport formats
 */
export const getAddressLabel = (suggestion: AddressProperties): string => {
    // If it's a GeoSearch API response (preferred)
    if (suggestion?.label) {
        return suggestion.label;
    }
    
    // If it has GeoSearch properties without a label
    if (suggestion?.housenumber && suggestion?.street) {
        const parts = [suggestion.housenumber, suggestion.street];
        if (suggestion.borough) {
            parts.push(suggestion.borough);
        }
        return parts.join(' ');
    }
    
    // Legacy Geosupport format
    const parts: string[] = [];
    if (suggestion?.["House Number - Display Format"]) {
        parts.push(suggestion["House Number - Display Format"]);
    }
    if (suggestion?.["First Street Name Normalized"]) {
        parts.push(suggestion["First Street Name Normalized"]);
    }
    if (suggestion?.["First Borough Name"]) {
        parts.push(suggestion["First Borough Name"]);
    }
    return parts.join(' ');
}; 