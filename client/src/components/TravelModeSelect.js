import React, {useContext} from "react";
import AppBar from "@material-ui/core/AppBar";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import {DirectionsBike, DirectionsCar, DirectionsWalk} from "@material-ui/icons";
import {TravelModeContext} from '../contexts/TravelModeContext';
import  {useStyles} from '../utils/style'


export const TravelModeSelect = () => {
    const classes = useStyles();

    const {mode, setMode} = useContext(TravelModeContext);

    return (
        <AppBar position="static" color="default">
            <Tabs
                value={mode}
                onChange={setMode}
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
    )
};