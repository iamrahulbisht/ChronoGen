import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getJob } from '../api/jobs'
import { downloadExport, downloadAllZip, exportUrl } from '../api/exports'
import api from '../api/client'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { formatDate, formatScore, truncateId } from '../utils/formatters'
import { Copy, Download, Eye, FileText, Image, FileJson, X } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts'
import toast from 'react-hot-toast'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

type PreviewType = 'html' | 'image' | 'json' | null

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const nav = useNavigate()

  const [preview, setPreview] = useState<PreviewType>(null)
  const [jsonContent, setJsonContent] = useState<string>('')
  const [jsonLoading, setJsonLoading] = useState(false)
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [htmlLoading, setHtmlLoading] = useState(false)

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

  // ── Fitness History data ──
  const fitnessData = (res?.fitness_history || []).map((h: Record<string, number>, i: number) => ({
    gen: i, best: h.best, mean: h.mean, worst: h.worst,
  }))

  let yMin = 0, yMax = 10000
  if (fitnessData.length > 0) {
    const allVals = fitnessData.flatMap((d: Record<string, number>) => [d.best, d.worst, d.mean].filter(v => v !== undefined && v !== null))
    const dataMin = Math.min(...allVals)
    const dataMax = Math.max(...allVals)
    const range = dataMax - dataMin || 1000
    yMin = Math.max(0, Math.floor(dataMin - range * 0.05))
    yMax = Math.ceil(dataMax + range * 0.05)
  }

  // ── Constraint Breakdown data ──
  const constraintData = bd ? Object.entries(bd).map(([k, v]) => ({
    name: k, value: v as number,
    fill: k.startsWith('H') ? '#ef4444' : (v as number) === 0 ? '#22c55e' : '#f59e0b',
  })) : []

  const copyId = () => { navigator.clipboard.writeText(jobId!); toast.success('Copied') }

  // ── Preview handlers ──
  const openHtmlPreview = async () => {
    setHtmlLoading(true)
    try {
      const res = await fetch(exportUrl(jobId!, 'html-report'))
      let text = await res.text()
      // Inject <base> so relative image paths (e.g. convergence_plot.png) resolve
      // to the backend's static file mount: /output/{jobId}/visual_charts/
      const baseHref = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/output/${jobId}/visual_charts/`
      text = text.replace(/<head>/i, `<head><base href="${baseHref}">`)
      setHtmlContent(text)
      setPreview('html')
    } catch (e) {
      toast.error('Failed to load HTML report')
    } finally {
      setHtmlLoading(false)
    }
  }
  const openImagePreview = () => setPreview('image')
  const openJsonPreview = async () => {
    setJsonLoading(true)
    try {
      const res = await api.get(exportUrl(jobId!, 'chromosome').replace(api.defaults.baseURL || '', ''))
      setJsonContent(JSON.stringify(res.data, null, 2))
      setPreview('json')
    } catch (e) {
      toast.error('Failed to load chromosome JSON')
    } finally {
      setJsonLoading(false)
    }
  }
  const closePreview = () => { setPreview(null); setJsonContent(''); setHtmlContent('') }

  // URLs for previews
  const convergencePlotUrl = exportUrl(jobId!, 'convergence-plot')

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

      {/* ── Running / Pending: Lottie Animation ── */}
      {isPolling && (
        <div className="bg-surface border border-blue-500/20 rounded-lg p-6 flex flex-col items-center gap-4">
          <DotLottieReact
            src="https://lottie.host/bd567b7c-53e5-4ee5-981e-918a05b6c55f/bNS86uJ1qE.lottie"
            loop autoplay style={{ width: 200, height: 200 }}
          />
          <div className="text-center">
            <p className="text-sm text-blue-400 font-medium">
              {job.status === 'pending' ? 'Queued — waiting to start...' : 'Algorithm is running...'}
            </p>
            <p className="text-xs text-text-muted mt-1">Checking every 3 seconds</p>
          </div>
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
          {/* ── Result Summary ── */}
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

          {/* ── Fitness History Chart ── */}
          {fitnessData.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-5">
              <h3 className="font-display text-sm font-bold mb-4">Fitness History</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={fitnessData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#242430" />
                  <XAxis dataKey="gen" stroke="#44445a" tick={{ fontSize: 11 }} label={{ value: 'Generation', position: 'insideBottom', offset: -2, fill: '#44445a', fontSize: 11 }} />
                  <YAxis stroke="#44445a" tick={{ fontSize: 11 }} domain={[yMin, yMax]} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 6, fontSize: 12, color: '#e8e8f0' }}
                    labelFormatter={(v) => `Gen ${v}`}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((v: number) => [v.toLocaleString()]) as any}
                  />
                  <ReferenceLine y={job.ga_config.target_fitness} stroke="#6c63ff" strokeDasharray="8 4" label={{ value: 'Target', fill: '#6c63ff', fontSize: 10 }} />
                  <Line type="monotone" dataKey="best" stroke="#6c63ff" strokeWidth={2} dot={false} name="Best" />
                  <Line type="monotone" dataKey="mean" stroke="#8888a0" strokeWidth={1} dot={false} name="Mean" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Constraint Breakdown ── */}
          {constraintData.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-5">
              <h3 className="font-display text-sm font-bold mb-4">Constraint Breakdown</h3>
              <ResponsiveContainer width="100%" height={constraintData.length * 34 + 40}>
                <BarChart layout="vertical" data={constraintData} margin={{ top: 5, right: 30, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#242430" horizontal={false} />
                  <XAxis type="number" stroke="#44445a" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" stroke="#44445a" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} width={150} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 6, fontSize: 12, color: '#e8e8f0' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>{constraintData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />Hard Constraint</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" />Soft Constraint (violations)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" />Zero Violations</span>
              </div>
            </div>
          )}

          {/* ── Action Buttons: View + Download ── */}
          <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-display text-sm font-bold">Exports</h3>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => nav(`/jobs/${jobId}/timetable`)}><Eye size={14} className="mr-1.5" />View Timetable</Button>
              <Button variant="secondary" onClick={() => downloadAllZip(jobId!)}><Download size={14} className="mr-1.5" />Download All (ZIP)</Button>
            </div>
            <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* HTML Report */}
              <div className="bg-elevated border border-border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-accent" />
                  <span className="text-sm font-medium">HTML Report</span>
                </div>
                <p className="text-xs text-text-muted">Full timetable report with styling</p>
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" onClick={openHtmlPreview} disabled={htmlLoading} className="flex-1">
                    {htmlLoading ? <Spinner size={12} /> : <><Eye size={12} className="mr-1" />View</>}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadExport(jobId!, 'html-report')}><Download size={12} /></Button>
                </div>
              </div>

              {/* Convergence Plot */}
              <div className="bg-elevated border border-border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Image size={16} className="text-green-400" />
                  <span className="text-sm font-medium">Convergence Plot</span>
                </div>
                <p className="text-xs text-text-muted">Fitness convergence chart (PNG)</p>
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" onClick={openImagePreview} className="flex-1"><Eye size={12} className="mr-1" />View</Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadExport(jobId!, 'convergence-plot')}><Download size={12} /></Button>
                </div>
              </div>

              {/* Chromosome JSON */}
              <div className="bg-elevated border border-border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <FileJson size={16} className="text-amber-400" />
                  <span className="text-sm font-medium">Chromosome JSON</span>
                </div>
                <p className="text-xs text-text-muted">Raw gene data for the best solution</p>
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" onClick={openJsonPreview} disabled={jsonLoading} className="flex-1">
                    {jsonLoading ? <Spinner size={12} /> : <><Eye size={12} className="mr-1" />View</>}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadExport(jobId!, 'chromosome')}><Download size={12} /></Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════ Preview Modals ══════════ */}

      {/* HTML Report Preview */}
      {preview === 'html' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={closePreview}>
          <div className="w-[90vw] h-[85vh] bg-surface border border-border rounded-lg flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-elevated">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-accent" />
                <span className="font-display text-sm font-bold">HTML Report</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => downloadExport(jobId!, 'html-report')}>
                  <Download size={12} className="mr-1" />Download
                </Button>
                <button onClick={closePreview} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
              </div>
            </div>
            <iframe
              srcDoc={htmlContent}
              className="flex-1 w-full bg-white"
              title="HTML Report"
            />
          </div>
        </div>
      )}

      {/* Convergence Plot Preview */}
      {preview === 'image' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={closePreview}>
          <div className="max-w-[90vw] max-h-[90vh] bg-surface border border-border rounded-lg flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-elevated">
              <div className="flex items-center gap-2">
                <Image size={16} className="text-green-400" />
                <span className="font-display text-sm font-bold">Convergence Plot</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => downloadExport(jobId!, 'convergence-plot')}>
                  <Download size={12} className="mr-1" />Download
                </Button>
                <button onClick={closePreview} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
              </div>
            </div>
            <div className="p-4 flex justify-center overflow-auto">
              <img
                src={convergencePlotUrl}
                alt="Convergence Plot"
                className="max-w-full max-h-[75vh] rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Chromosome JSON Preview */}
      {preview === 'json' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={closePreview}>
          <div className="w-[80vw] h-[85vh] bg-surface border border-border rounded-lg flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-elevated">
              <div className="flex items-center gap-2">
                <FileJson size={16} className="text-amber-400" />
                <span className="font-display text-sm font-bold">Chromosome JSON</span>
                <span className="text-xs text-text-muted ml-2">{(jsonContent.length / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => downloadExport(jobId!, 'chromosome')}>
                  <Download size={12} className="mr-1" />Download
                </Button>
                <button onClick={closePreview} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-5 text-xs font-code text-text-secondary leading-relaxed">
              {jsonContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
