import React, { useContext } from "react";
import List from "@mui/material/List";
import ListSubheader from "@mui/material/ListSubheader";
import ListItemButton from "@mui/material/ListItemButton";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import Box from '@mui/material/Box';
import { formatTotalRouteDistance, formatTotalRouteTime, formatDistance } from "../utils/formats";
import { RouteContext } from '../contexts/RouteContext';
import { RouteContextType, RouteFeature } from "../types/interfaces";

export const RouteList: React.FC = () => {
    const { route, setSelectedStreet } = useContext<RouteContextType>(RouteContext);

    return (
        <Box sx={{ width: '100%', bgcolor: 'background.paper', mt: 1 }}>
            {route.features && route.features.length ? (
                <List
                    component="nav"
                    aria-labelledby="nested-list-subheader"
                    subheader={
                        <ListSubheader component="div" id="nested-list-subheader" sx={{ bgcolor: 'inherit' }}>
                            {formatTotalRouteDistance(route.features)} - {formatTotalRouteTime(route.features)}
                        </ListSubheader>
                    }
                    dense
                >
                    {route.features.map((street: RouteFeature) => (
                        <React.Fragment key={street.properties.seq}>
                            <ListItemButton onClick={() => setSelectedStreet(street)}>
                                <ListItemText
                                    primary={street.properties.street}
                                    primaryTypographyProps={{
                                        noWrap: true,
                                        sx: { fontWeight: 'medium' }
                                    }}
                                    secondary={formatDistance(street.properties.distance)}
                                />
                            </ListItemButton>
                            <Divider component="li" />
                        </React.Fragment>
                    ))}
                </List>
            ) : null}
        </Box>
    );
}; 