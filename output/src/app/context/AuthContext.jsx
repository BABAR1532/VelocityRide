import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const STORAGE_TOKEN_KEY = 'velocity_access_token';
const STORAGE_REFRESH_KEY = 'velocity_refresh_token';
const STORAGE_USER_KEY = 'velocity_user';

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem(STORAGE_TOKEN_KEY) || null
  );
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const _persist = useCallback((aToken, rToken, u) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, aToken);
    localStorage.setItem(STORAGE_REFRESH_KEY, rToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
    setAccessToken(aToken);
    setUser(u);
  }, []);

  const login = useCallback(async (email, password, role = 'customer') => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    _persist(data.accessToken, data.refreshToken, data.user);
    return data.user;
  }, [_persist]);

  const register = useCallback(async (name, email, password, role = 'customer', extraData = {}) => {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, ...extraData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Registration failed');
    _persist(data.accessToken, data.refreshToken, data.user);
    return data.user;
  }, [_persist]);

  const logout = useCallback(async () => {
    const rToken = localStorage.getItem(STORAGE_REFRESH_KEY);
    try {
      await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rToken }),
      });
    } catch { /* ignore network errors */ }
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_REFRESH_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(accessToken);

  return (
    <AuthContext.Provider value={{ user, accessToken, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
