'use strict';

/**
 * Shared route distance, duration, and fare helpers (Nominatim + Haversine).
 * Fares stored as USD in DB; UI shows INR at INR_PER_USD (default 100).
 * Base rule: car/carpool INR_PER_KM (default Rs 10/km); bike INR_PER_KM_BIKE (default Rs 5/km).
 *
 * Time: short trips use urban speeds; longer trips blend toward intercity cruise
 * (~50 km/h) so e.g. Chennai–Vellore (~140 km) lands near 2.5–3 hours.
 */

const INR_PER_USD = Number(process.env.INR_PER_USD || 100);
const INR_PER_KM = Number(process.env.INR_PER_KM || 10);
const INR_PER_KM_BIKE = Number(process.env.INR_PER_KM_BIKE || 5);
const USD_PER_KM = INR_PER_KM / INR_PER_USD;
const USD_PER_KM_BIKE = INR_PER_KM_BIKE / INR_PER_USD;

const ROAD_DISTANCE_FACTOR = Number(process.env.ROAD_DISTANCE_FACTOR || 1.25);
const TRAFFIC_FACTOR = Number(process.env.TRAFFIC_FACTOR || 1.15);

/** Urban / last-mile averages (km/h). */
const AVG_SPEED_KMPH_RIDE = { car: 28, bike: 24, carpool: 26 };
const AVG_SPEED_PARCEL_KMPH = Number(process.env.AVG_SPEED_PARCEL_KMPH || 22);

/**
 * Intercity cruise (km/h) — tuned so ~140–150 km ≈ 2.5–3 h (e.g. Chennai–Vellore).
 * 145 km at 52 km/h ≈ 2.8 h before a light traffic buffer.
 */
const INTERCITY_CRUISE_KMPH = {
  car: Number(process.env.INTERCITY_CRUISE_CAR || 52),
  bike: Number(process.env.INTERCITY_CRUISE_BIKE || 45),
  carpool: Number(process.env.INTERCITY_CRUISE_CARPOOL || 50),
  parcel: Number(process.env.INTERCITY_CRUISE_PARCEL || 48),
};

const INTERCITY_TRAFFIC = Number(process.env.INTERCITY_TRAFFIC || 1.04);
const INTERCITY_BLEND_START_KM = Number(process.env.INTERCITY_BLEND_START_KM || 35);
const INTERCITY_FULL_AT_KM = Number(process.env.INTERCITY_FULL_AT_KM || 85);

/** Light handling surcharge for heavy parcels (Rs per kg → USD). Default Rs 2/kg. */
const INR_PER_KG_PARCEL = Number(process.env.INR_PER_KG_PARCEL || 2);
const USD_PER_KG_PARCEL = INR_PER_KG_PARCEL / INR_PER_USD;

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

async function geocodeAddress(query, serviceLabel = 'Velocity') {
  const q = String(query || '').trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `${serviceLabel}/1.0` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      lat: Number(data[0].lat),
      lon: Number(data[0].lon),
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveDistanceKm(from, to, fallbackKm = 2) {
  try {
    const [a, b] = await Promise.all([geocodeAddress(from), geocodeAddress(to)]);
    if (a && b) {
      const km = haversineKm(a, b) * ROAD_DISTANCE_FACTOR;
      if (km > 0 && !Number.isNaN(km)) return km;
    }
  } catch (_) {
    /* fall through */
  }
  const fb = Number(fallbackKm);
  return fb > 0 ? fb : 2;
}

/**
 * @param {number} distanceKm
 * @param {'car'|'bike'|'carpool'} rideType car & carpool use INR_PER_KM; bike uses INR_PER_KM_BIKE
 */
function fareUsdFromDistanceKm(distanceKm, rideType = 'car') {
  const km = Number(distanceKm);
  const usdPerKm = rideType === 'bike' ? USD_PER_KM_BIKE : USD_PER_KM;
  return +(km * usdPerKm).toFixed(2);
}

function fareUsdParcel(distanceKm, weightKg) {
  const w = Math.max(0, Number(weightKg) || 0);
  return +((Number(distanceKm) * USD_PER_KM) + w * USD_PER_KG_PARCEL).toFixed(2);
}

/**
 * @param {number} distanceKm
 * @param {'car'|'bike'|'carpool'|'parcel'} rideType
 */
function durationMinutes(distanceKm, rideType = 'car') {
  const km = Number(distanceKm);
  if (!km || km <= 0) return 4;

  const urbanV =
    rideType === 'parcel'
      ? AVG_SPEED_PARCEL_KMPH
      : AVG_SPEED_KMPH_RIDE[rideType] || AVG_SPEED_KMPH_RIDE.car;
  const cruiseV = INTERCITY_CRUISE_KMPH[rideType] || INTERCITY_CRUISE_KMPH.car;

  let trafficUrban = TRAFFIC_FACTOR;
  if (km > 40) trafficUrban = 1.05;
  else if (km > 15) trafficUrban = 1.1;

  const urbanMins = (km / urbanV) * 60 * trafficUrban;
  const intercityMins = (km / cruiseV) * 60 * INTERCITY_TRAFFIC;

  if (km >= INTERCITY_FULL_AT_KM) {
    return Math.max(4, Math.round(intercityMins));
  }
  if (km <= INTERCITY_BLEND_START_KM) {
    return Math.max(4, Math.round(urbanMins));
  }
  const t = (km - INTERCITY_BLEND_START_KM) / (INTERCITY_FULL_AT_KM - INTERCITY_BLEND_START_KM);
  return Math.max(4, Math.round(urbanMins * (1 - t) + intercityMins * t));
}

function formatDistanceKm(distanceKm) {
  return `${Number(distanceKm).toFixed(1)} km`;
}

function formatDurationMin(min) {
  return `${min} min`;
}

async function estimateRide(from, to, type) {
  const distanceKm = await resolveDistanceKm(from, to, 2);
  const rideType = type === 'bike' || type === 'carpool' ? type : 'car';
  const durationMin = durationMinutes(distanceKm, rideType);
  return {
    fare: fareUsdFromDistanceKm(distanceKm, rideType),
    distance: formatDistanceKm(distanceKm),
    duration: formatDurationMin(durationMin),
    distanceKm,
    durationMin,
  };
}

async function estimateParcel(pickup, dropoff, weightKg) {
  const distanceKm = await resolveDistanceKm(pickup, dropoff, 2);
  const durationMin = durationMinutes(distanceKm, 'parcel');
  const fare = fareUsdParcel(distanceKm, weightKg);
  return {
    fare,
    distance: formatDistanceKm(distanceKm),
    estimatedTime: formatDurationMin(durationMin),
    distanceKm,
    durationMin,
  };
}

module.exports = {
  INR_PER_USD,
  INR_PER_KM,
  INR_PER_KM_BIKE,
  USD_PER_KM,
  USD_PER_KM_BIKE,
  ROAD_DISTANCE_FACTOR,
  TRAFFIC_FACTOR,
  AVG_SPEED_KMPH_RIDE,
  AVG_SPEED_PARCEL_KMPH,
  INTERCITY_CRUISE_KMPH,
  haversineKm,
  geocodeAddress,
  resolveDistanceKm,
  fareUsdFromDistanceKm,
  fareUsdParcel,
  durationMinutes,
  formatDistanceKm,
  formatDurationMin,
  estimateRide,
  estimateParcel,
};
