import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { houseShown } from '../model/config/houses';
import { useElection } from '../hooks/useElection';
import { useApi } from '../hooks/useApi';
import { getElection } from '../services/api';
import StudioDashboard from './StudioDashboard';
import { useTranslation } from 'react-i18next';

export default function ElectionView() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { election, setElection, setElectionType, setSelectedStateId } = useElection();
  const { data, loading, error } = useApi(() => getElection(id!), [id]);

  useEffect(() => {
    if (data && data.id !== election?.id) {
      setElection(data);
      setElectionType(data.type);
      if (data.type === 'VS' && data.state_id) {
        setSelectedStateId(data.state_id);
      }
    }
  }, [data, election?.id, setElection, setElectionType, setSelectedStateId]);

  // A direct link to an election of a hidden house (Lok Sabha, for now) goes home.
  if (data && !houseShown(data.type)) return <Navigate to="/" replace />;
  if (loading) return <div className="studio-root h-screen" />;
  if (error) {
    return (
      <div className="empty-state">
        <h3>{t('error_occurred')}</h3>
        <p>{error}</p>
      </div>
    );
  }
  return <StudioDashboard />;
}
