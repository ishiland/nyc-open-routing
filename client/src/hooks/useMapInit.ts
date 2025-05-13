// useMapInit.ts

import { useEffect, RefObject, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { logger } from '../utils/mapHelpers';

const NYC_STYLE_URL = "https://layers-api.planninglabs.nyc/v1/base/style.json";
const STYLE_LOAD_TIMEOUT = 30000; // 30 seconds
const DEBUG = process.env.NODE_ENV === 'development';

// Helper for conditional logging
const log = (message: string, ...args: any[]) => {
  if (DEBUG) {
    console.log(message, ...args);
  }
};

interface UseMapInitOptions {
  initialCenter?: [number, number];
  initialZoom?: number;
  onMapLoad?: () => void;
}

/**
 * Custom hook to initialize and manage a MapLibre GL map instance
 */
const useMapInit = (
  containerRef: RefObject<HTMLDivElement>,
  {
    initialCenter = [-73.978159, 40.759975],
    initialZoom = 10,
    onMapLoad
  }: UseMapInitOptions = {}
): maplibregl.Map | null => {
  // Use ref instead of state to avoid re-renders
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleLoadTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!containerRef.current) return;
    
    let mapInstance: maplibregl.Map | null = null;
    
    // Define handlers with refs so we can properly clean them up
    const handleResize = () => {
      if (mapInstance) {
        mapInstance.resize();
      }
    };
    
    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'resize' && mapInstance) {
        logger.log('Resize triggered by parent window');
        mapInstance.resize();
      }
    };

    try {
      logger.log("Initializing map...");
      
      // Check if container is visible and has dimensions
      const container = containerRef.current;
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      logger.log(`Container dimensions: ${containerWidth}x${containerHeight}`);
      
      if (containerWidth === 0 || containerHeight === 0) {
        logger.warn("Map container has zero width or height!");
      }
      
      // Check if app is running in an iframe
      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        logger.log("Application is running inside an iframe");
      }

      // Initialize the map with a cachebuster for the style URL
      const mapOptions: maplibregl.MapOptions = {
        container: containerRef.current,
        style: `${NYC_STYLE_URL}?t=${Date.now()}`,
        center: initialCenter,
        zoom: initialZoom,
      };
      
      // TypeScript doesn't know about preserveDrawingBuffer but it's a valid MapLibre option
      (mapOptions as any).preserveDrawingBuffer = true;
      
      mapInstance = new maplibregl.Map(mapOptions);
      mapRef.current = mapInstance;
      
      // Add custom transform request handler
      mapInstance.setTransformRequest((url, resourceType) => {
        // Add cachebuster to tile requests
        if ((resourceType === 'Tile' || resourceType === 'Source' || resourceType === 'Glyphs' || resourceType === 'SpriteJSON' || resourceType === 'SpriteImage') && 
            url.includes('planninglabs.nyc')) {
          logger.log(`Requesting resource: ${resourceType} - ${url}`);
          return {
            url: url // Now relying only on style URL cachebuster
          };
        }
        return { url };
      });

      // Set a timeout to log a warning if style takes too long to load
      styleLoadTimeoutRef.current = setTimeout(() => {
        if (mapInstance) {
          logger.warn("Style load taking longer than expected (30s)");
        }
      }, STYLE_LOAD_TIMEOUT);

      // Wait for the map to be fully loaded and rendered
      mapInstance.once('idle', () => {
        logger.log('All style layers and tiles are in place');
        if (styleLoadTimeoutRef.current) {
          clearTimeout(styleLoadTimeoutRef.current);
        }
        
        if (onMapLoad) {
          onMapLoad();
        }
        
        // Force a resize to ensure the map renders correctly
        setTimeout(() => {
          mapInstance?.resize();
        }, 100);
      });

      // Handle errors
      mapInstance.on("error", (e) => {
        logger.error("Map error:", e.error);
      });
      
      // Add window resize handler to ensure the map stays responsive
      window.addEventListener('resize', handleResize);
      
      // For iframes, listen to parent window messages
      if (isInIframe) {
        window.addEventListener('message', handleMessage);
      }
    } catch (error) {
      logger.error("Error initializing map:", error);
    }
    
    // Return cleanup function
    return () => {
      // Always clean up timeout
      if (styleLoadTimeoutRef.current) {
        clearTimeout(styleLoadTimeoutRef.current);
      }
      
      // Clean up event listeners with proper references
      window.removeEventListener('resize', handleResize);
      
      // Check for iframe state before removing message listener
      if (window.self !== window.top) {
        window.removeEventListener('message', handleMessage);
      }
      
      // Clean up map instance
      if (mapInstance) {
        mapInstance.remove();
        mapRef.current = null;
      }
    };
  }, [containerRef, initialCenter, initialZoom, onMapLoad]);

  return mapRef.current;
};

export default useMapInit; 