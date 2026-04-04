import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Driver sign-in / “Register as rider” (delivery rider → role driver in API).
 */
export function DriverLogin() {
  const navigate = useNavigate();
  const { login, register, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('signin');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let loggedInUser;
      if (tab === 'signin') {
        loggedInUser = await login(email, password, 'driver');
      } else {
        loggedInUser = await register(name, email, password, 'driver', { phone, vehicleType, licenseNumber });
      }
      // Use the returned user object directly — React state is async and `user` may not be set yet
      navigate(loggedInUser?.role === 'driver' ? '/driver/jobs' : '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`
        .d-input { width:100%; max-width:400px; padding:13px 16px; background:var(--input-background); border:1.5px solid var(--border); border-radius:12px; color:var(--foreground); font-size:0.95rem; outline:none; }
        .d-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(6,193,103,0.15); }
        .d-tab { flex:1; padding:10px; border-radius:10px; font-size:0.88rem; font-weight:600; cursor:pointer; border:none; background:transparent; color:var(--muted-foreground); }
        .d-tab.on { background:var(--primary); color:#fff; }
        .d-btn { width:100%; max-width:400px; padding:14px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; }
        .d-btn:disabled { opacity:0.7; cursor:not-allowed; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: 40, boxShadow: '0 24px 64px rgba(0,0,0,0.08)' }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem', marginBottom: 20, fontWeight: 600 }}>
          ← Rider sign in
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#06C167,#05AA5A)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Velocity drivers</h1>
        </div>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: 24 }}>
          Sign in to accept rides and parcel jobs. New delivery partner? Register as a driver below.
        </p>

        <div style={{ display: 'flex', background: 'var(--secondary)', borderRadius: 12, padding: 4, marginBottom: 22 }}>
          <button type="button" className={`d-tab${tab === 'signin' ? ' on' : ''}`} onClick={() => setTab('signin')}>Sign in</button>
          <button type="button" className={`d-tab${tab === 'signup' ? ' on' : ''}`} onClick={() => setTab('signup')}>Register as Driver</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch' }}>
          {tab === 'signup' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>Full name</label>
                <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>Phone</label>
                <input className="d-input" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="Your phone number" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>Vehicle Type</label>
                <select className="d-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} required style={{ WebkitAppearance: 'none', appearance: 'none', background: 'var(--input-background) url("data:image/svg+xml;utf8,<svg fill=\'%23999\' height=\'24\' viewBox=\'0 0 24 24\' width=\'24\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M7 10l5 5 5-5z\'/><path d=\'M0 0h24v24H0z\' fill=\'none\'/></svg>") no-repeat right 8px center' }}>
                  <option value="car">Car</option>
                  <option value="bike">Bike</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>License Number</label>
                <input className="d-input" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required placeholder="License / ID number" />
              </div>
            </>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>Email</label>
            <input className="d-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>Password</label>
            <input className="d-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          <button type="submit" className="d-btn" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'signin' ? 'Sign in as driver' : 'Create driver account'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
