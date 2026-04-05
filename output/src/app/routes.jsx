import { createBrowserRouter, Navigate } from 'react-router';
import { Login } from './pages/Login';
import { DriverLogin } from './pages/DriverLogin';
import { Dashboard } from './pages/Dashboard';
import { CarRide } from './pages/CarRide';
import { BikeRide } from './pages/BikeRide';
import { Carpool } from './pages/Carpool';
import { ParcelDelivery } from './pages/ParcelDelivery';
import { Subscription } from './pages/Subscription';
import { RideHistory } from './pages/RideHistory';
import { Profile } from './pages/Profile';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
import { DriverJobs } from './pages/DriverJobs';
import { DriverHistory } from './pages/DriverHistory';
import { DriverDashboard } from './pages/DriverDashboard';
import { MainLayout } from './components/layout/MainLayout';
import { useAuth } from './context/AuthContext';

// ─── Route guards ─────────────────────────────────────────────────────────────

// Requires any authenticated user (either role) — used as wrapper for the main layout.
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Redirects already-authenticated users to their correct home.
function PublicRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return children;
  if (user?.role === 'driver') return <Navigate to="/driver/jobs" replace />;
  return <Navigate to="/dashboard" replace />;
}

// Dedicated public route for the driver login page.
function PublicDriverRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return children;
  if (user?.role === 'driver') return <Navigate to="/driver/jobs" replace />;
  return <Navigate to="/dashboard" replace />;
}

// User (passenger) pages — blocks drivers from accessing user pages.
function PassengerOnly({ children }) {
  const { user } = useAuth();
  if (user?.role === 'driver') return <Navigate to="/driver/jobs" replace />;
  // 'user', 'customer' (legacy), and any other non-driver role → allowed
  return children;
}

// Driver pages — blocks non-drivers from accessing driver pages.
function DriverOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'driver') return <Navigate to="/dashboard" replace />;
  return children;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/driver/login',
    element: (
      <PublicDriverRoute>
        <DriverLogin />
      </PublicDriverRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'car-ride', element: <PassengerOnly><CarRide /></PassengerOnly> },
      { path: 'bike-ride', element: <PassengerOnly><BikeRide /></PassengerOnly> },
      { path: 'carpool', element: <PassengerOnly><Carpool /></PassengerOnly> },
      { path: 'parcel', element: <PassengerOnly><ParcelDelivery /></PassengerOnly> },
      { path: 'subscription', element: <PassengerOnly><Subscription /></PassengerOnly> },
      { path: 'ride-history', element: <PassengerOnly><RideHistory /></PassengerOnly> },
      { path: 'profile', element: <Profile /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'settings', element: <Settings /> },
      { path: 'driver/jobs', element: <DriverOnly><DriverJobs /></DriverOnly> },
      { path: 'driver/history', element: <DriverOnly><DriverHistory /></DriverOnly> },
      { path: 'driver/dashboard', element: <DriverOnly><DriverDashboard /></DriverOnly> },
    ],
  },
]);
