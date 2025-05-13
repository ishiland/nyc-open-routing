import maplibregl from 'maplibre-gl';

// Debug mode flag
const DEBUG = process.env.NODE_ENV !== 'production';

/**
 * Utility functions for conditional logging
 */
export const logger = {
  log: (message: string, ...args: any[]): void => {
    if (DEBUG) {
      console.log(message, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]): void => {
    // Always show warnings in development, but only critical ones in production
    console.warn(message, ...args);
  },
  
  error: (message: string, ...args: any[]): void => {
    // Always show errors
    console.error(message, ...args);
  }
};


/**
 * Safely removes a layer and its source from the map
 * @param map The MapLibre map instance
 * @param layerId The ID of the layer to remove
 * @param sourceId The ID of the source to remove
 * @returns boolean indicating if the operation was successful
 */
export const removeMapLayerAndSource = (
  map: maplibregl.Map,
  layerId: string,
  sourceId: string
): boolean => {
  if (!map || !map.loaded()) return false;
  
  try {
    // First remove the layer if it exists
    if (map.getStyle() && map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    
    // Then remove the source if it exists
    if (map.getStyle() && map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error removing layer ${layerId} or source ${sourceId}:`, error);
    return false;
  }
}; 