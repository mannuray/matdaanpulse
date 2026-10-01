import { Navigate, useLocation, useParams } from 'react-router-dom';

/** Old `/x/:id/edit` links: the panel at `/x/:id` is now both view and edit. */
export function EditRedirect({ base }: { base: string }) {
  const { id = '' } = useParams<{ id: string }>();
  const { search } = useLocation();
  return <Navigate to={`${base}/${encodeURIComponent(id)}${search}`} replace />;
}
