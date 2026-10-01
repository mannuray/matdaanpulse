import {
  LayoutDashboard, Radio, Vote, FileCog, Flag, Users, UserRound, Map, MessageSquare, UserCog, History, Activity,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
}

export interface NavGroup {
  label: 'Counting' | 'Data' | 'Admin';
  items: NavItem[];
}

const EDIT = ['SUPER_ADMIN', 'EDITOR'];
const SUPER = ['SUPER_ADMIN'];

/** MODEL: navigation structure + access rules (sidebar groups). */
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Counting', items: [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: [] },
    { path: '/overrides', label: 'Live console', icon: Radio, roles: EDIT },
  ] },
  { label: 'Data', items: [
    { path: '/elections', label: 'Elections', icon: Vote, roles: EDIT },
    { path: '/manifests', label: 'Manifests', icon: FileCog, roles: EDIT },
    { path: '/parties', label: 'Parties', icon: Flag, roles: EDIT },
    { path: '/candidates', label: 'Candidates', icon: Users, roles: EDIT },
    { path: '/persons', label: 'Persons', icon: UserRound, roles: EDIT },
    { path: '/constituencies', label: 'Constituencies', icon: Map, roles: EDIT },
  ] },
  { label: 'Admin', items: [
    { path: '/feedback', label: 'Feedback', icon: MessageSquare, roles: EDIT },
    { path: '/users', label: 'Users', icon: UserCog, roles: SUPER },
    { path: '/logs', label: 'Audit logs', icon: History, roles: SUPER },
    { path: '/status', label: 'System status', icon: Activity, roles: SUPER },
  ] },
];
