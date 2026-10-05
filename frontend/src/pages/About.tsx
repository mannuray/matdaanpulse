import { useLocation } from 'react-router-dom';
import { CONTACT_EMAIL, DATA_SOURCES, ECI_RESULTS_URL, dataMatrix } from '../model/about/about';
import { houseShown } from '../model/config/houses';
import { useFeedbackForm } from '../viewmodels/about/useFeedbackForm';
import { useCreditsVM } from '../viewmodels/about/useCreditsVM';
import { AboutView } from '../views/about/AboutView';

// Datasets of hidden houses (Lok Sabha, for now) are not listed.
const SOURCES = DATA_SOURCES.filter(s => houseShown(s.house));
const MATRIX = dataMatrix(SOURCES);

export default function About() {
  const location = useLocation();
  // The dashboard links here with its own path in state, so a report says which screen it is about.
  const from = (location.state as { from?: string } | null)?.from;
  const feedback = useFeedbackForm(from ?? location.pathname);
  const { credits } = useCreditsVM();
  return <AboutView matrix={MATRIX} elections={SOURCES.length} contactEmail={CONTACT_EMAIL} eciUrl={ECI_RESULTS_URL} feedback={feedback} credits={credits} />;
}
