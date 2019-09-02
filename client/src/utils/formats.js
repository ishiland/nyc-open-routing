export const formatDistance = (feet) => {
    let distance = '';
    if (feet > 1000) {
        distance = `${(feet / 5260).toFixed(1)} mi`;
    } else {
        distance = `${Math.floor(feet)} ft`
    }
    return distance;
};

export const formatTotalRouteTime = (routes) => {
    let time = '';
    const minutes = routes.map(x => x.properties.travel_time).reduce((a, c) => a + c);
    if (minutes > 60) {
        const quotient = Math.floor(minutes / 60);
        const remainder = Math.floor(minutes % 60);
        time = `${quotient} hr ${remainder} min`
    } else {
        time = `${Math.floor(minutes)} min`
    }
    return time;
};


export const formatTotalRouteDistance = (routes) => {
    const feet = routes.map(x => x.properties.distance).reduce((a, c) => a + c);
    return formatDistance(feet)
};


export const geosupportToGeojson = (data) => {
    return {
        "type": "Feature",
        "properties": data,
        "geometry": {
            "type": "Point",
            "coordinates": [
                parseFloat(data.Longitude),
                parseFloat(data.Latitude)
            ]
        }
    }

};