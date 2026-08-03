import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in leaflet with React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Category glyphs (Phosphor "Wrench"/"GasPump" regular-weight paths; detailer glyph matches Sidebar's CarDetailingIcon)
const CATEGORY_GLYPH = {
  mechanic: '<svg viewBox="0 0 256 256" fill="white"><path d="M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z"/></svg>',
  fuel: '<svg viewBox="0 0 256 256" fill="white"><path d="M241,69.66,221.66,50.34a8,8,0,0,0-11.32,11.32L229.66,81A8,8,0,0,1,232,86.63V168a8,8,0,0,1-16,0V128a24,24,0,0,0-24-24H176V56a24,24,0,0,0-24-24H72A24,24,0,0,0,48,56V208H32a8,8,0,0,0,0,16H192a8,8,0,0,0,0-16H176V120h16a8,8,0,0,1,8,8v40a24,24,0,0,0,48,0V86.63A23.85,23.85,0,0,0,241,69.66ZM64,208V56a8,8,0,0,1,8-8h80a8,8,0,0,1,8,8V208Zm80-96a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h48A8,8,0,0,1,144,112Z"/></svg>',
  detailer: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16h2a2 2 0 0 0 4 0h2v-4c0-1.5-1-3-2-4H5L2 12v4z"/><circle cx="6" cy="16" r="1.5" fill="white"/><path d="M22 16h-2a2 2 0 0 1-4 0h-2v-4c0-1.5 1-3 2-4h3l3 4v4z"/><circle cx="18" cy="16" r="1.5" fill="white"/><path d="M12 3 l-1.5 2.5 l-2.5 -1.5 l 1.5 3 l-3 1 l 3 1.5 l-1 3 l 2.5 -2 l 2 2.5 l1.5-3 l3-1.5 l-3-1 l1-2.5 l-2.5 1.5 z" fill="white" stroke="none"/></svg>',
  parts: '<svg viewBox="0 0 256 256" fill="white"><path d="M232,96.09V208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V96.09a8,8,0,0,1,1.37-4.47l32-48A8,8,0,0,1,64,40H192a8,8,0,0,1,6.66,3.62l32,48A8,8,0,0,1,232,96.09ZM80,112a32,32,0,0,0,48,27.71A32,32,0,0,0,176,112H80Zm-34.05-8H74.7l13.33-48H68.28Zm46.09,0h71.92L150.63,56H105.37Zm89.26,0h28.75L187.72,56H168Zm34.7,16H192.8a47.84,47.84,0,0,1-9.6,24H216ZM40,120v24H72.8a47.84,47.84,0,0,1-9.6-24Zm0,80H216V160H40Z"/></svg>',
};

function getMechanicCategory(specialty) {
  if (specialty === 'Car Detailing') return 'detailer';
  if (specialty === 'Fuel Station') return 'fuel';
  if (
    specialty === 'Shop' ||
    specialty === 'Parts Shop' ||
    specialty === 'Auto Parts' ||
    specialty === 'Car Parts'
  ) return 'parts';
  return 'mechanic';
}

const DEFAULT_LONGITUDE = -0.1870;
const DEFAULT_LATITUDE = 5.6037;
const DEFAULT_ZOOM = 15.95;
const MAX_MAP_ZOOM = 20;
const SELECT_ZOOM = 16;
const ROUTE_MAX_ZOOM = 16;
const TRANSITION_DURATION = 300;

function getCoordinate(value) {
  const coordinate = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(coordinate) ? coordinate : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Memoized cache for marker icons — avoids recreating L.divIcon on every render
const iconCache = new Map();
function getCategoryIcon(mechanic, selected = false) {
  const key = `${mechanic.id}-${selected}`;
  if (iconCache.has(key)) return iconCache.get(key);

  const category = getMechanicCategory(mechanic.specialty);
  const glyph = CATEGORY_GLYPH[category] || CATEGORY_GLYPH.mechanic;
  const name = escapeHtml(mechanic.name || 'Gears');
  const selectedClass = selected ? ' category-marker-card--selected' : '';

  const divIcon = L.divIcon({
    className: 'category-marker-icon',
    html: `
      <div class="category-marker-card category-marker-card--${category}${selectedClass}">
        <div class="category-marker-head">
          <div class="category-marker-avatar">${glyph}</div>
        </div>
        <div class="category-marker-dot"></div>
        <div class="category-marker-label">${name}</div>
      </div>
    `,
    iconSize: [190, 82],
    iconAnchor: [95, 48],
    popupAnchor: [0, -50],
  });

  iconCache.set(key, divIcon);
  return divIcon;
}

// Clear stale entries from the icon cache to prevent memory leaks
function pruneIconCache(activeIds) {
  const idSet = new Set(activeIds);
  for (const key of iconCache.keys()) {
    const id = key.split('-')[0];
    if (!idSet.has(id)) iconCache.delete(key);
  }
}

// Component to handle map centering when a mechanic is selected
function MapCenterer({ center, userLocation, mapPanTrigger, routeActive }) {
  const map = useMap();

  useEffect(() => {
    if (center && !routeActive) {
      map.flyTo(center, SELECT_ZOOM, { animate: true, duration: TRANSITION_DURATION / 1000 });
    }
  }, [center, map, routeActive]);

  useEffect(() => {
    if (mapPanTrigger > 0 && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], DEFAULT_ZOOM, { animate: true, duration: TRANSITION_DURATION / 1000 });
    }
  }, [mapPanTrigger, userLocation, map]);

  return null;
}

function RouteFitter({ userLocation, routeTarget, routePath }) {
  const map = useMap();

  useEffect(() => {
    if (!userLocation || !routeTarget) return;
    const bounds = routePath && routePath.length > 0
      ? routePath
      : [[userLocation.lat, userLocation.lng], [routeTarget.lat, routeTarget.lng]];
    map.flyToBounds(bounds, { padding: [80, 80], duration: TRANSITION_DURATION / 1000, maxZoom: ROUTE_MAX_ZOOM });
  }, [userLocation, routeTarget, routePath, map]);

  return null;
}

function MapZoomStyler() {
  const map = useMap();

  useEffect(() => {
    const updateMarkerScale = () => {
      const zoom = map.getZoom();
      const scale = Math.min(1.24, Math.max(0.84, 0.9 + (zoom - 14) * 0.055));
      map.getContainer().style.setProperty('--map-marker-scale', scale.toFixed(2));
    };

    updateMarkerScale();
    map.on('zoomend', updateMarkerScale);
    return () => map.off('zoomend', updateMarkerScale);
  }, [map]);

  return null;
}

const UserLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div class="pulse"></div><div class="dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Radar-style scanning rings shown while "Use my location" is searching for nearby
// mechanics — mirrors the ripple effect ride-hailing apps use while finding drivers.
const UserLocationScanningIcon = L.divIcon({
  className: 'user-location-marker user-location-marker--scanning',
  html: '<div class="radar-ring radar-ring-1"></div><div class="radar-ring radar-ring-2"></div><div class="radar-ring radar-ring-3"></div><div class="pulse"></div><div class="dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// We use a single CARTO Voyager tile layer (with labels) instead of two separate
// layers (nolabels + only_labels), halving the tile requests.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_SUBDOMAINS = 'abcd';
const TILE_ATTRIBUTION = '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function MapLayout({ mechanics, selectedMechanic, onSelectMechanic, userLocation, mapPanTrigger, routeTarget, isLocatingScan }) {
  const defaultCenter = [DEFAULT_LATITUDE, DEFAULT_LONGITUDE];
  const [mapCenter, setMapCenter] = useState(null);
  const [routePath, setRoutePath] = useState(null);

  const mappedMechanics = useMemo(
    () => mechanics
      .map((m) => ({
        ...m,
        lat: getCoordinate(m.lat),
        lng: getCoordinate(m.lng),
      }))
      .filter((m) => m.lat !== null && m.lng !== null),
    [mechanics],
  );

  // Prune icon cache when mechanic set changes
  useEffect(() => {
    pruneIconCache(mappedMechanics.map((m) => m.id));
  }, [mappedMechanics]);

  useEffect(() => {
    const lat = getCoordinate(selectedMechanic?.lat);
    const lng = getCoordinate(selectedMechanic?.lng);
    if (lat !== null && lng !== null) {
      setMapCenter([lat, lng]);
    }
  }, [selectedMechanic]);

  // Fetch the real road-network path between the user and the route target.
  // Debounced: only fires if userLocation + routeTarget stay stable for 150ms,
  // preventing rapid-fire API calls during map interaction.
  useEffect(() => {
    if (!userLocation || !routeTarget) {
      setRoutePath(null);
      return;
    }

    let cancelled = false;
    // Debounce — wait 150ms of stability before fetching
    const timer = setTimeout(() => {
      if (cancelled) return;
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${routeTarget.lng},${routeTarget.lat}?overview=full&geometries=geojson`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const coords = data?.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length > 0) {
            setRoutePath(coords.map(([lng, lat]) => [lat, lng]));
          } else {
            setRoutePath(null);
          }
        })
        .catch(() => {
          if (!cancelled) setRoutePath(null);
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userLocation, routeTarget]);

  // Memoize the marker elements to avoid recreating the array on every render
  const markerElements = useMemo(() =>
    mappedMechanics.map((m) => (
      <Marker
        key={m.id}
        position={[m.lat, m.lng]}
        icon={getCategoryIcon(m, selectedMechanic?.id === m.id)}
        zIndexOffset={selectedMechanic?.id === m.id ? 500 : 0}
        eventHandlers={{
          click: () => onSelectMechanic(m),
        }}
      >
        <Popup>
          <strong>{m.name}</strong><br />
          {m.area}
        </Popup>
      </Marker>
    )),
    [mappedMechanics, selectedMechanic?.id, onSelectMechanic],
  );

  const routeLinePositions = useMemo(() => {
    if (!userLocation || !routeTarget) return null;
    return routePath && routePath.length > 0
      ? routePath
      : [[userLocation.lat, userLocation.lng], [routeTarget.lat, routeTarget.lng]];
  }, [userLocation, routeTarget, routePath]);

  return (
    <div className="map-container-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={DEFAULT_ZOOM}
        maxZoom={MAX_MAP_ZOOM}
        minZoom={12}
        style={{ height: '100vh', width: '100%', zIndex: 0 }}
        zoomControl={false}
        wheelDebounceTime={80}
        zoomSnap={0.5}
        fadeAnimation={true}
        zoomAnimation={true}
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
          subdomains={TILE_SUBDOMAINS}
          maxNativeZoom={18}
          maxZoom={MAX_MAP_ZOOM}
          updateWhenZooming={false}
          updateWhenIdle={true}
          updateInterval={200}
          keepBuffer={2}
        />

        <MapCenterer center={mapCenter} userLocation={userLocation} mapPanTrigger={mapPanTrigger} routeActive={!!routeTarget} />
        <MapZoomStyler />
        <RouteFitter userLocation={userLocation} routeTarget={routeTarget} routePath={routePath} />

        {routeLinePositions && (
          <Polyline
            positions={routeLinePositions}
            pathOptions={{ color: '#155e42', weight: 4, opacity: 0.85, lineCap: 'round' }}
          />
        )}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={isLocatingScan ? UserLocationScanningIcon : UserLocationIcon}
            zIndexOffset={1000}
          />
        )}

        {markerElements}
      </MapContainer>
    </div>
  );
}
