import { SxProps, Theme } from '@mui/material/styles';

/**
 * Common styles for reuse across components
 */
export const commonStyles = {
  // Container styles
  fullHeight: {
    height: '100vh',
  },
  
  mapContainer: {
    height: '100vh',
    flex: 1,
    position: 'relative',
  },
  
  // Box styles
  panel: {
    padding: 2,
    borderRadius: 1,
    backgroundColor: 'background.paper',
    boxShadow: 2,
  },
  
  overlay: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 999,
    padding: 2,
    borderRadius: 1,
  },
  
  // Form elements
  formGroup: {
    margin: '10px 0',
  },
  
  // Suggestion dropdown
  suggestionItem: {
    fontSize: '14px',
    zIndex: 101,
  },
  
  // Highlighted text
  highlightText: {
    fontWeight: 600,
  },
};

type PositionProps = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

/**
 * Function to position overlay elements
 */
export const overlayPosition = (
  position: 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft',
  spacing = 10
): SxProps<Theme> => {
  const positions: Record<string, PositionProps> = {
    topRight: {
      top: spacing,
      right: spacing,
    },
    topLeft: {
      top: spacing,
      left: spacing,
    },
    bottomRight: {
      bottom: spacing,
      right: spacing,
    },
    bottomLeft: {
      bottom: spacing,
      left: spacing,
    },
  };
  
  return {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 999,
    padding: 2,
    borderRadius: 1,
    ...positions[position],
  };
}; 