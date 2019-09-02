import React from "react";

import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import match from "autosuggest-highlight/match";
import parse from "autosuggest-highlight/parse";

// ------------------------
// Autosuggest search utils
// ------------------------
export function renderInputComponent(inputProps) {
    const {
        classes,
        ...other
    } = inputProps;

    return (
        <TextField
            fullWidth
            InputProps={{
                classes: {
                    input: classes.input,
                },
            }}
            {...other}
        />
    );
}

export function renderSuggestion(suggestion, {query, isHighlighted}) {
    const matches = match(`${suggestion.properties.name}, ${suggestion.properties.borough}`, query);
    const parts = parse(`${suggestion.properties.name}, ${suggestion.properties.borough}`, matches);
    return (
        <MenuItem selected={isHighlighted} component="div" style={{fontSize: '14px'}}>
            <div>
                {parts.map((part, index) => (
                    <span
                        key={index}  // eslint-disable-line react/no-array-index-key
                        style={{fontWeight: part.highlight ? 600 : 400}}>
                        {part.text}
                    </span>
                ))}
            </div>
        </MenuItem>
    );
}

export function getSuggestionValue(suggestion) {
    return `${suggestion.properties.name}, ${suggestion.properties.borough}`;
}


export const convertToGeojson = (data) => {

    return {
        "type": "Feature",
        "properties": Object.assign({}, data),
        "geometry": {
        "type": "Point",
            "coordinates": [
            data['Longitude'],
            data['Latitude']
        ]
    }
    }
};


export const getAddressLabel = (data)=>{
    return `${data["House Number - Display Format"]} ${data["First Street Name Normalized"]}, ${data["First Borough Name"]}`

}