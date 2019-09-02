import React, { createContext, useState } from "react";

export const RouteContext = createContext({});

function RouteContextProvider(props) {

    const [route, setRoute] = useState({});

    const [selectedStreet, setSelectedStreet] = useState({});

    return (
        <RouteContext.Provider
            value={{
                route,
                selectedStreet,
                setRoute: (route) => setRoute(route),
                setSelectedStreet: (selectedStreet) => setSelectedStreet(selectedStreet),
            }}
        >
            {props.children}
        </RouteContext.Provider>
    );

}
export default RouteContextProvider;
