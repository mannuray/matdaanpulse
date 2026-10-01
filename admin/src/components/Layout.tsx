import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAV_SCHEMA } from '../utils/navigation.config';

/**
 * VIEW: Admin Layout (MVC: View)
 * Orchestrates the primary shell, sidebar, and content area.
 */
export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  const visibleItems = NAV_SCHEMA.filter(
    (item) => item.roles.length === 0 || item.roles.some((r) => hasRole(r))
  );

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2><img src="/logo-mark.png" alt="" aria-hidden className="admin-logo-mark" />MatdaanPulse Admin</h2>
          {user && (
            <div className="user-info">
              {user.name} &middot; <span className={`badge badge-${user.role.toLowerCase().replace('_', '-')}`}>{user.role.replace('_', ' ')}</span>
            </div>
          )}
        </div>
        <nav>
          {visibleItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`admin-nav-link ${isActive(item.path) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button onClick={logout} className="btn btn-outline" style={{ flex: 1, fontSize: 13 }}>
            Logout
          </button>
        </div>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
