import React from "react";
import {makeStyles} from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import Divider from "@material-ui/core/Divider";
import ListItemText from "@material-ui/core/ListItemText";

const useStyles = makeStyles(theme => ({
    root: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: theme.palette.background.paper,
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
        maxHeight: 'calc(100vh - 280px)',
    },
    subHeader: {
        margin: theme.spacing(1, 0),
        fontSize: '16px'
    },
    text: {
        fontSize: '12px'
    }

}));

const formatDistance = (feet) => {
    let distance = '';
    if (feet > 1000) {
        distance = `${(feet / 5260).toFixed(1)} mi`;
    } else {
        distance = `${Math.floor(feet)} ft`
    }
    return distance;
};

const formatTotalRouteTime = (routes) => {
    let time = '';
    const minutes = routes.map(x => x.properties.travel_time).reduce((a, c) => a + c);
    if (minutes > 60) {
        const quotient = Math.floor(minutes / 60);
        const remainder = Math.floor(minutes % 60);
        time = `${quotient} hr ${remainder} min`
    } else {
        time = `${Math.floor(minutes)} min`
    }
    return time;
};


const formatTotalRouteDistance = (routes) => {
    const feet = routes.map(x => x.properties.distance).reduce((a, c) => a + c);
    return formatDistance(feet)
};


export const RouteList = (props) => {
    const classes = useStyles();

    const {route} = props;

    return (
        <div className={classes.root}>
            {route.length ?
                <List
                    component="nav"
                    aria-labelledby="nested-list-subheader"
                    subheader={
                        <ListSubheader className={classes.subHeader}>
                            {formatTotalRouteDistance(route)} - {formatTotalRouteTime(route)}
                        </ListSubheader>
                    }
                    className={classes.root}
                >
                    {route.map(street => {
                        return (
                            <section key={street.properties.seq}>
                                <ListItem button onClick={() => props.zoomToSegment(street)}>
                                    <ListItemText
                                        primary={street.properties.street}
                                        primaryTypographyProps={{
                                            noWrap: true
                                        }}
                                        secondary={formatDistance(street.properties.distance)}
                                        className={classes.text}/>
                                </ListItem>
                                <Divider />
                            </section>

                        )
                    })
                    }
                </List>
                : null
            }
        </div>
    )
};