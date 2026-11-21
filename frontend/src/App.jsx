import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import ResearchPage from './pages/ResearchPage.jsx';
import ResearchProgressPage from './pages/ResearchProgressPage.jsx';
import ResearchResultsPage from './pages/ResearchResultsPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-navy-900">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/research/:id/progress" element={<ResearchProgressPage />} />
          <Route path="/research/:id/results" element={<ResearchResultsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
