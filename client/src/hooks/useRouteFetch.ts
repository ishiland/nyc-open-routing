import { useCallback } from 'react';
import { IMapFeature, Route } from '../types/interfaces';
import { TravelMode } from '../contexts/RoutingContext';
import { MessageContextType } from '../contexts/MessageContext';
import { Point } from 'geojson'; // Assuming GeoJSON types are used

interface UseRouteFetchArgs {
  startAddress: IMapFeature | null;
  endAddress: IMapFeature | null;
  mode: TravelMode;
  setRoute: (route: Route | null) => void;
  displayMessage: MessageContextType['displayMessage'];
}

export const useRouteFetch = ({
  startAddress,
  endAddress,
  mode,
  setRoute,
  displayMessage,
}: UseRouteFetchArgs) => {
  const fetchRouteCallback = useCallback(async () => {
    if (!startAddress || !endAddress) {
      displayMessage("Please select start and end addresses.", "warning");
      return;
    }

    const startGeom = startAddress.geometry as Point;
    const endGeom = endAddress.geometry as Point;

    if (startGeom?.type !== 'Point' || endGeom?.type !== 'Point' || !startGeom.coordinates || !endGeom.coordinates) {
      displayMessage("Invalid address geometry. Start and end must be Points with coordinates.", "error");
      return;
    }

    const startCoords = Array.isArray(startGeom.coordinates) ? startGeom.coordinates.join(',') : '';
    const endCoords = Array.isArray(endGeom.coordinates) ? endGeom.coordinates.join(',') : '';

    if (!startCoords || !endCoords) {
        displayMessage("Invalid address coordinates string.", "error");
        return;
    }

    try {
      const response = await fetch(`/api/route?orig=${startCoords}&dest=${endCoords}&mode=${mode}`);
      if (!response.ok) {
        // Try to get error message from response body, otherwise use statusText
        let errorText = response.statusText;
        try {
            const errorData = await response.json();
            if (errorData && errorData.message) {
                errorText = errorData.message;
            }
        } catch (e) {
            // Ignore if response is not json or doesn't have message
        }
        throw new Error(errorText);
      }
      const data: Route = await response.json();
      if (data.features && data.features.length > 0) {
        setRoute(data);
      } else {
        setRoute(null);
        displayMessage("Could not calculate a route. No features returned.", "warning");
      }
    } catch (error) {
      setRoute(null);
      const errorMessage = error instanceof Error ? error.message : String(error);
      displayMessage(`Error fetching route: ${errorMessage}`, "error");
    }
  }, [startAddress, endAddress, mode, setRoute, displayMessage]);

  return { fetchRoute: fetchRouteCallback };
}; 