import React from "react";
import Paper from "@material-ui/core/Paper";
import {TravelModeSelect} from "./TravelModeSelect"
import {TitleBar} from "./TitleBar";
import {useStyles} from "../utils/style"


export const ControlsContainer = ({children}) => {

    const classes = useStyles();

    return (
        <Paper
            square
            className={classes.root}
            elevation={8}
        >
            <TitleBar/>
            <TravelModeSelect />
            <div className={classes.children}>
                {children}
            </div>
        </Paper>
    )
};