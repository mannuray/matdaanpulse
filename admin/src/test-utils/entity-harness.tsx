import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { EditRedirect } from '../components/routing/EditRedirect';

/** Prints the current path + query (data-testid="where"). */
export function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

/** Mounts an entity page exactly like App.tsx: `${base}/*` plus the `${base}/:id/edit` redirect. */
export function renderEntityPage(base: string, page: ReactElement, at: string) {
  return render(
    <ToastProvider>
      <ShellStatusProvider>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route path={`${base}/:id/edit`} element={<EditRedirect base={base} />} />
            <Route path={`${base}/*`} element={page} />
          </Routes>
          <Where />
        </MemoryRouter>
      </ShellStatusProvider>
    </ToastProvider>,
  );
}
