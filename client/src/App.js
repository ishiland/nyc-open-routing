import React from "react";
import extent from "turf-extent";
import {featureCollection} from "@turf/helpers";
import "mapbox-gl/dist/mapbox-gl.css";
import {Panel} from "./components/Panel";
import Search from "./components/Search";
import {RouteList} from "./components/RouteList";
import {ButtonControls} from "./components/ButtonControls";
import Message from "./components/Message";

import {GEOSEARCH_API_REVERSE} from './config'

const mapboxgl = require('mapbox-gl');

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

const initialState = {
    lng: -73.978159,
    lat: 40.759975,
    zoom: 12,
    startPoint: [],
    startInputHasFocus: false,
    endPoint: [],
    endInputHasFocus: false,
    routeLine: [],
    isFetching: false,
    mode: 'drive',
    messageText: '',
    messageLevel: 'success',
    messageOpen: false
};

class App extends React.Component {

    constructor(props) {
        super(props);
        this.state = initialState;

        this.toggleStartInputFocus = this.toggleStartInputFocus.bind(this);
        this.toggleEndInputFocus = this.toggleEndInputFocus.bind(this);
        this.fetchRoute = this.fetchRoute.bind(this);
    }

    componentDidMount() {
        const {lng, lat, zoom} = this.state;

        this.map = new mapboxgl.Map({
            container: this.mapContainer,
            style: 'mapbox://styles/mapbox/streets-v9',
            center: [lng, lat],
            zoom
        });

        const {startInputHasFocus, endInputHasFocus} = this.state;

        // reverse geocode
        this.map.on('click', (evt) => {
            if (startInputHasFocus) {
                this.reverseGeocode(evt.lngLat)
            }
            else if (endInputHasFocus) {
                this.reverseGeocode(evt.lngLat)
            }
            this.setState({startInputHasFocus: false, endInputHasFocus: false});
        });

        const nav = new mapboxgl.NavigationControl();
        this.map.addControl(nav, 'bottom-right');
    }


    setRoute = data => {

        this.setState({
            isFetching: false,
            routeLine: data.features,
        }, () => {

            const {routeLine} = this.state;

            const mapLayerID = `routeLayer`;
            const mapSourceID = `routeSource`;
            const mapLayer = this.map.getLayer(mapLayerID);
            if (typeof mapLayer === 'undefined') {
                this.map.addSource(mapSourceID, {
                    type: 'geojson',
                    data: {
                        type: "FeatureCollection",
                        features: routeLine
                    }
                });
                this.map.addLayer({
                    id: mapLayerID,
                    type: 'line',
                    source: `routeSource`,
                    paint: {
                        "line-width": 5,
                        "line-color": "#007cbf",
                    }
                }, 'road-label-small');
            }
            else {
                this.map.getSource(mapSourceID).setData({
                    type: "FeatureCollection",
                    features: routeLine
                })
            }
            this.zoomToExtent(routeLine);
            if (!routeLine.length) {
                this.setMessage('Could Not Calculate a Route', 'warning');
            }
        })
    };

    setMessage = (messageText, messageLevel) => {
        this.setState({
            messageText,
            messageLevel,
            messageOpen: true,
            isFetching: false
        });
    };

    setPoint = (position, data) => {

        const {startPoint, endPoint} = this.state;

        const mapLayerID = `${position}PointLayer`;
        const mapSourceID = `${position}PointSource`;
        const mapLayer = this.map.getLayer(mapLayerID);
        if (typeof mapLayer === 'undefined') {
            this.map.addSource(mapSourceID, {
                type: 'geojson',
                data
            });
            this.map.addLayer({
                id: mapLayerID,
                type: 'circle',
                source: `${position}PointSource`,
                "paint": {
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "white",
                    "circle-radius": 8,
                    "circle-blur": 0.15,
                    "circle-color": position === 'start' ? 'green' : 'red'
                },
            });
        }

        else {
            this.map.getSource(mapSourceID).setData(data)
        }

        if (startPoint.geometry && endPoint.geometry) {
            this.fetchRoute();
        }

        this.zoomToExtent([
            startPoint.geometry && startPoint,
            endPoint.geometry && endPoint,
        ])
    };

    removeLayerandSource = (layer, source) => {
        const l = this.map.getLayer(layer);
        if (typeof l !== 'undefined') this.map.removeLayer(layer);
        const s = this.map.getSource(source);
        if (typeof s !== 'undefined') this.map.removeSource(source);
    };

    resetMap = () => {
        this.removeLayerandSource('startPointLayer', 'startPointSource');
        this.removeLayerandSource('endPointLayer', 'endPointSource');
        this.removeLayerandSource('routeLayer', 'routeSource');

        this.setState(initialState);
        const {center, zoom} = initialState;
        this.map.flyTo({center, zoom});
    };

    setStartLocation = (evt, val) => {
        this.setState({
            startPoint: val.suggestion
        }, () => {
            this.setPoint('start', val.suggestion);
        })
    };

    setEndLocation = (evt, val) => {
        this.setState({
            endPoint: val.suggestion
        }, () => {
            this.setPoint('end', val.suggestion);
        })
    };

    onModeChange = (mode) => {

        const {startPoint, endPoint} = this.state;

        this.setState({mode}, () => {
            if (startPoint.geometry && endPoint.geometry) this.fetchRoute()
        })
    };

    zoomToSegment = (street) => {
        this.zoomToExtent([street]);
    };

    closeMessage = () => {
        this.setState({messageOpen: false})
    };

    reverseGeocode = (lngLat) => {
        // TODO: populate search with reverse geocode result
        // https://github.com/pelias/documentation/blob/master/reverse.md
        fetch(`${GEOSEARCH_API_REVERSE}point.lat=${lngLat.lat}&point.lon=${lngLat.lng}`)
            .then(response => {
                return response.json();
            })
            .then(data => {
                console.log('reverse geocoded', data); // eslint-disable-line no-console
            });
    };

    toggleEndInputFocus(val) {
        this.setState({endInputHasFocus: val, startInputHasFocus: !val})
    }

    toggleStartInputFocus(val) {
        this.setState({startInputHasFocus: val, endInputHasFocus: !val})
    }

    fetchRoute() {


        this.setState({
            isFetching: true
        }, () => {

            const {startPoint, endPoint, mode} = this.state;

            // Use Geosearch API to get suggestions
            const startPointCoords = startPoint.geometry.coordinates.toString();
            const endPointCoords = endPoint.geometry.coordinates.toString();

            fetch(`/api/route?orig=${startPointCoords}&dest=${endPointCoords}&mode=${mode}`)
                .then(response => {
                    if (response.status >= 400) {
                        this.setMessage(`${response.status}: ${response.statusText}`, 'error');
                        return null;
                    }
                    return response.json();

                })
                .then(data => {
                    if (data && data.features) this.setRoute(data)
                });
        })
    }

    zoomToExtent(geom) {
        const features = geom.filter(item => item); // remove undefined and empty items
        if (features.length) {
            if (features.length === 1 && features[0].geometry.type === 'Point') {
                // center on single point
                this.map.flyTo({
                    center: features[0].geometry.coordinates,
                    zoom: 14
                });
            }
            else {
                // zoom to bounds of updated features on map
                this.map.fitBounds(extent(featureCollection(features)), {
                    padding: 50 // {top:100, left:325, bottom:100, right:100},
                });
            }
        }
    }

    render() {
        const {
            isFetching,
            mode,
            routeLine,
            setSuggestions,
            messageText,
            messageLevel,
            messageOpen,
            endPoint,
            startPoint
        } = this.state;

        return (
            <section>

                {/* SideBar */}
                <Panel
                    mode={mode}
                    onModeChange={this.onModeChange}
                >
                    <Search
                        type="Start"
                        setSuggestions={setSuggestions}
                        onLocationSelect={this.setStartLocation}
                        toggleFocus={this.toggleStartInputFocus}
                    />
                    <Search
                        type="End"
                        onLocationSelect={this.setEndLocation}
                        toggleFocus={this.toggleEndInputFocus}
                    />
                    <ButtonControls
                        onReset={this.resetMap}
                        isFetching={isFetching}
                        onRouteButtonClick={this.fetchRoute}
                        routeButtonDisabled={!startPoint.geometry || !endPoint.geometry}
                    />
                    <RouteList
                        zoomToSegment={this.zoomToSegment}
                        route={routeLine}
                    />
                </Panel>

                {/* Error Handling Messages */}
                <Message
                    isOpen={messageOpen}
                    handleClose={this.closeMessage}
                    text={messageText}
                    level={messageLevel}
                />

                {/* Map Container */}
                <div ref={(el) => { this.mapContainer = el }}
                     style={{
                         height: '100vh',
                         width: 'calc(100vw - 330px)',
                         marginLeft: '330px'
                     }}/>
            </section>
        );
    }
}

export default App;