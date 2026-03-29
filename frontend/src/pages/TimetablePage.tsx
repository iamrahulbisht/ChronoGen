import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getTimetable, getJob } from '../api/jobs'
import { downloadExport, downloadAllZip } from '../api/exports'
import { getInstitution } from '../api/institutions'
import { useInstitutionStore } from '../store/institutionStore'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import { ArrowLeft, Download } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
type ViewMode = 'class' | 'teacher' | 'room'

export default function TimetablePage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { institutionId } = useInstitutionStore()
  const [view, setView] = useState<ViewMode>('class')
  const [selected, setSelected] = useState('')
  const [pareto, setPareto] = useState(0)

  const { data: job } = useQuery({ queryKey: ['job', jobId], queryFn: () => getJob(jobId!) })
  const { data: inst } = useQuery({ queryKey: ['institution', institutionId], queryFn: () => getInstitution(institutionId!) })
  const { data: tt, isLoading } = useQuery({ queryKey: ['timetable', jobId, pareto], queryFn: () => getTimetable(jobId!, pareto) })

  const lunchAfter = inst?.lunch_break_after_period ?? 4
  const periodsPerDay = inst?.periods_per_day ?? 8

  const entities = tt ? (view === 'class' ? Object.keys(tt.timetable) : view === 'teacher' ? Object.keys(tt.teacher_timetable) : Object.keys(tt.room_timetable)).sort() : []
  const sel = selected || entities[0] || ''

  const getGrid = () => {
    if (!tt || !sel) return null
    if (view === 'class') return tt.timetable[sel]
    if (view === 'teacher') return tt.teacher_timetable[sel]
    return tt.room_timetable[sel]
  }
  const grid = getGrid()

  const handleExportCsv = () => {
    if (view === 'class') downloadExport(jobId!, 'student-csv', sel)
    else if (view === 'teacher') downloadExport(jobId!, 'teacher-csv', sel.replace(/ /g, '_'))
    else downloadExport(jobId!, 'room-csv', sel.replace(/ /g, '_'))
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 bg-base z-10 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <Link to={`/jobs/${jobId}`} className="text-sm text-accent hover:text-accent-hover flex items-center gap-1"><ArrowLeft size={14} />Job Detail</Link>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleExportCsv}><Download size={12} className="mr-1" />Export CSV</Button>
            <Button size="sm" variant="secondary" onClick={() => downloadAllZip(jobId!)}><Download size={12} className="mr-1" />ZIP All</Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-elevated rounded overflow-hidden border border-border">
            {(['class', 'teacher', 'room'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => { setView(v); setSelected('') }}
                className={`px-4 py-1.5 text-xs font-medium capitalize ${view === v ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>{v}</button>
            ))}
          </div>
          <select className="bg-elevated border border-border text-sm text-text-primary rounded px-3 py-1.5 focus:border-accent focus:outline-none max-w-xs" value={sel} onChange={e => setSelected(e.target.value)}>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {job?.algorithm === 'nsga2' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Pareto #</span>
              <input type="number" min={0} value={pareto} onChange={e => setPareto(+e.target.value)} className="w-16 bg-elevated border border-border text-sm rounded px-2 py-1 focus:border-accent focus:outline-none" />
            </div>
          )}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Spinner size={32} /></div> : !grid ? <p className="text-text-muted text-sm py-8 text-center">No timetable data</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr><th className="bg-elevated px-3 py-2 text-text-secondary border border-border w-16">Period</th>
                {DAYS.map(d => <th key={d} className="bg-elevated px-3 py-2 text-text-secondary border border-border min-w-[140px]">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(p => (
                <>
                  {p - 1 === lunchAfter && (
                    <tr key={`lunch-${p}`}><td colSpan={DAYS.length + 1} className="bg-elevated text-center text-text-muted text-[10px] uppercase tracking-widest py-1.5 border border-border">Lunch Break</td></tr>
                  )}
                  <tr key={p}>
                    <td className="bg-elevated text-center font-code text-text-secondary border border-border py-2 font-medium">{p}</td>
                    {DAYS.map(d => {
                      const slot = (grid[d] || {})[String(p)]
                      if (!slot) return <td key={d} className="bg-free-slot border border-border text-center text-text-muted px-2 py-2">FREE</td>

                      const subj = (slot as Record<string, unknown>).subject as string
                      const isFree = subj === 'FREE'
                      const isLab = (slot as Record<string, unknown>).is_lab || subj?.endsWith('(L)')

                      if (isFree) return <td key={d} className="bg-free-slot border border-border text-center text-text-muted px-2 py-2">FREE</td>

                      let line1 = '', line2 = '', line3 = ''
                      if (view === 'class') {
                        line1 = subj; line2 = (slot as Record<string, unknown>).teacher as string || ''; line3 = (slot as Record<string, unknown>).room as string || ''
                      } else if (view === 'teacher') {
                        line1 = (slot as Record<string, unknown>).class as string || subj; line2 = (slot as Record<string, unknown>).subject as string || subj; line3 = (slot as Record<string, unknown>).room as string || ''
                      } else {
                        line1 = (slot as Record<string, unknown>).class as string || subj; line2 = (slot as Record<string, unknown>).subject as string || subj; line3 = (slot as Record<string, unknown>).teacher as string || ''
                      }

                      return (
                        <td key={d} className={`border border-border px-2 py-1.5 ${isLab ? 'border-l-2 border-l-lab-badge' : ''}`}>
                          <p className="font-medium text-text-primary truncate">{line1}</p>
                          <p className="text-text-secondary truncate">{line2}</p>
                          <p className="text-text-muted truncate">{line3}</p>
                          {isLab && <Badge variant="lab">Lab</Badge>}
                        </td>
                      )
                    })}
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
