import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { ElectionProvider } from './hooks/useElection';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import ElectionView from './pages/ElectionView';
import ConstituencyDetail from './pages/ConstituencyDetail';
import PersonDetail from './pages/PersonDetail';
import About from './pages/About';

/** Every route is a studio screen with its own header; each page decides whether it scrolls (dashboard: no, detail pages: yes). */
function AppLayout() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{ flex: 1, minHeight: 0, width: '100%', overflow: 'hidden', position: 'relative' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/election/:id" element={<ElectionView />} />
          <Route path="/election/:electionId/constituency/:constId" element={<ConstituencyDetail />} />
          <Route path="/person/:id" element={<PersonDetail />} />
          <Route path="/about" element={<About />} />
        </Routes>
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
