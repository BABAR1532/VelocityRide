import { Bell, User, Menu, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

export function Navbar({ onToggleSidebar }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-background border-b border-border h-16 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 hover:bg-secondary rounded-xl transition-colors duration-200 text-foreground"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="hidden lg:flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-[#05AA5A] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Velocity</h1>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate('/notifications')}
          className="p-2 hover:bg-secondary rounded-xl transition-all duration-200 relative hover:shadow-sm text-foreground"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse" />
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="p-2 hover:bg-secondary rounded-xl transition-all duration-200 hover:shadow-sm text-foreground"
          title="Profile"
        >
          <User className="w-5 h-5" />
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 ml-1 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 border border-destructive/30 hover:border-destructive/60 transition-all duration-200 hover:shadow-sm"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </nav>
  );
}
