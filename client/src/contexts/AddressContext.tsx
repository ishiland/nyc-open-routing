import React, { createContext, useState, ReactNode } from "react";

import { geosupportToGeojson } from "../utils/formats";
// Import types from interfaces.ts
import { Address, AddressProperties, AddressContextType as SharedAddressContextType } from "../types/interfaces";

// Define the context type using the imported types
// Ensure this local definition matches the updated SharedAddressContextType
interface AddressContextType extends SharedAddressContextType {}

export const AddressContext = createContext<AddressContextType>({
    startAddress: {},
    endAddress: {},
    setAddress: () => { }, // This function expects AddressProperties now
    setAddressInput: () => { },
    startAddressInput: '',
    endAddressInput: '',
    clearAddresses: () => { },
    isInputEnabled: false,
    toggleEnabled: () => { },
});

interface AddressContextProviderProps {
    children: ReactNode;
}

function AddressContextProvider({ children }: AddressContextProviderProps) {

    // Use imported Address type for state
    const [startAddress, setStartAddress] = useState<Address>({});
    const [isInputEnabled, setInputEnabled] = useState<boolean>(false);
    const [startAddressInput, setStartAddressInput] = useState<string>('');
    const [endAddress, setEndAddress] = useState<Address>({});
    const [endAddressInput, setEndAddressInput] = useState<string>('');

    // Update function signature to use AddressProperties
    const setAddress = (selected: AddressProperties, type: 'Start' | 'End') => {
        const geojsonAddress = geosupportToGeojson(selected);
        if (type === 'Start') {
            setStartAddress(geojsonAddress);
            // Update input field as well for consistency
            setStartAddressInput(getAddressLabel(selected));
        } else if (type === 'End') {
            setEndAddress(geojsonAddress);
            // Update input field as well for consistency
            setEndAddressInput(getAddressLabel(selected));
        }
    };

    // Use the correct type for 'type'
    const setAddressInput = (value: string, type: 'Start' | 'End') => {
        if (type === 'Start') {
            setStartAddressInput(value)
        } else if (type === 'End') {
            setEndAddressInput(value)
        }
    };

    const clearAddresses = () => {
        setStartAddress({});
        setEndAddress({});
        setStartAddressInput('');
        setEndAddressInput('');
    };

    const toggleEnabled = () => {
        setInputEnabled(true)
    }

    // Need getAddressLabel helper
    const getAddressLabel = (suggestion: AddressProperties): string => {
        const parts: string[] = [];
        if (suggestion["House Number - Display Format"]) {
            parts.push(suggestion["House Number - Display Format"]);
        }
        if (suggestion["First Street Name Normalized"]) {
            parts.push(suggestion["First Street Name Normalized"]);
        }
        if (suggestion["First Borough Name"]) {
            parts.push(suggestion["First Borough Name"]);
        }
        return parts.join(' ');
    };


    return (
        <AddressContext.Provider
            value={{
                startAddress,
                endAddress,
                setAddress,
                setAddressInput,
                startAddressInput,
                endAddressInput,
                clearAddresses,
                isInputEnabled,
                toggleEnabled,
            }}
        >
            {children}
        </AddressContext.Provider>
    );
}

export default AddressContextProvider;
