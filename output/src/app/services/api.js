/**
 * api.js — Real HTTP client for the Velocity API Gateway (http://localhost:3000)
 *
 * All calls inject the JWT access token stored in localStorage.
 * Functions mirror their mock predecessors for drop-in compatibility.
 */

const BASE_URL = 'http://localhost:3000/api';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('velocity_access_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    let msg = data.error || data.message;
    if (!msg && data.errors && data.errors.length > 0) {
      msg = data.errors[0].msg;
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data;
}

// ─── Auth API ──────────────────────────────────────────────────────────────────

export const authAPI = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /** @param {'user'|'driver'} [role] default 'user' */
  register: (name, email, password, role = 'user', extra = {}) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role, ...extra }),
    }),

  logout: (refreshToken) =>
    request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  refresh: (refreshToken) =>
    request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// ─── User API ──────────────────────────────────────────────────────────────────

export const userAPI = {
  getProfile: () => request('/users/me'),

  updateProfile: (data) =>
    request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getLocations: () => request('/users/me/locations'),

  addLocation: (label, address) =>
    request('/users/me/locations', {
      method: 'POST',
      body: JSON.stringify({ label, address }),
    }),

  deleteLocation: (locationId) =>
    request(`/users/me/locations/${locationId}`, { method: 'DELETE' }),
};

// ─── Ride API ──────────────────────────────────────────────────────────────────

export const rideAPI = {
  getEstimate: (from, to, type) =>
    request('/rides/estimate', {
      method: 'POST',
      body: JSON.stringify({ from, to, type }),
    }),

  bookRide: (from, to, type) =>
    request('/rides', {
      method: 'POST',
      body: JSON.stringify({ from, to, type }),
    }),

  getRideHistory: () => request('/rides'),

  getRide: (id) => request(`/rides/${id}`),

  cancelRide: (id) =>
    request(`/rides/${id}/cancel`, { method: 'PATCH' }),

  getDriverJobs: () => request('/rides/driver/jobs'),

  getDriverHistory: () => request('/rides/driver/history'),

  getDriverRideEarnings: () => request('/rides/driver/earnings-summary'),

  acceptRide: (id) =>
    request(`/rides/${id}/accept`, { method: 'POST' }),

  startRide: (id) =>
    request(`/rides/${id}/start`, { method: 'PATCH' }),

  completeRide: (id) =>
    request(`/rides/${id}/complete`, { method: 'PATCH' }),
};

// ─── Driver API ────────────────────────────────────────────────────────────────
export const driverAPI = {
  getProfile: () => request('/drivers/profile'),
  updateProfile: (data) => request('/drivers/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getDashboard: () => request('/drivers/dashboard'),
  getJobs: () => request('/drivers/jobs'),
  getHistory: () => request('/drivers/history'),
  
  acceptJob: (type, id) => request(`/drivers/jobs/${type}/${id}/accept`, { method: 'POST' }),
  startJob: (type, id) => request(`/drivers/jobs/${type}/${id}/start`, { method: 'PATCH' }),
  completeJob: (type, id) => request(`/drivers/jobs/${type}/${id}/complete`, { method: 'PATCH' }),
  cancelJob: (type, id) => request(`/drivers/jobs/${type}/${id}/cancel`, { method: 'PATCH' }),
};

// ─── Carpool API ───────────────────────────────────────────────────────────────

export const carpoolAPI = {
  listPools: () => request('/carpool/pools'),
  getPool: (poolId) => request(`/carpool/pools/${poolId}`),
  getMyActivePool: () => request('/carpool/pools/my-active'),
  getMyCarpoolHistory: () => request('/carpool/pools/history'),

  routeEstimate: (from, to, totalSeats) =>
    request('/carpool/route-estimate', {
      method: 'POST',
      body: JSON.stringify({
        from,
        to,
        totalSeats: totalSeats && totalSeats > 0 ? totalSeats : 1,
      }),
    }),

  createPool: (from, to, departureTime, totalSeats, farePerPerson) =>
    request('/carpool/pools', {
      method: 'POST',
      body: JSON.stringify({ from, to, departureTime, totalSeats, farePerPerson }),
    }),

  joinPool: (poolId) =>
    request(`/carpool/pools/${poolId}/join`, { method: 'POST' }),

  leavePool: (poolId) =>
    request(`/carpool/pools/${poolId}/leave`, { method: 'DELETE' }),

  deletePool: (poolId) =>
    request(`/carpool/pools/${poolId}`, { method: 'DELETE' }),

  cancelPool: (poolId) =>
    request(`/carpool/pools/${poolId}`, { method: 'DELETE' }),

  requestCarpoolDriver: (poolId) =>
    request(`/carpool/pools/${poolId}/request-driver`, { method: 'POST' }),
};

// ─── Parcel API ────────────────────────────────────────────────────────────────

export const parcelAPI = {
  getEstimate: (pickupAddress, dropoffAddress, weight) =>
    request('/parcel/estimate', {
      method: 'POST',
      body: JSON.stringify({ pickupAddress, dropoffAddress, weight }),
    }),

  book: (pickupAddress, dropoffAddress, weight, packageType) =>
    request('/parcel', {
      method: 'POST',
      body: JSON.stringify({ pickupAddress, dropoffAddress, weight, packageType }),
    }),

  listParcels: () => request('/parcel'),

  getParcel: (id) => request(`/parcel/${id}`),

  updateStatus: (id, status) =>
    request(`/parcel/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  listAvailableParcels: () => request('/parcel/available'),

  listDriverParcels: () => request('/parcel/driver/jobs'),

  getDriverHistory: () => request('/parcel/driver/history'),

  getDriverParcelEarnings: () => request('/parcel/driver/earnings-summary'),

  claimParcel: (id) =>
    request(`/parcel/${id}/claim`, { method: 'POST' }),
};

// ─── Notification API ──────────────────────────────────────────────────────────

export const notificationAPI = {
  getNotifications: () => request('/notifications'),

  markAsRead: (id) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    request('/notifications/read-all', { method: 'PATCH' }),
};

// ─── Subscription API ──────────────────────────────────────────────────────────

export const subscriptionAPI = {
  getPlans: () => request('/subscriptions/plans'),

  subscribe: (planId) =>
    request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),

  getMySubscription: () => request('/subscriptions/me'),

  cancel: () =>
    request('/subscriptions/me', { method: 'DELETE' }),
};
