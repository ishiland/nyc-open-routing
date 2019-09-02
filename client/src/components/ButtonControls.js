import React, { useContext, useState, useEffect, useCallback } from "react";
import Button from "@material-ui/core/Button";
import { Directions } from "@material-ui/icons";
import CircularProgress from '@material-ui/core/CircularProgress';

import {useStyles} from '../utils/style'
import { AddressContext } from '../contexts/AddressContext';
import { RouteContext } from '../contexts/RouteContext';
import { TravelModeContext } from '../contexts/TravelModeContext';
import { MessageContext } from '../contexts/MessageContext';


export const ButtonControls = () => {
    const classes = useStyles();

    const [isFetching, setFetching] = useState(false);

    const { clearAddresses, startAddress, endAddress } = useContext(AddressContext);

    const { setRoute } = useContext(RouteContext);

    const { displayMessage } = useContext(MessageContext);

    const { mode } = useContext(TravelModeContext);

    const routeButtonEnabled = startAddress.geometry && endAddress.geometry;

    const reset = () => {
        clearAddresses();
        setRoute({})
    };


    const fetchRouteCallback = useCallback(
        () => {
            setFetching(()=>true);
            const startPointCoords = startAddress.geometry.coordinates.toString();
            const endPointCoords = endAddress.geometry.coordinates.toString();
            fetch(`/api/route?orig=${startPointCoords}&dest=${endPointCoords}&mode=${mode}`)
                .then(response => {
                    if (response.status >= 400) {
                        displayMessage(()=>`${response.status}: ${response.statusText}`, 'error');
                        setFetching(()=>false);
                        return null;
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && data.features.length) {
                        setRoute(data);
                    } else if (data && !data.features.length) {
                        displayMessage('Could Not Calculate a Route', 'warning');
                    }
                    setFetching(()=>false);
                });
        },
        [setFetching, setRoute, displayMessage, startAddress, endAddress, mode],
    );

    // execute route when mode changes
    useEffect(() => {
        if (routeButtonEnabled) {
            fetchRouteCallback()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, startAddress, endAddress, routeButtonEnabled]);

    return (
        <div>
            <Button
                onClick={reset}
                variant="contained"
                disabled={isFetching}
                className={classes.button}>
                clear
            </Button>
            <Button
                onClick={fetchRouteCallback}
                variant="contained"
                color="primary"
                disabled={isFetching || !routeButtonEnabled}
                className={classes.button}
            >
                <Directions className={classes.buttonIcon} />Route
            </Button>
            {isFetching && <CircularProgress className={classes.progress} size={20} />}
        </div>
    )
};