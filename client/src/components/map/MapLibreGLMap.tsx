// MapLibreGLMap.tsx
import React from "react";
import MapContainer from "./MapContainer";

/**
 * Main Map component that renders the MapLibreGL map
 * This is now just a thin wrapper around the refactored components
 */
const MapLibreGLMap: React.FC = () => {
  return <MapContainer />;
};

export default MapLibreGLMap;
