import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { TalkPage } from './pages/TalkPage';
import { TodayPage } from './pages/TodayPage';
import { MapPage } from './pages/MapPage';

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
        <Route
          path="/map"
          element={
            auth.isAuthenticated ? (
              <MapPage userEmail={auth.user?.email ?? null} onLogout={auth.logout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/talk"
          element={
            auth.isAuthenticated ? (
              <TalkPage userEmail={auth.user?.email ?? null} onLogout={auth.logout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
