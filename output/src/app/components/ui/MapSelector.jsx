import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet markers in React
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: iconMarker,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function bearingBetween(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Helper component to auto-pan and zoom the map
function MapBounds({ pickupCoords, dropoffCoords }) {
  const map = useMap();
  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      const bounds = L.latLngBounds([pickupCoords, dropoffCoords]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickupCoords) {
      map.setView(pickupCoords, 14);
    } else if (dropoffCoords) {
      map.setView(dropoffCoords, 14);
    }
  }, [map, pickupCoords, dropoffCoords]);
  return null;
}

export function MapSelector({ pickup, dropoff, height = '300px' }) {
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);

  const geocode = async (address) => {
    if (!address) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    } catch {
      // Ignore network failures for geocoding
    }
    return null;
  };

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (pickup && pickup.length > 3) {
        const coords = await geocode(pickup);
        setPickupCoords(coords);
      } else {
        setPickupCoords(null);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [pickup]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (dropoff && dropoff.length > 3) {
        const coords = await geocode(dropoff);
        setDropoffCoords(coords);
      } else {
        setDropoffCoords(null);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [dropoff]);

  // Default to a generic location if nothing set (e.g., center of USA/Europe)
  const defaultCenter = [40.7128, -74.0060]; // NYC
  const hasRoute = pickupCoords && dropoffCoords;
  const midPoint = hasRoute
    ? [
        (pickupCoords[0] + dropoffCoords[0]) / 2,
        (pickupCoords[1] + dropoffCoords[1]) / 2,
      ]
    : null;

  const routeBearing = hasRoute
    ? bearingBetween(pickupCoords[0], pickupCoords[1], dropoffCoords[0], dropoffCoords[1])
    : 0;

  const startRot = hasRoute ? routeBearing - 90 : -45;
  const endRot = hasRoute ? routeBearing + 90 : 135;

  const startArrowIcon = useMemo(
    () =>
      L.divIcon({
        className: 'velocity-map-start-pin',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#06C167;color:#fff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:18px;font-weight:800;line-height:1;transform:rotate(${startRot}deg)">↑</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    [startRot],
  );

  const endArrowIcon = useMemo(
    () =>
      L.divIcon({
        className: 'velocity-map-end-pin',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#fff;color:#06C167;border:3px solid #06C167;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:18px;font-weight:800;line-height:1;transform:rotate(${endRot}deg)">↑</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    [endRot],
  );

  const midArrowIcon = useMemo(
    () =>
      L.divIcon({
        className: 'velocity-map-route-mid-arrow',
        html: `<div style="transform:rotate(${routeBearing}deg);font-size:22px;line-height:22px;color:#06C167;font-weight:800;text-shadow:0 0 3px #fff,0 0 6px #fff,0 1px 2px rgba(0,0,0,.45);">→</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    [routeBearing],
  );

  return (
    <div style={{ height, width: '100%', borderRadius: '1rem', overflow: 'hidden', position: 'relative', zIndex: 0 }}>
      <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Polyline first so endpoint markers & arrows stack above (Leaflet paint order). */}
        {hasRoute && (
          <Polyline
            positions={[pickupCoords, dropoffCoords]}
            pathOptions={{ color: '#06C167', weight: 4, opacity: 0.88 }}
          />
        )}
        {hasRoute && (
          <Marker position={midPoint} icon={midArrowIcon} zIndexOffset={800}>
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              Route direction
            </Tooltip>
          </Marker>
        )}
        {pickupCoords && (
          <Marker position={pickupCoords} icon={startArrowIcon} zIndexOffset={1000}>
            <Popup>Pickup: {pickup}</Popup>
          </Marker>
        )}
        {dropoffCoords && (
          <Marker position={dropoffCoords} icon={endArrowIcon} zIndexOffset={1000}>
            <Popup>Dropoff: {dropoff}</Popup>
          </Marker>
        )}
        <MapBounds pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} />
      </MapContainer>
    </div>
  );
}
