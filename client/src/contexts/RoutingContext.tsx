import React, { createContext, useState, ReactNode, useCallback } from "react";
import { IMapFeature, Route, RouteFeature } from "../types/interfaces"; // Assuming these types exist
import { getAddressLabel } from "../utils/address"; // Assuming this utility exists

// Define TravelMode, can be moved to interfaces.ts later
export type TravelMode = 'drive' | 'walk' | 'bike';

export interface RoutingContextType {
  // Data state
  startAddress: IMapFeature | null;
  endAddress: IMapFeature | null;
  mode: TravelMode;
  route: Route | null;
  selectedStreet: RouteFeature | null;

  // UI state (related to routing inputs)
  startAddressInput: string;
  endAddressInput: string;
  isInputEnabled: boolean;

  // Data state modifiers
  setAddress: (address: IMapFeature, type: 'start' | 'end') => void;
  setMode: (mode: TravelMode) => void;
  setRoute: (route: Route | null) => void;
  setSelectedStreet: (street: RouteFeature | null) => void;

  // UI state modifiers
  setAddressInput: (value: string, type: 'start' | 'end') => void;
  clearAddresses: () => void;
  enableAddressInputs: () => void; // Renamed from toggleEnabled for clarity
}

export const RoutingContext = createContext<RoutingContextType>({
  startAddress: null,
  endAddress: null,
  mode: 'drive',
  route: null,
  selectedStreet: null,
  startAddressInput: '',
  endAddressInput: '',
  isInputEnabled: true,
  setAddress: () => {},
  setMode: () => {},
  setRoute: () => {},
  setSelectedStreet: () => {},
  setAddressInput: () => {},
  clearAddresses: () => {},
  enableAddressInputs: () => {},
});

interface RoutingContextProviderProps {
  children: ReactNode;
}

export function RoutingContextProvider({ children }: RoutingContextProviderProps) {
  const [startAddress, setStartAddressState] = useState<IMapFeature | null>(null);
  const [endAddress, setEndAddressState] = useState<IMapFeature | null>(null);
  const [mode, setModeState] = useState<TravelMode>('drive');
  const [route, setRouteState] = useState<Route | null>(null);
  const [selectedStreet, setSelectedStreetState] = useState<RouteFeature | null>(null);

  const [startAddressInput, setStartAddressInputState] = useState<string>('');
  const [endAddressInput, setEndAddressInputState] = useState<string>('');
  const [isInputEnabled, setIsInputEnabledState] = useState<boolean>(true);

  const setAddress = useCallback((selected: IMapFeature, type: 'start' | 'end') => {
    const rawLabel = selected.properties?.label || getAddressLabel(selected.properties as any);
    const label = String(rawLabel || '');

    if (type === 'start') {
      let isDifferent = true;
      if (startAddress && startAddress.geometry.type === 'Point' && selected.geometry.type === 'Point') {
        isDifferent = startAddress?.properties?.label !== label ||
          JSON.stringify(startAddress.geometry.coordinates) !== JSON.stringify(selected.geometry.coordinates);
      } else if (startAddress) {
        // Fallback to label comparison if not both are points or startAddress is null
        isDifferent = startAddress?.properties?.label !== label;
      }

      if (isDifferent) {
        setStartAddressState(selected);
      }
      setStartAddressInputState(label); // Always update input state
    } else {
      let isDifferent = true;
      if (endAddress && endAddress.geometry.type === 'Point' && selected.geometry.type === 'Point') {
        isDifferent = endAddress?.properties?.label !== label ||
          JSON.stringify(endAddress.geometry.coordinates) !== JSON.stringify(selected.geometry.coordinates);
      } else if (endAddress) {
        // Fallback to label comparison if not both are points or endAddress is null
        isDifferent = endAddress?.properties?.label !== label;
      }

      if (isDifferent) {
        setEndAddressState(selected);
      }
      setEndAddressInputState(label); // Always update input state
    }
  }, [startAddress, endAddress]);

  const setMode = useCallback((newMode: TravelMode) => {
    setModeState(newMode);
  }, []);

  const setRoute = useCallback((newRoute: Route | null) => {
    setRouteState(newRoute);
  }, []);

  const setSelectedStreet = useCallback((newSelectedStreet: RouteFeature | null) => {
    setSelectedStreetState(newSelectedStreet);
  }, []);

  const setAddressInput = useCallback((value: string, type: 'start' | 'end') => {
    if (type === 'start') {
      setStartAddressInputState(value);
    } else {
      setEndAddressInputState(value);
    }
  }, []);

  const clearAddresses = useCallback(() => {
    setStartAddressState(null);
    setEndAddressState(null);
    setStartAddressInputState('');
    setEndAddressInputState('');
  }, []);

  const enableAddressInputs = useCallback(() => {
    setIsInputEnabledState(true);
  }, []);

  return (
    <RoutingContext.Provider
      value={{
        startAddress,
        endAddress,
        mode,
        route,
        selectedStreet,
        startAddressInput,
        endAddressInput,
        isInputEnabled,
        setAddress,
        setMode,
        setRoute,
        setSelectedStreet,
        setAddressInput,
        clearAddresses,
        enableAddressInputs,
      }}
    >
      {children}
    </RoutingContext.Provider>
  );
}

export default RoutingContextProvider; 