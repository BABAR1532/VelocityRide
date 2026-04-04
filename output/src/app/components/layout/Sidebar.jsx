import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Car,
  Bike,
  Users,
  Package,
  CreditCard,
  History,
  Bell,
  User,
  Settings,
  X,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const riderNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/car-ride', label: 'Car Ride', icon: Car },
  { path: '/bike-ride', label: 'Bike Ride', icon: Bike },
  { path: '/carpool', label: 'Carpool', icon: Users },
  { path: '/parcel', label: 'Parcel Delivery', icon: Package },
  { path: '/subscription', label: 'Subscriptions', icon: CreditCard },
  { path: '/ride-history', label: 'Ride History', icon: History },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const driverNavItems = [
  { path: '/driver/jobs', label: 'Jobs', icon: Truck },
  { path: '/driver/history', label: 'History', icon: History },
  { path: '/driver/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const navItems = user?.role === 'driver' ? driverNavItems : riderNavItems;
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-xl lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-[#05AA5A] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">V</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">Velocity</h1>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-secondary rounded-xl transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-foreground hover:bg-secondary hover:shadow-sm'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      
      {/* Spacer for desktop */}
      <div className="hidden lg:block w-64 flex-shrink-0" />
    </>
  );
}
