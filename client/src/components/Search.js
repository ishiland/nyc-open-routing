import React from "react";
import Autosuggest from "react-autosuggest";
import match from "autosuggest-highlight/match";
import parse from "autosuggest-highlight/parse";
import TextField from "@material-ui/core/TextField";
import Paper from "@material-ui/core/Paper";
import MenuItem from "@material-ui/core/MenuItem";
import Popper from "@material-ui/core/Popper";
import {makeStyles} from "@material-ui/core/styles";
import {GEOSEARCH_API} from "../config";

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
        // inputRef = () => {},
        // ref,
        ...other
    } = inputProps;

    return (
        <TextField
            fullWidth
            InputProps={{
                // inputRef: node => {ref(node); inputRef(node); },
                classes: {
                    input: classes.input,
                },
            }}
            {...other}
        />
    );
}

function renderSuggestion(suggestion, {query, isHighlighted}) {
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

function getSuggestionValue(suggestion) {
    return `${suggestion.properties.name}, ${suggestion.properties.borough}`;
}

function Search(props) {
    const classes = useStyles();
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [state, setState] = React.useState({
        single: '',
        popper: '',
    });
    const [stateSuggestions, setSuggestions] = React.useState([]);

    const handleSuggestionsFetchRequested = ({value}) => {
        // Use Geosearch API to get suggestions
        fetch(GEOSEARCH_API + value)
            .then(response => {
                if (response.status >= 400) {
                    throw new Error("Bad response from server");
                }
                return response.json();
            })
            .then(data => {
                setSuggestions(data.features);
            });
    };

    const handleSuggestionsClearRequested = () => {
        console.log('clear requested');  // eslint-disable-line no-console
        setSuggestions([]);
    };

    const handleChange = name => (event, {newValue}) => {
        setState({
            ...state,
            [name]: newValue,
        });
    };

    const autosuggestProps = {
        renderInputComponent,
        suggestions: stateSuggestions,
        onSuggestionsFetchRequested: handleSuggestionsFetchRequested,
        onSuggestionsClearRequested: handleSuggestionsClearRequested,
        getSuggestionValue,
        renderSuggestion,
    };

    // const onBlur = () => {
    //     // props.toggleFocus(false)
    // }

    // const onFocus = () => {
    //     props.toggleFocus(true)
    // }

    const {onLocationSelect, type} = props;

    return (
        <div className={classes.root}>
            <Autosuggest
                {...autosuggestProps}
                onSuggestionSelected={onLocationSelect}
                inputProps={{
                    classes,
                    id: 'react-autosuggest-popper',
                    label: `${type} Address`,
                    placeholder: 'Type an address', // or click the map',
                    value: state.popper,
                    onChange: handleChange('popper'),
                    inputRef: node => { setAnchorEl(node); },
                    // onBlur: () => onBlur(),
                    // onFocus: () => onFocus(),
                }}
                theme={{
                    suggestionsList: classes.suggestionsList,
                    suggestion: classes.suggestion,
                }}
                renderSuggestionsContainer={options => (
                    <Popper anchorEl={anchorEl}
                            placement="top"
                            disablePortal
                            modifiers={{
                                flip: {
                                    enabled: true,
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