import { useParams } from 'react-router-dom';
import { usePartyPageVM, type MlaView } from '../viewmodels/pages/usePartyPageVM';
import { useMlaSearch } from '../viewmodels/pages/useMlaSearch';
import { PartyPageView } from '../views/party/page/PartyPageView';

const NO_MLAS: MlaView[] = [];

export default function PartyDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const vm = usePartyPageVM(id);
  // The MLA search lives outside the page VM: a keystroke filters the list without rebuilding the page.
  const mlaSearch = useMlaSearch(vm.stateView?.mlas ?? NO_MLAS);
  return <PartyPageView vm={vm} mlaSearch={mlaSearch} />;
}
