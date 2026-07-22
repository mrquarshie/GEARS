import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// Component to handle map centering when a mechanic is selected
function MapCenterer({ center, userLocation, mapPanTrigger }) {
  const map = useMap();
  
  // Center on mechanic selection
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, { animate: true });
    }
  }, [center, map]);

  // Center on user location when requested (or initial load)
  useEffect(() => {
    if (mapPanTrigger > 0 && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { animate: true });
    }
  }, [mapPanTrigger, userLocation, map]);

  return null;
}

const UserLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div class="pulse"></div><div class="dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export default function MapLayout({ mechanics, selectedMechanic, onSelectMechanic, userLocation, mapPanTrigger }) {
  // Default to Accra center
  const defaultCenter = [5.6037, -0.1870];
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  useEffect(() => {
    if (selectedMechanic && selectedMechanic.lat && selectedMechanic.lng) {
      setMapCenter([selectedMechanic.lat, selectedMechanic.lng]);
    }
  }, [selectedMechanic]);

  return (
    <div className="map-container-wrapper">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: '100vh', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapCenterer center={mapCenter} userLocation={userLocation} mapPanTrigger={mapPanTrigger} />

        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]} 
            icon={UserLocationIcon}
            zIndexOffset={1000}
          />
        )}

        {mechanics.map((m) => {
          // If mechanic lacks coordinates, we temporarily map them around Accra center
          // using a simple hash of their name just for demo purposes if needed, 
          // but ideally we only map those with lat/lng
          const lat = m.lat || (5.6037 + (Math.random() - 0.5) * 0.05);
          const lng = m.lng || (-0.1870 + (Math.random() - 0.5) * 0.05);
          
          return (
            <Marker 
              key={m.id} 
              position={[lat, lng]}
              eventHandlers={{
                click: () => onSelectMechanic(m),
              }}
            >
              <Popup>
                <strong>{m.name}</strong><br />
                {m.area}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
