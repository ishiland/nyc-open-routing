import React from "react";
import {makeStyles} from "@material-ui/core/styles";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import InfoModal from "./InfoModal";

const useStyles = makeStyles(theme => ({
        root: {
            flexGrow: 1,
        },
        appbar: {
            color: theme.primary,
            // height:'45px'
        },
        toolbar: {
            // display:'inline'
            // height:'45px'
        },
        iconContainer: {
            margin: 'auto',
            marginRight: '0'
        },
        title:{
            fontSize:'20px',
            fontWeight: 400
        }

    })
);


export const TitleBar = () => {

    const classes = useStyles();

    return (
        <div className={classes.root}>
            <AppBar position='relative' className={classes.appbar}>
                <Toolbar variant="dense" className={classes.toolbar}>
                    <Typography variant="h1" color="inherit" className={classes.title}>
                        NYC Open Routing
                    </Typography>
                    <InfoModal/>
                </Toolbar>
            </AppBar>
        </div>
    )
};
