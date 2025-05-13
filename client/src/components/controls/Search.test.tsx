import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Search from './Search';
import { RoutingContext, RoutingContextType } from '../../contexts/RoutingContext';

// Mock the fetch API
global.fetch = vi.fn();

// Mock context values
const mockContextValue: RoutingContextType = {
  startAddress: null,
  endAddress: null,
  mode: 'drive',
  route: null,
  selectedStreet: null,
  setAddress: vi.fn(),
  setAddressInput: vi.fn(),
  startAddressInput: '',
  endAddressInput: '',
  clearAddresses: vi.fn(),
  isInputEnabled: true,
  enableAddressInputs: vi.fn(),
  setMode: vi.fn(),
  setRoute: vi.fn(),
  setSelectedStreet: vi.fn(),
};

const renderSearch = (type: 'Start' | 'End', contextOverrides = {}) => {
  const contextValue = { ...mockContextValue, ...contextOverrides };
  return render(
    <RoutingContext.Provider value={contextValue}>
      <Search type={type} />
    </RoutingContext.Provider>
  );
};

describe('Search Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation for fetch
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ features: [] }),
      })
    );
  });

  it('renders with placeholder text', () => {
    renderSearch('Start');
    expect(screen.getByPlaceholderText('Type an address')).toBeInTheDocument();
  });

  it('is disabled when isInputEnabled is false', () => {
    renderSearch('Start', { isInputEnabled: false });
    expect(screen.getByPlaceholderText('Type an address')).toBeDisabled();
  });

  it('updates input value correctly for Start type', async () => {
    renderSearch('Start');
    const input = screen.getByPlaceholderText('Type an address');
    
    await userEvent.type(input, 'Broadway');
    
    expect(mockContextValue.setAddressInput).toHaveBeenCalledWith('Broadway', 'Start');
  });

  it('updates input value correctly for End type', async () => {
    renderSearch('End');
    const input = screen.getByPlaceholderText('Type an address');
    
    await userEvent.type(input, 'Times Square');
    
    expect(mockContextValue.setAddressInput).toHaveBeenCalledWith('Times Square', 'End');
  });

  it('fetches suggestions when input has at least 3 characters', async () => {
    renderSearch('Start');
    const input = screen.getByPlaceholderText('Type an address');
    
    await userEvent.type(input, 'Br');
    expect(global.fetch).not.toHaveBeenCalled();
    
    await userEvent.type(input, 'o');
    expect(global.fetch).toHaveBeenCalledWith('/api/search?address=Bro');
  });

  it('displays suggestions when returned from the API', async () => {
    // Mock suggestions from API in GeoSearch format
    const mockSuggestions = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-74.003238, 40.710148]
          },
          properties: {
            id: "7555",
            name: "100 GOLD STREET",
            housenumber: "100",
            street: "GOLD STREET",
            borough: "Manhattan",
            label: "100 GOLD STREET, Manhattan, NY, USA"
          }
        }
      ]
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      })
    );

    renderSearch('Start');
    const input = screen.getByPlaceholderText('Type an address');
    
    await userEvent.type(input, 'Gold Street');

    // Wait for suggestions to appear
    await waitFor(() => {
      expect(screen.getByText('100 GOLD STREET, Manhattan, NY, USA')).toBeInTheDocument();
    });
  });

  it('selects suggestion and sets address when clicked', async () => {
    // Mock suggestions from API in GeoSearch format
    const mockSuggestion = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-74.003238, 40.710148]
      },
      properties: {
        id: "7555",
        name: "100 GOLD STREET",
        housenumber: "100",
        street: "GOLD STREET",
        borough: "Manhattan",
        label: "100 GOLD STREET, Manhattan, NY, USA"
      }
    };

    const mockSuggestions = {
      type: "FeatureCollection",
      features: [mockSuggestion]
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      })
    );

    renderSearch('Start');
    const input = screen.getByPlaceholderText('Type an address');
    
    await userEvent.type(input, 'Gold Street');

    // Wait for suggestions to appear
    await waitFor(() => {
      expect(screen.getByText('100 GOLD STREET, Manhattan, NY, USA')).toBeInTheDocument();
    });

    // Click on the suggestion
    fireEvent.mouseDown(screen.getByText('100 GOLD STREET, Manhattan, NY, USA'));

    // Verify setAddress was called with the correct data
    expect(mockContextValue.setAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-74.003238, 40.710148]
        },
        properties: mockSuggestion.properties
      }),
      'Start'
    );
  });
}); 