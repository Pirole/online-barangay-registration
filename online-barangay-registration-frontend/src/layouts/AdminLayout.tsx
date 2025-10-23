import React, { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiMenu,
  FiX,
  FiHome,
  FiCalendar,
  FiUsers,
  FiBarChart2,
  FiSettings,
  FiLogOut,
} from "react-icons/fi";

/**
 * AdminLayout — shared layout for admin-related pages
 * - Collapsible sidebar (only for SUPER_ADMIN)
 * - Responsive for mobile (slide-in)
 * - Uses Tailwind CSS
 * - Works with <Outlet /> for nested routes
 */
const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const role = (user?.role || "").toUpperCase();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout?.();
    localStorage.clear();
    sessionStorage.clear();
    navigate("/login");
  };

  const navItems = [
    { label: "Dashboard", icon: FiHome, path: "/admin" },
    { label: "Events", icon: FiCalendar, path: "/admin/events" },
    { label: "Event Managers", icon: FiUsers, path: "/admin/event-managers" },
    { label: "Statistics", icon: FiBarChart2, path: "/admin/statistics" },
    { label: "Settings", icon: FiSettings, path: "/admin/settings" },
  ];

  const isSuperAdmin = role === "SUPER_ADMIN";

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* ───────────── Sidebar (Super Admin only) ───────────── */}
      {isSuperAdmin && (
        <>
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={`fixed z-40 top-0 left-0 h-full bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out 
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
              lg:translate-x-0 lg:static lg:flex lg:flex-col lg:w-64`}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h1 className="text-xl font-semibold text-blue-700">
                Admin Panel
              </h1>
              <button
                className="lg:hidden text-gray-600 hover:text-gray-900"
                onClick={() => setSidebarOpen(false)}
              >
                <FiX size={20} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {navItems.map(({ label, icon: Icon, path }) => {
                const active = location.pathname === path;
                return (
                  <button
                    key={path}
                    onClick={() => {
                      navigate(path);
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <Icon className="mr-3" size={18} />
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <FiLogOut className="mr-3" size={18} />
                Logout
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ───────────── Main Content Area ───────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-gray-700 hover:text-blue-700 lg:hidden"
              >
                <FiMenu size={22} />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-800">
              Admin Dashboard
            </h2>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {user?.email || "Unknown"} ({role})
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet /> {/* ✅ Nested admin pages render here */}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
