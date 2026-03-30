import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getJob } from '../api/jobs'
import { downloadExport, downloadAllZip } from '../api/exports'
import { BASE_URL } from '../api/client'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'
import { formatDate, formatScore, truncateId } from '../utils/formatters'
import { Copy, Download, Eye, FileText, Image, FileJson } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts'
import toast from 'react-hot-toast'

import { DotLottieReact } from '@lottiefiles/dotlottie-react'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const nav = useNavigate()
  const [preview, setPreview] = useState<{ type: string, title: string, url: string, content?: string, loading?: boolean } | null>(null)

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

  const handlePreview = async (type: string, title: string) => {
    const url = `${BASE_URL}/api/v1/jobs/${jobId}/exports/${type}`
    if (type === 'convergence-plot') {
      setPreview({ type, title, url })
    } else {
      setPreview({ type, title, url, loading: true })
      try {
        const fetchRes = await fetch(url)
        let text = await fetchRes.text()
        
        // If it's an HTML report, we must fix relative image links (like convergence_plot.png) 
        // to point directly to the backend API export route to avoid broken images in the iframe.
        if (type === 'html-report') {
          const plotUrl = `${BASE_URL}/api/v1/jobs/${jobId}/exports/convergence-plot`
          text = text.replace(/src=["'][^"']*\bconvergence_plot\.png["']/gi, `src="${plotUrl}"`)
        }

        setPreview({ type, title, url, content: text, loading: false })
      } catch {
        toast.error('Failed to load preview')
        setPreview(null)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-code text-sm text-text-secondary">{truncateId(jobId!, 12)}</span>
          <button onClick={copyId} className="text-text-muted hover:text-accent"><Copy size={14} /></button>
          <Badge>{job.algorithm}</Badge>
          <Badge variant={job.status}>
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
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-8 flex flex-col items-center justify-center gap-5">
          <div className="w-64 h-64 sm:w-80 sm:h-80 aspect-square flex items-center justify-center relative">
            <DotLottieReact
              src="https://lottie.host/bd567b7c-53e5-4ee5-981e-918a05b6c55f/bNS86uJ1qE.lottie"
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <p className="text-sm font-medium text-blue-400">Job is {job.status}... generating timetable</p>
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
                  <YAxis stroke="#44445a" tick={{ fontSize: 11 }} domain={['dataMin - 100', 'dataMax + 100']} />
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
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} minPointSize={4}>
                    {constraintData.map((d, i) => <Cell key={`cell-${i}`} fill={d.fill || '#fff'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => nav(`/jobs/${jobId}/timetable`)}><Eye size={14} className="mr-1.5" />View Timetable</Button>
            <Button variant="secondary" onClick={() => downloadAllZip(jobId!)}><Download size={14} className="mr-1.5" />Download ZIP</Button>
            <Button variant="secondary" onClick={() => handlePreview('html-report', 'HTML Report')}><FileText size={14} className="mr-1.5" />HTML Report</Button>
            <Button variant="secondary" onClick={() => handlePreview('chromosome', 'Chromosome')}><FileJson size={14} className="mr-1.5" />Chromosome</Button>
            <Button variant="secondary" onClick={() => handlePreview('convergence-plot', 'Convergence Plot')}><Image size={14} className="mr-1.5" />Convergence Plot</Button>
          </div>
        </>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Preview: ${preview?.title}`} wide>
        {preview && (
          <div className="space-y-4">
            <div className="bg-elevated rounded border border-border flex justify-center items-start overflow-hidden overflow-y-auto max-h-[70vh]">
              {preview.loading ? (
                <div className="p-16"><Spinner size={32} /></div>
              ) : preview.type === 'convergence-plot' ? (
                <img src={preview.url} alt="Convergence Plot" className="w-full object-contain" />
              ) : preview.type === 'html-report' ? (
                <iframe srcDoc={preview.content} className="w-full h-[70vh] bg-white border-none" sandbox="allow-same-origin allow-scripts" />
              ) : (
                <pre className="text-[10px] font-code p-4 text-text-secondary w-full whitespace-pre-wrap">
                  {preview.content}
                </pre>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>Close</Button>
              <Button onClick={() => downloadExport(jobId!, preview.type)}><Download size={14} className="mr-1.5" />Download File</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
