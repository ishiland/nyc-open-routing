import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import maplibregl from 'maplibre-gl';
import { IMapFeature, Route, RouteFeature } from '../types/interfaces';
import { RoutingContext, RoutingContextType } from './RoutingContext'; // Import RoutingContext

// Define the shape of the Map context
interface MapContextType {
  // Map instance
  map: maplibregl.Map | null;
  setMap: (map: maplibregl.Map) => void;
  
  // Consumed from RoutingContext
  startAddress: IMapFeature | null; 
  endAddress: IMapFeature | null;
  startAddressInput: string;
  endAddressInput: string;
  isInputEnabled: boolean; // Changed from enableInputs
  setAddress: (address: IMapFeature, type: 'start' | 'end') => void;
  setAddressInput: (input: string, type: 'start' | 'end') => void;
  enableAddressInputs: () => void; // Changed from toggleEnabled
  
  route: Route | null;
  selectedStreet: RouteFeature | null; // Type changed from IMapFeature
  setRoute: (route: Route | null) => void;
  setSelectedStreet: (street: RouteFeature | null) => void; // Type changed
  
  // Features for zooming, derived in MapContext
  allFeatures: IMapFeature[];
}

// Create context with default empty values, matching the new type
export const MapContext = createContext<MapContextType>({
  map: null,
  setMap: () => {},
  startAddress: null,
  endAddress: null,
  startAddressInput: '',
  endAddressInput: '',
  isInputEnabled: false, // Changed from enableInputs
  setAddress: () => {},
  setAddressInput: () => {},
  enableAddressInputs: () => {}, // Changed from toggleEnabled
  route: null,
  selectedStreet: null,
  setRoute: () => {},
  setSelectedStreet: () => {},
  allFeatures: []
});

interface MapProviderProps {
  children: ReactNode;
}

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  // Map specific state
  const [map, setMapState] = useState<maplibregl.Map | null>(null);

  // Consume RoutingContext
  const {
    startAddress,
    endAddress,
    startAddressInput,
    endAddressInput,
    isInputEnabled,
    setAddress,
    setAddressInput,
    enableAddressInputs,
    route,
    selectedStreet,
    setRoute,
    setSelectedStreet
  } = useContext(RoutingContext);
  
  // Combined features for zooming, using data from RoutingContext
  // Assuming RouteFeature is compatible with IMapFeature (e.g., can be cast or is a subtype)
  const allFeatures: IMapFeature[] = [
    ...(startAddress ? [startAddress] : []),
    ...(endAddress ? [endAddress] : []),
    ...(selectedStreet ? [selectedStreet as IMapFeature] : []), // Added cast for selectedStreet
    ...(route?.features as IMapFeature[] || [])
  ].filter(f => f && f.geometry);
  
  // Map instance setter callback
  const setMap = useCallback((mapInstance: maplibregl.Map) => {
    setMapState(mapInstance);
  }, []);
  
  return (
    <MapContext.Provider
      value={{
        map,
        setMap,
        // Pass through from RoutingContext
        startAddress,
        endAddress,
        startAddressInput,
        endAddressInput,
        isInputEnabled,
        setAddress,
        setAddressInput,
        enableAddressInputs,
        route,
        selectedStreet,
        setRoute,
        setSelectedStreet,
        allFeatures // Derived in MapContext
      }}
    >
      {children}
    </MapContext.Provider>
  );
}; 