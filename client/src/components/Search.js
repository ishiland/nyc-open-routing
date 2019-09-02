import React, {useContext, useState} from "react";
import Autosuggest from "react-autosuggest";
import match from "autosuggest-highlight/match";
import parse from "autosuggest-highlight/parse";
import TextField from "@material-ui/core/TextField";
import Paper from "@material-ui/core/Paper";
import MenuItem from "@material-ui/core/MenuItem";
import Popper from "@material-ui/core/Popper";
import {makeStyles} from "@material-ui/core/styles";
import {getAddressLabel} from '../utils/search'
import {AddressContext} from '../contexts/AddressContext';


const useStyles = makeStyles(theme => ({
    root: {
        flexGrow: 1,
        margin: '10px'
    },
    container: {
        position: 'absolute',
        zIndex: 101,

    },
    suggestionsContainerOpen: {
        position: 'absolute',
        marginTop: theme.spacing(1),
        left: 0,
        right: 0,
        zIndex: 101,
    },
    suggestion: {
        display: 'block',
        zIndex: 101,
    },
    suggestionsList: {
        margin: 0,
        padding: 0,
        listStyleType: 'none',
        zIndex: 101,
    },
    divider: {
        height: theme.spacing(2),
    },
    tooltip: {
        zIndex: 101
    }
}));


function renderInputComponent(inputProps) {
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

function renderSuggestion(suggestion, {query, isHighlighted}) {
    const matches = match(getAddressLabel(suggestion), query);
    const parts = parse(getAddressLabel(suggestion), matches);
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

function getSuggestionValue(suggestion) {
    return getAddressLabel(suggestion);
}

function Search({type}) {
    const {setAddress, startAddressInput, endAddressInput, setAddressInput, isInputEnabled} = useContext(AddressContext);

    const classes = useStyles();

    const [anchorEl, setAnchorEl] = useState(null);

    const [stateSuggestions, setSuggestions] = useState([]);

    const handleSuggestionsFetchRequested = ({value}) => {
        // Use Geosearch API to get suggestions
        fetch(`/api/search?address=${value}`)
            .then(response => {
                if (response.status >= 400) {
                    throw new Error("Bad response from server");
                }
                return response.json();
            })
            .then(data => {
                setSuggestions(data);
            });
    };

    const handleSuggestionsClearRequested = () => {
        setSuggestions([]);
    };

    const handleChange = name => (event, {newValue}) => {
        setAddressInput(newValue, type);
    };

    const autosuggestProps = {
        renderInputComponent,
        suggestions: stateSuggestions,
        onSuggestionsFetchRequested: handleSuggestionsFetchRequested,
        onSuggestionsClearRequested: handleSuggestionsClearRequested,
        getSuggestionValue,
        renderSuggestion,
    };


    const suggestionSelected = (event, {suggestion}) => {
        setAddress(suggestion, type)
    };

    return (
        <div className={classes.root}>
            <Autosuggest
                {...autosuggestProps}
                onSuggestionSelected={suggestionSelected}
                inputProps={{
                    classes,
                    id: 'react-autosuggest-popper',
                    label: `${type} Address`,
                    placeholder: 'Type an address',
                    value: type === 'Start' ? startAddressInput : endAddressInput,
                    onChange: handleChange('popper'),
                    disabled: !isInputEnabled,
                    inputRef: node => {
                        setAnchorEl(node);
                    },
                }}
                theme={{
                    suggestionsList: classes.suggestionsList,
                    suggestion: classes.suggestion,
                }}
                renderSuggestionsContainer={options => (
                    <Popper anchorEl={anchorEl}
                            placement="bottom"
                            transition
                            disablePortal
                            modifiers={{
                                flip: {
                                    enabled: false,
                                },
                                hide: {
                                    enabled: false
                                },
                                preventOverflow: {
                                    enabled: false,
                                },
                            }}
                            open={Boolean(options.children)} style={{zIndex: '101'}}>
                        <Paper
                            square
                            {...options.containerProps}
                            style={{width: anchorEl ? anchorEl.clientWidth : undefined}}
                        >
                            {options.children}
                        </Paper>
                    </Popper>
                )}
            />
        </div>
    );
}

export default Search;