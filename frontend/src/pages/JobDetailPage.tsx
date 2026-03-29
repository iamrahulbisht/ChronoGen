import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getJob } from '../api/jobs'
import { downloadExport, downloadAllZip } from '../api/exports'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { formatDate, formatScore, truncateId } from '../utils/formatters'
import { Copy, Download, Eye, FileText, Image, FileJson } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts'
import toast from 'react-hot-toast'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const nav = useNavigate()

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'pending' || s === 'running' ? 3000 : false
    },
  })

  if (isLoading || !job) return <div className="flex justify-center py-20"><Spinner size={32} /></div>

  const isPolling = job.status === 'pending' || job.status === 'running'
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const res = job.result
  const bd = res?.constraint_breakdown

  const fitnessData = (res?.fitness_history || []).map((h: Record<string, number>, i: number) => ({ gen: i, ...h }))

  const constraintData = bd ? Object.entries(bd).map(([k, v]) => ({
    name: k, value: v as number, fill: k.startsWith('H') ? '#ef4444' : v === 0 ? '#22c55e' : '#f59e0b',
  })) : []

  const copyId = () => { navigator.clipboard.writeText(jobId!); toast.success('Copied') }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-code text-sm text-text-secondary">{truncateId(jobId!, 12)}</span>
          <button onClick={copyId} className="text-text-muted hover:text-accent"><Copy size={14} /></button>
          <Badge>{job.algorithm}</Badge>
          <Badge variant={job.status}>
            {isPolling && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-1.5" />}
            {job.status}
          </Badge>
        </div>
        <div className="flex gap-6 text-xs text-text-secondary">
          <span>Created: {formatDate(job.created_at)}</span>
          {job.started_at && <span>Started: {formatDate(job.started_at)}</span>}
          {job.completed_at && <span>Completed: {formatDate(job.completed_at)}</span>}
        </div>
      </div>

      {isPolling && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-5 flex items-center gap-3">
          <Spinner size={18} />
          <span className="text-sm text-blue-400">Job is {job.status}... checking every 3 seconds</span>
          <div className="flex-1 h-1 bg-elevated rounded overflow-hidden"><div className="h-full bg-accent animate-pulse rounded" style={{ width: '60%' }} /></div>
        </div>
      )}

      {isFailed && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-5 space-y-3">
          <p className="text-sm text-danger font-medium">Job Failed</p>
          <pre className="text-xs text-text-secondary font-code bg-elevated rounded p-3 overflow-x-auto max-h-60">{job.error_message}</pre>
        </div>
      )}

      {isCompleted && res && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[{ label: 'Fitness Score', value: formatScore(res.fitness_score), color: 'text-accent' },
              { label: 'Total Penalty', value: formatScore(res.total_penalty), color: 'text-warning' },
              { label: 'Generations', value: formatScore(res.generations_run), color: 'text-text-primary' },
            ].map(s => (
              <div key={s.label} className="bg-surface border border-border rounded-lg p-4">
                <p className="text-xs text-text-secondary mb-1">{s.label}</p>
                <p className={`font-display text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {fitnessData.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-5">
              <h3 className="font-display text-sm font-bold mb-4">Fitness History</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={fitnessData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#242430" />
                  <XAxis dataKey="gen" stroke="#44445a" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#44445a" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 6, fontSize: 12 }} />
                  <ReferenceLine y={job.ga_config.target_fitness} stroke="#6c63ff" strokeDasharray="8 4" label={{ value: 'Target', fill: '#6c63ff', fontSize: 10 }} />
                  <Line type="monotone" dataKey="best" stroke="#6c63ff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {constraintData.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-5">
              <h3 className="font-display text-sm font-bold mb-4">Constraint Breakdown</h3>
              <ResponsiveContainer width="100%" height={constraintData.length * 30 + 40}>
                <BarChart layout="vertical" data={constraintData} margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#242430" horizontal={false} />
                  <XAxis type="number" stroke="#44445a" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" stroke="#44445a" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} width={110} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>{constraintData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => nav(`/jobs/${jobId}/timetable`)}><Eye size={14} className="mr-1.5" />View Timetable</Button>
            <Button variant="secondary" onClick={() => downloadAllZip(jobId!)}><Download size={14} className="mr-1.5" />Download ZIP</Button>
            <Button variant="secondary" onClick={() => downloadExport(jobId!, 'html-report')}><FileText size={14} className="mr-1.5" />HTML Report</Button>
            <Button variant="secondary" onClick={() => downloadExport(jobId!, 'chromosome')}><FileJson size={14} className="mr-1.5" />Chromosome</Button>
            <Button variant="secondary" onClick={() => downloadExport(jobId!, 'convergence-plot')}><Image size={14} className="mr-1.5" />Convergence Plot</Button>
          </div>
        </>
      )}
    </div>
  )
}
