import React, { useContext } from "react";
import AppBar from "@mui/material/AppBar";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { DirectionsBike, DirectionsCar, DirectionsWalk } from "@mui/icons-material";
import { TravelModeContext } from '../contexts/TravelModeContext';
import { TravelModeContextType, TravelMode } from "../types/interfaces";

export const TravelModeSelect: React.FC = () => {
    const { mode, setMode } = useContext<TravelModeContextType>(TravelModeContext);

    const tabSx = {
        minWidth: 'auto',
        flexGrow: 1
    };

    return (
        <AppBar position="static" color="default">
            <Tabs
                value={mode}
                onChange={(event, newValue: TravelMode) => setMode(event, newValue)}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
            >
                <Tab icon={<DirectionsCar />} value="drive" sx={tabSx}
                     aria-label="Driving Directions"/>
                <Tab icon={<DirectionsBike />} value="bike" sx={tabSx}
                     aria-label="Biking Directions"/>
                <Tab icon={<DirectionsWalk />} value="walk" sx={tabSx}
                     aria-label="Walking Directions"/>
            </Tabs>
        </AppBar>
    );
}; 