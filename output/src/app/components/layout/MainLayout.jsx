import { useState } from 'react';
import { Outlet } from 'react-router';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
