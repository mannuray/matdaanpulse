import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { ElectionProvider } from './viewmodels/data/useElection';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import ElectionView from './pages/ElectionView';

// The dashboard (and the landing redirect) are in the main bundle; the other pages load on first visit.
const ConstituencyDetail = lazy(() => import('./pages/ConstituencyDetail'));
const PersonDetail = lazy(() => import('./pages/PersonDetail'));
const PartyDetail = lazy(() => import('./pages/PartyDetail'));
const About = lazy(() => import('./pages/About'));

/** Every route is a studio screen with its own header; each page decides whether it scrolls (dashboard: no, detail pages: yes). */
function AppLayout() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{ flex: 1, minHeight: 0, width: '100%', overflow: 'hidden', position: 'relative' }}>
        <Suspense fallback={<div className="studio-root h-screen" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/election/:id" element={<ElectionView />} />
            <Route path="/election/:electionId/constituency/:constId" element={<ConstituencyDetail />} />
            <Route path="/person/:id" element={<PersonDetail />} />
            <Route path="/party/:id" element={<PartyDetail />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ElectionProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </ErrorBoundary>
      </ElectionProvider>
    </ThemeProvider>
  );
}

export default App;
