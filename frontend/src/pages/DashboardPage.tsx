import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useInstitutionStore } from '../store/institutionStore'
import { listRooms } from '../api/institutions'
import { listTeachers } from '../api/teachers'
import { listSubjects } from '../api/subjects'
import { listSections } from '../api/sections'
import { listJobs } from '../api/jobs'
import { validateInstitution } from '../api/institutions'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { DoorOpen, Users, BookOpen, ClipboardList, Settings, Upload, CheckCircle, AlertTriangle } from 'lucide-react'
import { truncateId, formatDate } from '../utils/formatters'
import { useState } from 'react'

export default function DashboardPage() {
  const { institutionId } = useInstitutionStore()
  const navigate = useNavigate()
  const [showValidation, setShowValidation] = useState(false)
  const [validationResult, setValidationResult] = useState<Record<string, unknown> | null>(null)
  const [validating, setValidating] = useState(false)

  const id = institutionId!
  const rooms = useQuery({ queryKey: ['rooms', id], queryFn: () => listRooms(id) })
  const teachers = useQuery({ queryKey: ['teachers', id], queryFn: () => listTeachers(id) })
  const subjects = useQuery({ queryKey: ['subjects', id], queryFn: () => listSubjects(id) })
  const sections = useQuery({ queryKey: ['sections', id], queryFn: () => listSections(id) })
  const jobs = useQuery({ queryKey: ['jobs', id], queryFn: () => listJobs(id) })

  const stats = [
    { label: 'Rooms', count: rooms.data?.length ?? 0, icon: DoorOpen, color: 'text-violet-400' },
    { label: 'Teachers', count: teachers.data?.length ?? 0, icon: Users, color: 'text-blue-400' },
    { label: 'Subjects', count: subjects.data?.length ?? 0, icon: BookOpen, color: 'text-amber-400' },
    { label: 'Sections', count: sections.data?.length ?? 0, icon: ClipboardList, color: 'text-green-400' },
    { label: 'Jobs', count: jobs.data?.length ?? 0, icon: Settings, color: 'text-accent' },
  ]

  const handleValidate = async () => {
    setValidating(true)
    try {
      const res = await validateInstitution(id)
      setValidationResult(res)
      setShowValidation(true)
    } catch (err: unknown) {
      setValidationResult({ valid: false, errors: [(err as Error).message] })
      setShowValidation(true)
    } finally { setValidating(false) }
  }

  const recentJobs = (jobs.data || []).slice(0, 5)

  return (
    <div className="space-y-8">
      <h2 className="font-display text-2xl font-bold tracking-tight">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className={s.color} />
              <span className="text-xs text-text-secondary uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="font-display text-2xl font-bold tabular-nums">{s.count}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => navigate('/import')} variant="secondary" size="sm"><Upload size={14} className="mr-1.5" />Upload JSON</Button>
        <Button onClick={handleValidate} variant="secondary" size="sm" disabled={validating}>
          {validating ? <Spinner size={14} /> : <CheckCircle size={14} className="mr-1.5" />}Validate Setup
        </Button>
        <Button onClick={() => navigate('/jobs')} size="sm"><Settings size={14} className="mr-1.5" />New Job</Button>
      </div>

      {recentJobs.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex justify-between items-center">
            <h3 className="font-display text-sm font-bold tracking-tight">Recent Jobs</h3>
            <button onClick={() => navigate('/jobs')} className="text-xs text-accent hover:text-accent-hover">View all →</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-elevated text-text-secondary uppercase tracking-wider text-xs">
              <th className="text-left px-5 py-2">Job ID</th><th className="text-left px-5 py-2">Algorithm</th>
              <th className="text-left px-5 py-2">Status</th><th className="text-left px-5 py-2">Created</th>
              <th className="text-left px-5 py-2">Actions</th>
            </tr></thead>
            <tbody>
              {recentJobs.map((j) => (
                <tr key={j.job_id} className="border-b border-border hover:bg-elevated transition-colors">
                  <td className="px-5 py-2.5 font-code text-xs">{truncateId(j.job_id)}</td>
                  <td className="px-5 py-2.5"><Badge>{j.algorithm}</Badge></td>
                  <td className="px-5 py-2.5"><Badge variant={j.status}>{j.status}</Badge></td>
                  <td className="px-5 py-2.5 text-text-secondary text-xs">{formatDate(j.created_at)}</td>
                  <td className="px-5 py-2.5">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/jobs/${j.job_id}`)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showValidation} onClose={() => setShowValidation(false)} title="Validation Result">
        {validationResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {(validationResult as Record<string, unknown>).valid
                ? <><CheckCircle size={20} className="text-success" /><span className="text-success font-medium">Valid</span></>
                : <><AlertTriangle size={20} className="text-danger" /><span className="text-danger font-medium">Invalid</span></>
              }
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="bg-elevated rounded p-2 text-center"><p className="text-text-secondary">Slots</p><p className="font-display font-bold">{(validationResult as Record<string, unknown>).total_slots as number ?? 0}</p></div>
              <div className="bg-elevated rounded p-2 text-center"><p className="text-text-secondary">Sections</p><p className="font-display font-bold">{(validationResult as Record<string, unknown>).sections as number ?? 0}</p></div>
              <div className="bg-elevated rounded p-2 text-center"><p className="text-text-secondary">Teachers</p><p className="font-display font-bold">{(validationResult as Record<string, unknown>).teachers as number ?? 0}</p></div>
              <div className="bg-elevated rounded p-2 text-center"><p className="text-text-secondary">Rooms</p><p className="font-display font-bold">{(validationResult as Record<string, unknown>).rooms as number ?? 0}</p></div>
            </div>
            {((validationResult as Record<string, unknown>).errors as string[] || []).length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {((validationResult as Record<string, unknown>).errors as string[]).map((e: string, i: number) => (
                  <div key={i} className="text-xs text-danger bg-red-500/5 border border-red-500/20 rounded px-3 py-2">{e}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
