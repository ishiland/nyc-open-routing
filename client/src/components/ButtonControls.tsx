import React, { useContext, useState, useEffect, useCallback } from "react";
import Button from "@mui/material/Button";
import { Directions } from "@mui/icons-material";
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

import { AddressContext } from '../contexts/AddressContext';
import { RouteContext } from '../contexts/RouteContext';
import { TravelModeContext } from '../contexts/TravelModeContext';
import { MessageContext } from '../contexts/MessageContext';
import { AddressContextType, RouteContextType, TravelModeContextType, MessageContextType } from "../types/interfaces";

export const ButtonControls: React.FC = () => {
    const [isFetching, setFetching] = useState<boolean>(false);

    const { clearAddresses, startAddress, endAddress } = useContext<AddressContextType>(AddressContext);

    const { setRoute } = useContext<RouteContextType>(RouteContext);

    const { displayMessage } = useContext<MessageContextType>(MessageContext);

    const { mode } = useContext<TravelModeContextType>(TravelModeContext);

    const routeButtonEnabled = startAddress.geometry && endAddress.geometry;

    const reset = (): void => {
        clearAddresses();
        setRoute({});
    };

    const fetchRouteCallback = useCallback(
        (): void => {
            setFetching(() => true);
            const startPointCoords = startAddress.geometry?.coordinates.toString() || '';
            const endPointCoords = endAddress.geometry?.coordinates.toString() || '';
            fetch(`/api/route?orig=${startPointCoords}&dest=${endPointCoords}&mode=${mode}`)
                .then(response => {
                    if (response.status >= 400) {
                        displayMessage(`${response.status}: ${response.statusText}`, 'error');
                        setFetching(() => false);
                        return null;
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && data.features && data.features.length) {
                        setRoute(data);
                    } else if (data && (!data.features || !data.features.length)) {
                        displayMessage('Could Not Calculate a Route', 'warning');
                    }
                    setFetching(() => false);
                });
        },
        [setFetching, setRoute, displayMessage, startAddress, endAddress, mode],
    );

    // execute route when mode changes
    useEffect(() => {
        if (routeButtonEnabled) {
            fetchRouteCallback();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, startAddress, endAddress, routeButtonEnabled]);

    return (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2, mb: 2 }}>
            <Button
                onClick={reset}
                variant="contained"
                disabled={isFetching}
            >
                clear
            </Button>
            <Button
                onClick={fetchRouteCallback}
                variant="contained"
                color="primary"
                disabled={isFetching || !routeButtonEnabled}
                startIcon={<Directions />}
            >
                Route
            </Button>
            {isFetching && <CircularProgress size={20} sx={{ ml: 1 }} />}
        </Box>
    );
}; 