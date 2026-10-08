import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { houseShown } from '../model/config/houses';
import { useConstituencyPageVM } from '../viewmodels/pages/useConstituencyPageVM';
import { useElection } from '../viewmodels/data/useElection';
import { ConstituencyPageView } from '../views/constituency/ConstituencyPageView';

export default function ConstituencyDetail() {
  const { electionId = '', constId = '' } = useParams<{ electionId: string; constId: string }>();
  const vm = useConstituencyPageVM(electionId, constId);
  const { election, setElection } = useElection();

  // On a direct load the context has no election: sync it from the one the VM fetched.
  const routeElection = vm.election;
  useEffect(() => {
    if (routeElection && routeElection.id === electionId && election?.id !== electionId) {
      setElection(routeElection);
    }
  }, [routeElection, electionId, election?.id, setElection]);

  // A seat of a hidden house (Lok Sabha, for now) goes home.
  if (routeElection && !houseShown(routeElection.type)) return <Navigate to="/" replace />;
  return <ConstituencyPageView vm={vm} />;
}
