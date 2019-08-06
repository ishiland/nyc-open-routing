import React from "react";
import Paper from "@material-ui/core/Paper";
import {makeStyles} from "@material-ui/core/styles";
import AppBar from "@material-ui/core/AppBar";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import {DirectionsBike, DirectionsCar, DirectionsWalk} from "@material-ui/icons";
import "typeface-roboto";
import {TitleBar} from "./TitleBar";

const useStyles = makeStyles(theme => ({
    root: {
        position: 'fixed',
        zIndex: '100',
        width: '330px',
        height: '100vh',
    },
    header: {
        margin: theme.spacing(1),
        display: 'inline'
    },
    children: {
        margin: theme.spacing(1),
    },
    tab: {
        minWidth: '110px',
        maxWidth: '110px',
        width: '110px'
    },
}));


export const Panel = (props) => {

    const classes = useStyles();

    function handleChange(event, newValue) {
        props.onModeChange(newValue)
    }

    const {mode, children} = props;

    return (
        <Paper square className={classes.root}
               elevation={8}
        >
            <TitleBar/>
            <AppBar position="static" color="default">
                <Tabs
                    value={mode}
                    onChange={handleChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                >
                    <Tab icon={<DirectionsCar />} value="drive" className={classes.tab}
                         aria-label="Driving Directions"/>
                    <Tab icon={<DirectionsBike />} value="bike" className={classes.tab}
                         aria-label="Biking Directions"/>
                    <Tab icon={<DirectionsWalk />} value="walk" className={classes.tab}
                         aria-label="Walking Directions"/>
                </Tabs>
            </AppBar>

            <div className={classes.children}>
                {children}
            </div>
        </Paper>
    )
};