import { useLocation } from 'react-router-dom';
import { CONTACT_EMAIL, DATA_SOURCES, ECI_RESULTS_URL, groupDataSources } from '../model/about/about';
import { useFeedbackForm } from '../viewmodels/about/useFeedbackForm';
import { AboutView } from '../views/about/AboutView';

const GROUPS = groupDataSources(DATA_SOURCES);

export default function About() {
  const location = useLocation();
  // The dashboard links here with its own path in state, so a report says which screen it is about.
  const from = (location.state as { from?: string } | null)?.from;
  const feedback = useFeedbackForm(from ?? location.pathname);
  return <AboutView groups={GROUPS} contactEmail={CONTACT_EMAIL} eciUrl={ECI_RESULTS_URL} feedback={feedback} />;
}
