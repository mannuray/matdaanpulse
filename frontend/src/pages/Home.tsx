import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useElection } from '../viewmodels/data/useElection';
import { useDefaultElectionId } from '../viewmodels/tiles/useDefaultElectionId';
import StudioDashboard from './StudioDashboard';

function Landing() {
  const { id, loading } = useDefaultElectionId();
  const { t } = useTranslation();
  if (loading) return <div className="studio-root h-screen" />;
  if (id) return <Navigate to={`/election/${id}`} replace />;
  return <div className="studio-root grid h-screen place-items-center text-muted">{t('studio_no_elections')}</div>;
}

export default function Home() {
  const { election } = useElection();
  return election ? <StudioDashboard /> : <Landing />;
}
