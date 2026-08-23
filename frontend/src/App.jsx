import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import AuthContextProvider from './context/AuthContextProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './context/ToastContext';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MyFiles from './pages/MyFiles';
import History from './pages/History';
import Trash from './pages/Trash';
import Settings from './pages/Settings';
import DocumentViewer from './pages/DocumentViewer';
import AdminDashboard from './pages/AdminDashboard';
import VerifyEmail from './pages/VerifyEmail';
import DashboardLayout from './components/layout/DashboardLayout';
import GoogleAccountCreation from './pages/GoogleAccountCreation';
import ScrollRestoration from './components/ScrollRestoration';
import ScrollDebug from './components/ScrollDebug';
import { FileProvider } from './context/FileContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // Admins should not access the user dashboard
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (user && user.role === 'admin') {
    return children;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    return children;
  }
  // Honour ?redirect= so an already-logged-in user landing on /login?redirect=... is sent to their target
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect');
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return <Navigate to={redirect} replace />;
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

function AppContent() {
  return (
    <Router>
      <ScrollRestoration />
      <ScrollDebug />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/create-google-account"
          element={
            <PublicRoute>
              <GoogleAccountCreation />
            </PublicRoute>
          }
        />

        <Route
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-files" element={<MyFiles />} />
          <Route path="/images" element={<MyFiles />} />
          <Route path="/videos" element={<MyFiles />} />
          <Route path="/documents" element={<MyFiles />} />
          <Route path="/history" element={<History />} />
          <Route path="/favorites" element={<History favoritesOnly />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route
          path="/verify-mobile"
          element={<Navigate to="/dashboard" replace />}
        />

        <Route
          path="/admin/login"
          element={
            <PublicRoute>
              <Login mode="admin" />
            </PublicRoute>
          }
        />
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route path="/viewer/:id" element={<DocumentViewer />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthContextProvider>
          <FileProvider>
            <AppContent />
          </FileProvider>
        </AuthContextProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

