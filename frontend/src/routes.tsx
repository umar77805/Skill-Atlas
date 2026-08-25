import { Routes, Route } from 'react-router';
import AtlasPage from './components/AtlasPage.tsx';
import PathFinderPage from './components/PathFinderPage.tsx';
import InsightsPage from './components/InsightsPage.tsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AtlasPage />} />
      <Route path="/path" element={<PathFinderPage />} />
      <Route path="/insights" element={<InsightsPage />} />
    </Routes>
  );
}
