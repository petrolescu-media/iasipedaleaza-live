// Initialize the map
var map = L.map('map', {
    zoomControl: false
});

map.locate({ 
    setView: false, 
    watch: true, 
    maxZoom: 16, 
    timeout: 60000,  // 60 seconds
    maximumAge: 300000,  // 5 minutes
    enableHighAccuracy: true 
});


L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

var routeLayer;
var markers = [];
var userMarker;
var userCircle;
var initialLocationFound = false;

// Custom icons
var stopIcon = L.icon({
    iconUrl: 'https://i.imgur.com/FMNRVUV.png', // Replace with the path to your bus stop icon image
    iconSize: [40, 40], // Size of the icon
    iconAnchor: [20, 41], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -41] // Point from which the popup should open relative to the iconAnchor
});

var userIcon = L.icon({
    iconUrl: 'https://i.imgur.com/Y1N7ofp.png', // Replace with the path to your user location icon image
    iconSize: [40, 40], // Size of the icon
    iconAnchor: [12, 41], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -41] // Point from which the popup should open relative to the iconAnchor
});

// Function to clear existing routes and markers
function clearMap() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function showRoute(routeId) {
    clearMap();
    if (!routes[routeId]) return;

    var route = routes[routeId];
    routeLayer = L.polyline(route.points, { color: route.color, weight: 7 }).addTo(map); // Set weight to desired thickness
    route.stops.forEach(stop => {
        var marker = L.marker(stop.coords, { icon: stopIcon }).addTo(map).bindPopup(stop.name);
        markers.push(marker);
    });

    findAndShowNearestStation(routeId);
}


// Function to find nearest station on selected route and calculate bike time
function findAndShowNearestStation(routeId) {
    if (!routes[routeId]) return;
    navigator.geolocation.getCurrentPosition(function(position) {
        var userLat = position.coords.latitude;
        var userLon = position.coords.longitude;
        var nearestStop = null;
        var minDistance = Infinity;

        routes[routeId].stops.forEach(stop => {
            var distance = calculateDistance(userLat, userLon, stop.coords[0], stop.coords[1]);
            if (distance < minDistance) {
                minDistance = distance;
                nearestStop = stop;
            }
        });

        if (nearestStop) {
            document.getElementById('station-name').textContent = nearestStop.name;
            var bikeTime = calculateBikeTime(minDistance);
            document.getElementById('arrival-time-clock').textContent = bikeTime + ' minutes';
        }
    }, function(error) {
        console.error('Error getting user location:', error);
    }, {
        enableHighAccuracy: true,
        timeout: 20000, // Increased timeout for better mobile performance
        maximumAge: 0
    });
}

// Function to calculate distance between two coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the Earth in kilometers
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var distance = R * c; // Distance in kilometers
    return distance;
}

// Convert degrees to radians
function toRad(value) {
    return value * Math.PI / 180;
}

// Function to calculate bike time in minutes
function calculateBikeTime(distance) {
    var speed = 10; // Average biking speed in km/h
    var time = (distance / speed) * 60; // Time in minutes
    return Math.round(time);
}

// Event listener for route selection
document.getElementById('route-select').addEventListener('change', function() {
    var routeId = this.value;
    showRoute(routeId);
});

function findNearestRoutes(lat, lon) {
    var nearbyRoutes = [];
    var foundRoutes = {}; // track routes that have already been found
    Object.keys(routes).forEach(routeId => {
        var route = routes[routeId];
        route.stops.forEach(stop => {
            var distance = calculateDistance(lat, lon, stop.coords[0], stop.coords[1]);
            if (distance < 0.500) { // Approximately 500m
                if (!foundRoutes[routeId]) { // check if route hasn't been found before
                    nearbyRoutes.push(routeId);
                    foundRoutes[routeId] = true; // mark route as found
                }
            }
        });
    });
    return nearbyRoutes;
}

// Function to show nearby routes
function showNearbyRoutes(nearbyRoutes) {
    var container = document.getElementById('nearby-lines');
    container.innerHTML = '';
    nearbyRoutes.forEach(routeId => {
        var route = routes[routeId];
        var link = document.createElement('a');
        link.href = "#";
        link.className = "track_number_v2 tram color";
        link.style.backgroundColor = route.color;
        link.textContent = routeId;
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showRoute(routeId);
        });
        container.appendChild(link);
    });
}

function onLocationFound(e) {
    var radius = e.accuracy / 2;
    if (!userMarker) {
        userMarker = L.marker(e.latlng, { icon: userIcon }).addTo(map);
    } else {
        userMarker.setLatLng(e.latlng);
    }
    if (!userCircle) {
        userCircle = L.circle(e.latlng, radius).addTo(map);
    } else {
        userCircle.setLatLng(e.latlng).setRadius(radius);
    }

    if (centerOnUser || !initialLocationFound) {
        map.setView(e.latlng, 16);
        initialLocationFound = true;
    }

    var nearbyRoutes = findNearestRoutes(e.latlng.lat, e.latlng.lng);
    showNearbyRoutes(nearbyRoutes);
    var selectedRouteId = document.getElementById('route-select').value;
    if (selectedRouteId) {
        findAndShowNearestStation(selectedRouteId);
    }
}

document.getElementById('center-toggle').addEventListener('click', toggleCenterOnUser);

map.on('locationfound', onLocationFound);
map.locate({ setView: false, watch: true, maxZoom: 16 });

function onLocationError(e) {
    console.error('Geolocation error: ' + e.message);
    alert('Geolocation error: ' + e.message);
}
map.on('locationerror', onLocationError);

var centerOnUser = false;

function toggleCenterOnUser() {
    centerOnUser = !centerOnUser;
    var button = document.getElementById('center-toggle');
    if (centerOnUser) {
        button.textContent = 'Disable';
        if (userMarker) {
            map.setView(userMarker.getLatLng(), 16);
        }
    } else {
        button.textContent = 'Center';
    }
}

