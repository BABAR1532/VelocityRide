
import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Car, Bike, Users, Package, Star, Shield, Clock, MapPin,
  ArrowRight, ChevronRight, Zap, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const services = [
  { icon: Car, title: 'Car Ride', desc: 'Premium rides at your doorstep in minutes. Comfort meets convenience.', tag: 'Most Popular', color: '#06C167' },
  { icon: Bike, title: 'Bike Ride', desc: 'Beat the traffic. Quick, eco-friendly rides for short distances.', tag: 'Eco', color: '#0EA5E9' },
  { icon: Users, title: 'Carpool', desc: 'Share rides, split fares, reduce emissions. Smarter commuting.', tag: 'Save 60%', color: '#8B5CF6' },
  { icon: Package, title: 'Parcel Delivery', desc: 'Send packages across the city, tracked in real-time.', tag: 'Fast', color: '#F59E0B' },
];

const stats = [
  { value: '2M+', label: 'Happy Riders' },
  { value: '50K+', label: 'Expert Drivers' },
  { value: '99.2%', label: 'On-time Rate' },
  { value: '120+', label: 'Cities Covered' },
];

const features = [
  { icon: Shield, text: 'Insurance covered every ride' },
  { icon: Clock, text: 'Average 3-min pickup time' },
  { icon: MapPin, text: 'Live GPS tracking' },
  { icon: Star, text: '4.9★ average driver rating' },
];

const whyCards = [
  { icon: '⚡', title: 'Instant Booking', desc: 'Confirm your ride in under 10 seconds.' },
  { icon: '🔒', title: 'Safe Rides', desc: 'All drivers background-verified.' },
  { icon: '💳', title: 'Cashless', desc: 'Pay securely with any method.' },
  { icon: '📍', title: 'Live Tracking', desc: 'Know exactly where your ride is.' },
];

export function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('signin');
  const [hoveredService, setHoveredService] = useState(null);
  const [hoveredWhy, setHoveredWhy] = useState(null);
  const [loginHighlight, setLoginHighlight] = useState(false);
  const loginRef = useRef(null);

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setLoginHighlight(true);
    setTimeout(() => setLoginHighlight(false), 1800);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (activeTab === 'signin') {
        await login(email, password, 'customer');
      } else {
        await register(name, email, password, 'customer');
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-family)' }}>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .v-input { width:100%; padding:13px 16px; background:var(--input-background); border:1.5px solid var(--border); border-radius:12px; color:var(--foreground); font-size:0.95rem; outline:none; transition:border-color 0.2s,box-shadow 0.2s; font-family:var(--font-family); }
        .v-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(6,193,103,0.15); }
        .v-input::placeholder { color:var(--muted-foreground); }
        .v-primary-btn { width:100%; padding:14px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:var(--font-family); display:flex; align-items:center; justify-content:center; gap:8px; }
        .v-primary-btn:hover:not(:disabled) { background:#05AA5A; transform:translateY(-1px); box-shadow:0 8px 20px rgba(6,193,103,0.35); }
        .v-primary-btn:disabled { opacity:0.7; cursor:not-allowed; }
        .v-tab { flex:1; padding:10px; border-radius:10px; font-size:0.88rem; font-weight:600; cursor:pointer; transition:all 0.2s; border:none; background:transparent; color:var(--muted-foreground); font-family:var(--font-family); }
        .v-tab.active { background:var(--primary); color:#fff; box-shadow:0 4px 12px rgba(6,193,103,0.3); }
        .v-bold { font-weight:700; }
      `}</style>

      {/* Navbar */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 48px', borderBottom:'1px solid var(--border)', background:'var(--background)', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, background:'linear-gradient(135deg,#06C167,#05AA5A)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Zap size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="v-bold" style={{ fontWeight:800, fontSize:'1.2rem', color:'var(--foreground)' }}>Velocity</span>
        </div>
        <div style={{ display:'flex', gap:28 }}>
          {['Services','Safety','Careers','About'].map(l => (
            <a key={l} href="#" style={{ color:'var(--muted-foreground)', fontSize:'0.88rem', fontWeight:500, textDecoration:'none' }}
              onMouseEnter={e=>e.target.style.color='var(--foreground)'}
              onMouseLeave={e=>e.target.style.color='var(--muted-foreground)'}>{l}</a>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth:1280, margin:'0 auto', padding:'64px 48px 80px', display:'flex', gap:64, alignItems:'center', flexWrap:'wrap' }}>

        {/* Left */}
        <div style={{ flex:1, minWidth:300 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(6,193,103,0.1)', border:'1px solid rgba(6,193,103,0.25)', color:'var(--primary)', padding:'6px 14px', borderRadius:100, fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:22 }}>
            <Zap size={11} />#1 Ride Platform in the Region
          </div>

          <h1 className="v-bold" style={{ fontWeight:800, fontSize:'clamp(2.2rem,4.5vw,3.4rem)', lineHeight:1.1, color:'var(--foreground)', marginBottom:20 }}>
            Move smarter.<br />
            <span style={{ color:'var(--primary)' }}>Live faster.</span>
          </h1>

          <p style={{ color:'var(--muted-foreground)', fontSize:'1rem', lineHeight:1.75, maxWidth:460, marginBottom:36 }}>
            Velocity connects you to reliable rides, carpools, bike trips, and parcel delivery — all from one beautifully simple dashboard.
          </p>

          <div style={{ display:'flex', flexWrap:'wrap', gap:14, marginBottom:48 }}>
            {features.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display:'flex', alignItems:'center', gap:7, color:'var(--muted-foreground)', fontSize:'0.82rem' }}>
                <Icon size={13} color="var(--primary)" />
                {text}
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20 }}>
            {stats.map(({ value, label }) => (
              <div key={label} style={{ textAlign:'center' }}>
                <div className="v-bold" style={{ fontWeight:800, fontSize:'2.2rem', color:'var(--primary)', lineHeight:1 }}>{value}</div>
                <div style={{ color:'var(--muted-foreground)', fontSize:'0.78rem', marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Login panel */}
        <div style={{ width:400, flexShrink:0 }}>
          <div ref={loginRef} style={{ background:'var(--card)', border:`1.5px solid ${loginHighlight ? 'var(--primary)' : 'var(--border)'}`, borderRadius:24, padding:40, boxShadow: loginHighlight ? '0 0 0 4px rgba(6,193,103,0.15), 0 24px 64px rgba(0,0,0,0.08)' : '0 24px 64px rgba(0,0,0,0.08)', transition:'border-color 0.3s, box-shadow 0.3s' }}>

            <h2 className="v-bold" style={{ fontWeight:800, fontSize:'1.55rem', color:'var(--foreground)', marginBottom:6 }}>Welcome back</h2>
            <p style={{ color:'var(--muted-foreground)', fontSize:'0.88rem', marginBottom:24 }}>Sign in to access your dashboard</p>

            <div style={{ display:'flex', background:'var(--secondary)', borderRadius:12, padding:4, marginBottom:26 }}>
              <button className={`v-tab${activeTab==='signin'?' active':''}`} onClick={()=>setActiveTab('signin')}>Sign In</button>
              <button className={`v-tab${activeTab==='signup'?' active':''}`} onClick={()=>setActiveTab('signup')}>Sign Up</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {activeTab === 'signup' && (
                <div>
                  <label style={{ display:'block', marginBottom:6, fontSize:'0.82rem', fontWeight:600, color:'var(--foreground)' }}>Full Name</label>
                  <input className="v-input" type="text" placeholder="John Doe" value={name} onChange={e=>setName(e.target.value)} required />
                </div>
              )}
              <div>
                <label style={{ display:'block', marginBottom:6, fontSize:'0.82rem', fontWeight:600, color:'var(--foreground)' }}>Email</label>
                <input className="v-input" type="email" placeholder="hello@velocity.com" value={email} onChange={e=>setEmail(e.target.value)} required />
              </div>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <label style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--foreground)' }}>Password</label>
                  {activeTab === 'signin' && <a href="#" style={{ fontSize:'0.78rem', color:'var(--primary)', textDecoration:'none' }}>Forgot?</a>}
                </div>
                <input className="v-input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
              </div>
              {error && (
                <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'10px 14px', borderRadius:10, fontSize:'0.83rem', lineHeight:1.5 }}>
                  {error}
                </div>
              )}
              <button type="submit" className="v-primary-btn" disabled={loading} style={{ marginTop:4 }}>
                {loading ? 'Please wait…' : activeTab === 'signin' ? 'Sign In' : 'Create Account'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <Link
                to="/driver/login"
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  textDecoration: 'none',
                }}
              >
                Sign in as driver →
              </Link>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0' }}>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
              <span style={{ color:'var(--muted-foreground)', fontSize:'0.78rem' }}>or</span>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
            </div>

            <button style={{ width:'100%', padding:'12px', background:'var(--secondary)', border:'1.5px solid var(--border)', borderRadius:12, color:'var(--foreground)', fontSize:'0.88rem', fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'border-color 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <div style={{ display:'flex', justifyContent:'center', gap:18, marginTop:18 }}>
              {['SSL Secured','No spam','Free forever'].map(t => (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:4, color:'var(--muted-foreground)', fontSize:'0.72rem' }}>
                  <Check size={10} color="var(--primary)" strokeWidth={3} />{t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section style={{ background:'var(--secondary)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'80px 48px' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ marginBottom:48 }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--primary)', marginBottom:10 }}>What we offer</div>
            <h2 className="v-bold" style={{ fontWeight:800, fontSize:'2.1rem', color:'var(--foreground)', lineHeight:1.2 }}>Every journey, covered.</h2>
            <div style={{ width:44, height:4, background:'var(--primary)', borderRadius:2, marginTop:14 }} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:20 }}>
            {services.map(({ icon: Icon, title, desc, tag, color }) => (
              <div key={title}
                onClick={() => scrollToLogin()}
                onMouseEnter={() => setHoveredService(title)}
                onMouseLeave={() => setHoveredService(null)}
                style={{ background:'var(--card)', border:`1.5px solid ${hoveredService===title ? color : 'var(--border)'}`, borderRadius:20, padding:28, cursor:'pointer', transition:'all 0.3s ease', transform: hoveredService===title ? 'translateY(-6px)' : 'none', boxShadow: hoveredService===title ? `0 20px 40px rgba(0,0,0,0.1)` : 'none' }}>
                <div style={{ display:'inline-block', padding:'3px 10px', borderRadius:100, background:`${color}18`, color, fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:20 }}>{tag}</div>
                <div style={{ width:50, height:50, borderRadius:14, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                  <Icon size={22} color={color} strokeWidth={1.8} />
                </div>
                <h3 className="v-bold" style={{ fontWeight:700, fontSize:'1.1rem', color:'var(--foreground)', marginBottom:8 }}>{title}</h3>
                <p style={{ color:'var(--muted-foreground)', fontSize:'0.85rem', lineHeight:1.65, marginBottom:18 }}>{desc}</p>
                <div style={{ display:'flex', alignItems:'center', gap:5, color, fontSize:'0.82rem', fontWeight:600 }}>
                  Book now <ChevronRight size={13} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Velocity */}
      <section style={{ maxWidth:1280, margin:'0 auto', padding:'80px 48px' }}>
        <div style={{ display:'flex', gap:80, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:260 }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--primary)', marginBottom:10 }}>Why choose us</div>
            <h2 className="v-bold" style={{ fontWeight:800, fontSize:'2.1rem', color:'var(--foreground)', lineHeight:1.2, marginBottom:18 }}>Built for people<br />who value time.</h2>
            <p style={{ color:'var(--muted-foreground)', lineHeight:1.8, fontSize:'0.92rem', maxWidth:420 }}>
              Every feature in Velocity is designed around one principle — getting you where you need to be, safely and on time. No surge pricing surprises. No hidden fees.
            </p>
          </div>
          <div style={{ flex:1, minWidth:260, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {whyCards.map(({ icon, title, desc }) => (
              <div key={title}
                onMouseEnter={() => setHoveredWhy(title)}
                onMouseLeave={() => setHoveredWhy(null)}
                style={{ background:'var(--card)', border:`1.5px solid ${hoveredWhy===title ? 'var(--primary)' : 'var(--border)'}`, borderRadius:16, padding:'22px 18px', transition:'border-color 0.2s ease' }}>
                <div style={{ fontSize:'1.7rem', marginBottom:10 }}>{icon}</div>
                <div style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--foreground)', marginBottom:6 }}>{title}</div>
                <div style={{ color:'var(--muted-foreground)', fontSize:'0.78rem', lineHeight:1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ maxWidth:1280, margin:'0 auto', padding:'0 48px 80px' }}>
        <div style={{ background:'linear-gradient(135deg,#06C167 0%,#05AA5A 50%,#048A48 100%)', borderRadius:24, padding:'52px 56px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:28 }}>
          <div>
            <h2 className="v-bold" style={{ fontWeight:800, fontSize:'1.9rem', color:'#fff', marginBottom:8 }}>Ready to ride with Velocity?</h2>
            <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'0.95rem' }}>Join 2 million+ commuters who trust us every day.</p>
          </div>
          <button onClick={() => scrollToLogin()} style={{ padding:'14px 32px', background:'#fff', color:'#06C167', border:'none', borderRadius:12, fontSize:'0.95rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:'var(--font-family)', transition:'all 0.2s', flexShrink:0 }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 20px rgba(0,0,0,0.15)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}>
            Get Started Free <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop:'1px solid var(--border)', padding:'28px 48px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, background:'linear-gradient(135deg,#06C167,#05AA5A)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Zap size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="v-bold" style={{ fontWeight:800, color:'var(--foreground)', fontSize:'0.95rem' }}>Velocity</span>
        </div>
        <p style={{ color:'var(--muted-foreground)', fontSize:'0.78rem' }}>© 2026 Velocity. All rights reserved.</p>
        <div style={{ display:'flex', gap:20 }}>
          {['Privacy','Terms','Support'].map(l => (
            <a key={l} href="#" style={{ color:'var(--muted-foreground)', fontSize:'0.78rem', textDecoration:'none' }}
              onMouseEnter={e=>e.target.style.color='var(--foreground)'}
              onMouseLeave={e=>e.target.style.color='var(--muted-foreground)'}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
