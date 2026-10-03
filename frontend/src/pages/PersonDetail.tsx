import { useParams } from 'react-router-dom';
import { usePersonPageVM } from '../viewmodels/pages/usePersonPageVM';
import { PersonPageView } from '../views/person/PersonPageView';

export default function PersonDetail() {
  const { id = '' } = useParams<{ id: string }>();
  return <PersonPageView vm={usePersonPageVM(id)} />;
}
