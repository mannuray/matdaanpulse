import { useParams } from 'react-router-dom';
import { usePartyPageVM } from '../viewmodels/pages/usePartyPageVM';
import { PartyPageView } from '../views/party/page/PartyPageView';

export default function PartyDetail() {
  const { id = '' } = useParams<{ id: string }>();
  return <PartyPageView vm={usePartyPageVM(id)} />;
}
