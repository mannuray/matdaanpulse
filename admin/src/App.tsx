import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/atoms/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Elections from './pages/Elections';
import ManifestDetail from './pages/ManifestDetail';
import ManifestEditor from './pages/ManifestEditor';
import UserManager from './pages/UserManager';
import AuditLogs from './pages/AuditLogs';
import Feedback from './pages/Feedback';
import SystemStatus from './pages/SystemStatus';
import Parties from './pages/Parties';
import { EditRedirect } from './components/routing/EditRedirect';
import Candidates from './pages/Candidates';
import LiveConsole from './pages/LiveConsole';
import ConstituencyManager from './pages/ConstituencyManager';
import ConstituencyDetail from './pages/ConstituencyDetail';
import ConstituencyEdit from './pages/ConstituencyEdit';
import Persons from './pages/Persons';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, hasRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && roles.length > 0 && !roles.some((r) => hasRole(r))) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)' }}>You do not have permission to view this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="elections/:id/edit" element={<EditRedirect base="/elections" />} />
                <Route path="elections/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Elections /></ProtectedRoute>} />
                
                {/* Manifests */}
                <Route path="manifests" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><ManifestDetail /></ProtectedRoute>} />
                <Route path="manifests/:id" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><ManifestDetail /></ProtectedRoute>} />
                <Route path="manifests/:id/edit" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><ManifestEditor /></ProtectedRoute>} />
                
                {/* Parties: list + panel at /parties/:id; old /:id/edit links redirect */}
                <Route path="parties/:id/edit" element={<EditRedirect base="/parties" />} />
                <Route path="parties/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Parties /></ProtectedRoute>} />
                
                {/* Candidates */}
                <Route path="candidates/:id/edit" element={<EditRedirect base="/candidates" />} />
                <Route path="candidates/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Candidates /></ProtectedRoute>} />
                
                {/* Persons */}
                <Route path="persons/:id/edit" element={<EditRedirect base="/persons" />} />
                <Route path="persons/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Persons /></ProtectedRoute>} />
                
                {/* Constituencies */}
                <Route path="constituencies" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><ConstituencyManager /></ProtectedRoute>} />
                <Route path="constituencies/:id" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><ConstituencyDetail /></ProtectedRoute>} />
                <Route path="constituencies/:id/edit" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><ConstituencyEdit /></ProtectedRoute>} />
                
                {/* Overrides & Logs */}
                <Route path="overrides" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><LiveConsole /></ProtectedRoute>} />
                <Route path="feedback" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Feedback /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute roles={['SUPER_ADMIN']}><UserManager /></ProtectedRoute>} />
                <Route path="logs" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AuditLogs /></ProtectedRoute>} />
                <Route path="status" element={<ProtectedRoute roles={['SUPER_ADMIN']}><SystemStatus /></ProtectedRoute>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
