import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Layout from './components/layout/Layout';
import SettingsForm from './components/settings/SettingsForm';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/settings" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
