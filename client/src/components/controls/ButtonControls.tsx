import React, { useContext, useState, useEffect, useCallback } from "react";
import Button from "@mui/material/Button";
import { Directions } from "@mui/icons-material";
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

import { RoutingContext, RoutingContextType } from '../../contexts/RoutingContext';
import { MessageContext, MessageContextType } from '../../contexts/MessageContext';
import { useRouteFetch } from '../../hooks/useRouteFetch';

export const ButtonControls: React.FC = () => {
    const [isFetching, setIsFetching] = useState<boolean>(false);

    const {
        clearAddresses,
        startAddress,
        endAddress,
        setRoute,
        mode,
        route
    } = useContext<RoutingContextType>(RoutingContext);

    const { displayMessage } = useContext<MessageContextType>(MessageContext);

    const { fetchRoute: performFetchRoute } = useRouteFetch({
        startAddress,
        endAddress,
        mode,
        setRoute,
        displayMessage
    });

    const routeButtonEnabled = !!(startAddress?.geometry && endAddress?.geometry);

    const reset = (): void => {
        clearAddresses();
        setRoute(null);
    };

    const handleFetchRoute = useCallback(async () => {
        setIsFetching(true);
        try {
            await performFetchRoute();
        } catch (error) {
            console.error("Error calling performFetchRoute from ButtonControls:", error);
            displayMessage("Failed to calculate route due to an unexpected error.", "error");
        } finally {
            setIsFetching(false);
        }
    }, [performFetchRoute, displayMessage]);

    useEffect(() => {
        if (routeButtonEnabled) {
        }
    }, [mode, startAddress, endAddress, routeButtonEnabled, route]);

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
                onClick={handleFetchRoute}
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