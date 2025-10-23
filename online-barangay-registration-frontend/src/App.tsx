// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { EventProvider } from "./context/EventContext";

// Public Pages
import LandingPage from "./pages/LandingPage";
import EventsPage from "./pages/EventsPage";
import RegistrationPage from "./pages/RegistrationPage";
import LoginPage from "./pages/LoginPage";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import EventManagement from "./pages/admin/EventManagement";
import UserManagement from "./pages/admin/UserManagement";
import AuditLogs from "./pages/admin/AuditLogs";
import EventRegistrants from "./pages/admin/EventRegistrants";
import EventManagers from "./pages/admin/EventManagers";

// Layouts & Guards
import AdminLayout from "./layouts/AdminLayout";
import AuthGuard from "./components/layout/AuthGuard";

function App() {
  return (
    <AuthProvider>
      <EventProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* 🌐 Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/events" element={<EventsPage />} />
              {/* <Route path="/events/:id" element={<EventDetailsPage />} /> */}
              <Route path="/register/:eventId" element={<RegistrationPage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* 🔒 Protected Admin Routes (Layout Wrapper) */}
              <Route
  path="/admin"
  element={
    <AuthGuard roles={['SUPER_ADMIN', 'EVENT_MANAGER', 'STAFF']}>
      <AdminLayout />
    </AuthGuard>
  }
>
                {/* 🏠 Default dashboard page (/admin) */}
                <Route index element={<AdminDashboard />} />

                {/* 📅 Event Management */}
                <Route
                  path="events"
                  element={
                    <AuthGuard roles={["SUPER_ADMIN", "EVENT_MANAGER"]}>
                      <EventManagement />
                    </AuthGuard>
                  }
                />

                {/* 👥 User Management (Super Admin only) */}
                <Route
                  path="users"
                  element={
                    <AuthGuard roles={["SUPER_ADMIN"]}>
                      <UserManagement />
                    </AuthGuard>
                  }
                />

                {/* 🧾 Audit Logs (Super Admin only) */}
                <Route
                  path="audit"
                  element={
                    <AuthGuard roles={["SUPER_ADMIN"]}>
                      <AuditLogs />
                    </AuthGuard>
                  }
                />

                {/* 👔 Event Managers (Super Admin only) */}
                <Route
                  path="event-managers"
                  element={
                    <AuthGuard roles={["SUPER_ADMIN"]}>
                      <EventManagers />
                    </AuthGuard>
                  }
                />

                {/* 🧍‍♂️ Registrants (Shared) */}
                <Route
                  path="events/:id/registrants"
                  element={
                    <AuthGuard roles={["SUPER_ADMIN", "EVENT_MANAGER", "STAFF"]}>
                      <EventRegistrants />
                    </AuthGuard>
                  }
                />
              </Route>
            </Routes>
          </div>
        </Router>
      </EventProvider>
    </AuthProvider>
  );
}

export default App;
