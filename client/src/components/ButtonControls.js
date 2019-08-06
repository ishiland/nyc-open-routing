import React from "react";
import {makeStyles} from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import {Directions} from "@material-ui/icons";
import CircularProgress from '@material-ui/core/CircularProgress';
import "typeface-roboto";

const useStyles = makeStyles(theme => ({
    button: {
        margin: theme.spacing(1),
    },
    icon: {
        margin: theme.spacing(0, 1, 0, 0),
    },
    progress: {
        margin: theme.spacing(0, 0, 0, 4),
        verticalAlign: 'middle'
    },
}));


export const ButtonControls = (props) => {
    const classes = useStyles();

    const {onReset, isFetching, onRouteButtonClick, routeButtonDisabled} = props;

    return (
        <div>
            <Button
                onClick={onReset}
                variant="contained"
                disabled={isFetching}
                className={classes.button}>
                clear
            </Button>
            <Button
                onClick={onRouteButtonClick}
                variant="contained"
                color="primary"
                disabled={isFetching || routeButtonDisabled}
                className={classes.button}
            >
                <Directions className={classes.icon}/>Route
            </Button>
            {isFetching && <CircularProgress className={classes.progress} size={20}/> }
        </div>
    )
};