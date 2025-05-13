import React from "react";
import Paper from "@mui/material/Paper";
import {TravelModeSelect} from "./TravelModeSelect"
import {TitleBar} from "../shared/TitleBar";
import {ControlsContainerProps} from "../../types/interfaces";
import Box from '@mui/material/Box';

export const ControlsContainer: React.FC<ControlsContainerProps> = ({children}) => {
    return (
        <Paper
            square
            sx={{
                width: 330,
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
            }}
            elevation={8}
        >
            <TitleBar/>
            <TravelModeSelect />
            <Box sx={{ padding: 2, overflowY: 'auto', flexGrow: 1 }}>
                {children}
            </Box>
        </Paper>
    );
}; 