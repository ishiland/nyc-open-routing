import { useContext } from 'react';
import { MapContext } from '../contexts/MapContext';

/**
 * Hook to easily access the MapContext
 */
const useMapContext = () => {
  const context = useContext(MapContext);
  
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  
  return context;
};

export default useMapContext; 