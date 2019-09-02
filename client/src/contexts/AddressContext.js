import React, { createContext, useState } from "react";

import { geosupportToGeojson } from "../utils/formats"

export const AddressContext = createContext();

function AddressContextProvider(props) {

    const [startAddress, setStartAddress] = useState({});

    const [isInputEnabled, setInputEnabled] = useState(false);

    const [startAddressInput, setStartAddressInput] = useState('');

    const [endAddress, setEndAddress] = useState({});

    const [endAddressInput, setEndAddressInput] = useState('');

    const setAddress = (selected, type) => {
        if (type === 'Start') {
            setStartAddress(geosupportToGeojson(selected))
        }
        else if (type === 'End') {
            setEndAddress(geosupportToGeojson(selected))
        }
    };

    const setAddressInput = (value, type) => {
        if (type === 'Start') {
            setStartAddressInput(value)
        }
        else if (type === 'End') {
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
            {props.children}
        </AddressContext.Provider>
    );

}
export default AddressContextProvider;
