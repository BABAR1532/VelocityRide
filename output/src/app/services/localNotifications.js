const STORAGE_KEY = 'velocity_local_notifications';
const STORAGE_USER_KEY = 'velocity_user';

function getCurrentUserKey() {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    if (!user) return 'anonymous';
    return user._id || user.id || user.email || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addLocalNotification({ type = 'system', title, message, meta = {} }) {
  const items = readAll();
  const now = new Date().toISOString();
  items.push({
    _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userKey: getCurrentUserKey(),
    type,
    title,
    message,
    meta,
    read: false,
    createdAt: now,
    updatedAt: now,
    isLocal: true,
  });
  writeAll(items);
}

export function getLocalNotificationsForCurrentUser() {
  const userKey = getCurrentUserKey();
  return readAll()
    .filter((n) => n.userKey === userKey)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function markLocalAsRead(id) {
  const items = readAll().map((n) => (n._id === id ? { ...n, read: true, updatedAt: new Date().toISOString() } : n));
  writeAll(items);
}

export function markAllLocalAsReadForCurrentUser() {
  const userKey = getCurrentUserKey();
  const now = new Date().toISOString();
  const items = readAll().map((n) => (n.userKey === userKey ? { ...n, read: true, updatedAt: now } : n));
  writeAll(items);
}
