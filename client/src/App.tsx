import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { TodayPage } from './pages/TodayPage';
import { MapPage } from './pages/MapPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
