import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { TodayPage } from './pages/TodayPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
