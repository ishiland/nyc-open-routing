import {red} from "@material-ui/core/colors";
import {createMuiTheme} from "@material-ui/core/styles";

const palette = {
    // primary: {
    //     main: '#556cd6',
    // },
    // secondary: {
    //     main: '#19857b',
    // },
    error: {
        main: red.A400,
    },
    background: {
        default: '#fff',
    },
}

const typography = {
    // Use the system font instead of the default Roboto font.
    fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
    ].join(','),
    h1: {
        fontSize: 18,
        fontWeight: 400,
    }
}

// A custom theme for this app
export const theme = createMuiTheme({palette, typography});

export const GEOSEARCH_API = 'https://geosearch.planninglabs.nyc/v1/search?size=5&text=';

export const GEOSEARCH_API_REVERSE = 'https://geosearch.planninglabs.nyc/v1/reverse?';

export const startPointPaint = {};

export const endPointPaint = {};

export const drivingRoutePaint = {};

export const walkingRoutePaint = {};

export const bikingRoutePaint = {};


export default theme;