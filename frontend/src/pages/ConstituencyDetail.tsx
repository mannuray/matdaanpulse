import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useConstituencyPageVM } from '../viewmodels/pages/useConstituencyPageVM';
import { useElection } from '../viewmodels/data/useElection';
import { ConstituencyPageView } from '../views/constituency/ConstituencyPageView';

export default function ConstituencyDetail() {
  const { electionId = '', constId = '' } = useParams<{ electionId: string; constId: string }>();
  const vm = useConstituencyPageVM(electionId, constId);
  const { election, setElection, setElectionType, setSelectedStateId } = useElection();

  // On a direct load the context has no election: sync it from the one the VM fetched.
  const routeElection = vm.election;
  useEffect(() => {
    if (routeElection && routeElection.id === electionId && election?.id !== electionId) {
      setElection(routeElection);
      setElectionType(routeElection.type);
      if (routeElection.type === 'VS' && routeElection.state_id) setSelectedStateId(routeElection.state_id);
    }
  }, [routeElection, electionId, election?.id, setElection, setElectionType, setSelectedStateId]);

  return <ConstituencyPageView vm={vm} />;
}
