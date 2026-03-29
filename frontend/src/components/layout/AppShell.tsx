import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useInstitutionStore } from '../../store/institutionStore'

export default function AppShell() {
  const { institutionId } = useInstitutionStore()
  if (!institutionId) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
