import { NavLink, useNavigate } from 'react-router-dom'
import { useInstitutionStore } from '../../store/institutionStore'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, DoorOpen, Users, BookOpen, ClipboardList, Download, Settings, ExternalLink, ArrowLeftRight } from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rooms', label: 'Rooms', icon: DoorOpen },
  { to: '/teachers', label: 'Teachers', icon: Users },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/sections', label: 'Sections', icon: ClipboardList },
  { to: '/import', label: 'Import', icon: Download },
  { to: '/jobs', label: 'Jobs', icon: Settings },
]

export default function Sidebar() {
  const { institutionName, clearInstitution } = useInstitutionStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const handleSwitch = () => {
    clearInstitution()
    qc.clear()
    navigate('/')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-base border-r border-border flex flex-col z-50">
      <div className="p-5 border-b border-border">
        <h1 className="font-display text-lg font-bold tracking-tight text-accent">ChronoGen</h1>
        <p className="text-xs text-text-primary font-medium mt-1 truncate" title={institutionName}>
          {institutionName || 'No institution'}
        </p>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'border-l-2 border-accent bg-accent-dim text-text-primary'
                  : 'border-l-2 border-transparent text-text-secondary hover:text-text-primary hover:bg-elevated'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <button onClick={handleSwitch} className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent w-full">
          <ArrowLeftRight size={14} /> Switch Institution
        </button>
        <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer"
           className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent">
          <ExternalLink size={14} /> API Docs
        </a>
      </div>
    </aside>
  )
}
