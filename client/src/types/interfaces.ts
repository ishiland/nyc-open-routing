// ./src/types/interfaces.ts
import React from 'react';

// Address related interfaces
export interface GeoPoint {
  type: string;
  coordinates: number[];
}

// A generic interface for GeoJSON features.
export interface IMapFeature extends GeoJSON.Feature<GeoJSON.Geometry, any> {}

// An interface for route data, which contains an optional array of features.
export interface IRouteData {
  features?: IMapFeature[];
}

export interface AddressProperties {
  [key: string]: any;
  "House Number - Display Format"?: string;
  "First Street Name Normalized"?: string;
  "First Borough Name"?: string;
  Latitude?: string;
  Longitude?: string;
}

export interface Address {
  type?: string;
  properties?: AddressProperties;
  geometry?: GeoPoint;
}

export interface AddressContextType {
  startAddress: Address;
  endAddress: Address;
  setAddress: (selected: AddressProperties, type: 'Start' | 'End') => void;
  setAddressInput: (value: string, type: 'Start' | 'End') => void;
  startAddressInput: string;
  endAddressInput: string;
  clearAddresses: () => void;
  isInputEnabled: boolean;
  toggleEnabled: () => void;
}

// Route related interfaces
export interface RouteProperties {
  seq: number;
  street: string;
  distance: number;
  travel_time: number;
  [key: string]: any;
}

export interface RouteFeature {
  type: "Feature";
  properties: RouteProperties;
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
}

export interface Route {
  features?: RouteFeature[];
  [key: string]: any;
}

export interface RouteContextType {
  route: Route;
  selectedStreet: RouteFeature;
  setRoute: (route: Route) => void;
  setSelectedStreet: (selectedStreet: RouteFeature) => void;
}

// Travel mode related interfaces
export type TravelMode = 'drive' | 'bike' | 'walk';

export interface TravelModeContextType {
  mode: TravelMode;
  setMode: (event: React.ChangeEvent<{}>, value: TravelMode) => void;
}

// Message related interfaces
export type MessageLevel = 'success' | 'warning' | 'error' | 'info';

export interface MessageContextType {
  messageText: string;
  messageLevel: MessageLevel;
  messageOpen: boolean;
  displayMessage: (msg: string, level?: MessageLevel) => void;
  closeMessage: () => void;
}

// Component props interfaces
export interface ControlsContainerProps {
  children: React.ReactNode;
}

export interface SearchProps {
  type: 'Start' | 'End';
}

export interface MySnackbarContentWrapperProps {
  className?: string;
  message: string;
  onClose: () => void;
  variant: MessageLevel;
} 