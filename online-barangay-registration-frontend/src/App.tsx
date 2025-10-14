// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EventProvider } from './context/EventContext';

// Pages
import LandingPage from './pages/LandingPage';
import EventsPage from './pages/EventsPage';
import RegistrationPage from './pages/RegistrationPage';
import LoginPage from './pages/LoginPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import EventManagement from './pages/admin/EventManagement';

// Components
import AuthGuard from './components/layout/AuthGuard';

function App() {
  return (
    <AuthProvider>
      <EventProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/events" element={<EventsPage />} />
              {/*<Route path="/events/:id" element={<EventDetailsPage />} /> */}
              <Route path="/register/:eventId" element={<RegistrationPage />} />
              <Route path="/login" element={<LoginPage />} />
              
              {/* Protected Admin Routes */}
              {/*
              <Route path="/admin" element={
                <AuthGuard roles={['super_admin', 'event_manager', 'staff']}>
                  <AdminDashboard />
                </AuthGuard>
              } />
              <Route path="/admin/events" element={
                <AuthGuard roles={['super_admin', 'event_manager']}>
                  <EventManagement />
                </AuthGuard>
              } />
              */}
            </Routes>
          </div>
        </Router>
      </EventProvider>
    </AuthProvider>
  );
}

export default App;