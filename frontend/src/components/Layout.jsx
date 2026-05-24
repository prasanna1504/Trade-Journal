import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function Layout() {
  const navigate = useNavigate()

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: 220, background: 'var(--bg-card)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: 4, flexShrink: 0,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginBottom: 32, paddingLeft: 8 }}>
          TradeJournal
        </div>

        {[
          { to: '/dashboard', label: 'Dashboard', icon: '▦' },
          { to: '/journal', label: 'Journal', icon: '◈' },
          { to: '/import', label: 'Import', icon: '⇪' },
          { to: '/analysis', label: 'AI Analysis', icon: '🤖' },
        ].map(({ to, label, icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 8, color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            background: isActive ? 'rgba(108,99,255,0.12)' : 'transparent',
            fontWeight: isActive ? 600 : 400, transition: 'all 0.15s',
          })}>
            <span>{icon}</span> {label}
          </NavLink>
        ))}

        <button
          onClick={logout}
          className="btn-secondary"
          style={{ marginTop: 'auto', width: '100%' }}
        >
          Logout
        </button>
      </nav>

      <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
