import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Layout from './components/layout/Layout';
import SettingsForm from './components/settings/SettingsForm';
import WorkflowsPage from './pages/WorkflowsPage';
import WorkflowFormPage from './pages/WorkflowFormPage';
import OnboardingPage from './pages/OnboardingPage';
import LogsPage from './pages/LogsPage';
import LandingPage from './pages/LandingPage';

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
        <Route
          path="/workflows"
          element={
            <ProtectedRoute>
              <Layout>
                <WorkflowsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflows/new"
          element={
            <ProtectedRoute>
              <Layout>
                <WorkflowFormPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflows/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <WorkflowFormPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Layout>
                <OnboardingPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute>
              <Layout>
                <LogsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<LandingPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
