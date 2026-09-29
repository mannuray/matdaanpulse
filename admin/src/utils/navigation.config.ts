export interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: string[];
}

/**
 * MODEL: Navigation Schema (MVC: Model)
 * Defines the application structure and access control rules.
 */
export const NAV_SCHEMA: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '\u2302', roles: [] },
  { path: '/elections', label: 'Elections', icon: '\u2611', roles: ['SUPER_ADMIN', 'EDITOR'] },
  { path: '/manifests', label: 'Manifests', icon: '\u2699', roles: ['SUPER_ADMIN', 'EDITOR'] },
  { path: '/parties', label: 'Parties', icon: '\u25CF', roles: ['SUPER_ADMIN', 'EDITOR'] },
  { path: '/candidates', label: 'Candidates', icon: '\u263A', roles: ['SUPER_ADMIN', 'EDITOR'] },
  { path: '/persons', label: 'Persons', icon: '\u265F', roles: ['SUPER_ADMIN', 'EDITOR'] },
  { path: '/constituencies', label: 'Constituencies', icon: '\u25A3', roles: ['SUPER_ADMIN', 'EDITOR'] },
  { path: '/overrides', label: 'Live Console', icon: '\u270E', roles: ['SUPER_ADMIN', 'EDITOR'] },
  { path: '/users', label: 'Users', icon: '\u263B', roles: ['SUPER_ADMIN'] },
  { path: '/logs', label: 'Audit Logs', icon: '\u2630', roles: ['SUPER_ADMIN'] },
];
