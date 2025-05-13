import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock the fetch API
global.fetch = vi.fn();

// Create a helper function to setup fetch mock responses
export const mockFetch = (data: any, ok = true) => {
  (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => 
    Promise.resolve({
      ok,
      json: () => Promise.resolve(data),
    })
  );
};

// Helper to mock the response for navigation APIs that might not be available in test environment
export const mockNavigation = () => {
  // Mock window.navigator.geolocation
  const mockGeolocation = {
    getCurrentPosition: vi.fn().mockImplementation(success => 
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      })
    ),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
  
  Object.defineProperty(window.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
  });
  
  // Mock matchMedia which is used by some UI libraries
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

// Helper to reset all mocks between tests
export const resetMocks = () => {
  vi.clearAllMocks();
  (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  );
}; 