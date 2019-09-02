import React, {useContext} from "react";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import Divider from "@material-ui/core/Divider";
import ListItemText from "@material-ui/core/ListItemText";
import {formatTotalRouteDistance, formatTotalRouteTime, formatDistance} from "../utils/formats"
import {RouteContext} from '../contexts/RouteContext';
import {useStyles} from '../utils/style'


export const RouteList = () => {
    const classes = useStyles();

    const {route, setSelectedStreet} = useContext(RouteContext);

    return (
        <div className={classes.routeListRoot}>

            {route.features && route.features.length ?
                <List
                    component="nav"
                    aria-labelledby="nested-list-subheader"
                    subheader={
                        <ListSubheader className={classes.subHeader}>
                            {formatTotalRouteDistance(route.features)} - {formatTotalRouteTime(route.features)}
                        </ListSubheader>
                    }
                    className={classes.routeListRoot}
                >
                    {route.features.map(street => {
                        return (
                            <section key={street.properties.seq}>
                                <ListItem button onClick={() => setSelectedStreet(street)}>
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