import { BrowserRouter, Routes, Route, useMatch } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { ElectionProvider } from './hooks/useElection';
import { useElection } from './hooks/useElection';
import { useApi } from './hooks/useApi';
import { getElections, getStates } from './services/api';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/organisms/Header';
import Home from './pages/Home';
import ElectionView from './pages/ElectionView';
import ConstituencyDetail from './pages/ConstituencyDetail';
import PersonDetail from './pages/PersonDetail';

function AppLayout() {
  const { data: elections } = useApi(() => getElections(), []);
  const { data: states } = useApi(() => getStates(), []);
  const { sseConnected } = useElection();
  const onElection = useMatch('/election/:id');
  const onHome = useMatch('/');
  const studio = Boolean(onElection || onHome);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!studio && <Header elections={elections || []} states={states || []} sseConnected={sseConnected} />}
      <main style={{ flex: 1, width: '100%', overflowY: studio ? 'hidden' : 'auto', position: 'relative' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/election/:id" element={<ElectionView />} />
          <Route path="/election/:electionId/constituency/:constId" element={<ConstituencyDetail />} />
          <Route path="/person/:id" element={<PersonDetail />} />
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
