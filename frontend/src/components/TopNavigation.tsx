import { NavLink } from 'react-router-dom'
import { BarChart3, Clock, Settings, Activity } from 'lucide-react'
import { useIRISStore } from '../store/irisStore'

function getInitials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export default function TopNavigation() {
  const currentUser = useIRISStore((s) => s.currentUser)
  const backendAlive = useIRISStore((s) => s.backendAlive)

  const displayEmail = currentUser?.email ?? '—'
  const displayName  = currentUser?.email
    ? currentUser.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'IRIS User'
  const initials = currentUser?.email ? getInitials(currentUser.email) : '?'

  return (
    <div className="top-navigation">
      <div className="nav-brand">
        <Activity size={20} className="brand-icon" />
        <span className="brand-text">IRIS</span>
      </div>

      <nav className="nav-menu">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <BarChart3 size={16} />
          <span>Strategy Views</span>
        </NavLink>

        <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Clock size={16} />
          <span>History</span>
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={16} />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* Backend alive indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '16px' }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: backendAlive ? 'var(--accent-green)' : 'var(--accent-red)',
          boxShadow: backendAlive ? '0 0 6px var(--accent-green)' : '0 0 6px var(--accent-red)',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
          {backendAlive ? 'Connected' : 'Offline'}
        </span>
      </div>

      <div className="nav-user">
        <div className="user-avatar">
          <span>{initials}</span>
        </div>
        <div className="user-info">
          <div className="user-name">{displayName}</div>
          <div className="user-email">{displayEmail}</div>
        </div>
      </div>

      <style>{`
        .top-navigation {
          height: 60px;
          background: var(--surface);
          border-bottom: 1px solid var(--border2);
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 0;
          flex-shrink: 0;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-right: 48px;
        }

        .brand-icon {
          color: var(--teal);
          animation: pulse 2.4s ease-in-out infinite;
        }

        .brand-text {
          font-family: var(--mono);
          font-size: 18px;
          font-weight: 700;
          color: var(--teal);
          letter-spacing: 0.12em;
        }

        .nav-menu {
          display: flex;
          gap: 8px;
          flex: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text2);
          text-decoration: none;
          transition: all 0.2s ease;
          position: relative;
        }

        .nav-item:hover { color: var(--text); background: var(--hover); }

        .nav-item.active {
          color: var(--teal);
          background: var(--teal-lo);
        }

        .nav-item.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 2px;
          background: var(--teal);
          border-radius: 1px;
        }

        .nav-user {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--raised);
          border: 1px solid var(--border2);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-user:hover { background: var(--hover); border-color: var(--border); }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--teal), var(--teal-md));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bg);
          font-weight: 600;
          font-size: 12px;
          font-family: var(--mono);
        }

        .user-info { display: flex; flex-direction: column; gap: 2px; }

        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          font-family: var(--mono);
        }

        .user-email {
          font-size: 11px;
          color: var(--text2);
          font-family: var(--mono);
        }

        @media (max-width: 768px) {
          .top-navigation { padding: 0 16px; height: 56px; }
          .nav-brand { margin-right: 24px; }
          .brand-text { font-size: 16px; }
          .nav-item { padding: 8px 12px; font-size: 13px; }
          .nav-item span { display: none; }
          .user-info { display: none; }
          .nav-user { padding: 6px; }
          .user-avatar { width: 32px; height: 32px; font-size: 11px; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}
