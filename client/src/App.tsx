import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { TodayPage } from './pages/TodayPage';

export function App() {
  const auth = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            auth.isAuthenticated ? (
              <TodayPage userEmail={auth.user?.email ?? null} onLogout={auth.logout} />
            ) : (
              <LoginPage onLogin={auth.login} onRegister={auth.register} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
