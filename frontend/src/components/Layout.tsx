import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, PieChart, Upload, Settings, LogOut, TrendingUp, Wallet } from 'lucide-react'
import { useAuthStore } from '../store/auth'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/categories', icon: PieChart, label: 'Categories' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 flex-shrink-0 sidebar flex flex-col">
        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white"/>
            </div>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>MyFinance</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon className="w-4 h-4"/>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{user?.username}</span>
            <button onClick={() => { logout(); navigate('/login') }}
              className="transition-colors hover:text-red-400"
              style={{ color: 'var(--text-muted)' }} title="Logout">
              <LogOut className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto main-content">
        <Outlet/>
      </main>
    </div>
  )
}
