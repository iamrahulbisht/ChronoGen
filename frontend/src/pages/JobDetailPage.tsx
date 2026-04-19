import { useState } from 'react'
<<<<<<< Updated upstream
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
<<<<<<< HEAD
=======
=======
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getJob, getTimetable } from '../api/jobs'
import { getInstitution } from '../api/institutions'
import { downloadExport, downloadAllZip } from '../api/exports'
import { useInstitutionStore } from '../store/institutionStore'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { formatDate, truncateId, formatScore } from '../utils/formatters'
import { Copy, Download, Undo2, Redo2, Trash2, Plus, ArrowLeft, TrendingUp, Calendar, FileText, FileJson, Image, CheckCircle2, AlertCircle } from 'lucide-react'
import ImpactPanel from '../components/ImpactPanel'
import { analyzeChange, commitChange, undoChange, redoChange, getSubstitutes } from '../api/analyzer'
import type { AnalyzeChangeResponse, SubstituteTeacher } from '../api/analyzer'
>>>>>>> Stashed changes
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area } from 'recharts'
import { BASE_URL } from '../api/client'
import Modal from '../components/ui/Modal'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const CONSTRAINT_DESCRIPTIONS: Record<string, string> = {
    'H1_teacher_clash': 'Teacher is already busy in another class during this time.',
    'H2_class_clash': 'This section already has another subject scheduled in this period.',
    'H3_room_clash': 'The room is already occupied by another class.',
    'H_LAB1_odd_period': 'Labs must start at an odd period (1, 3, 5, 7) for 2-hour blocks.',
    'H_LAB2_next_free': 'The period following a lab start must also be free for the block.',
    'S1_missing_lectures': 'Not enough lectures scheduled for this subject per week.',
    'S2_teacher_overload': 'Teacher has exceeded their maximum weekly lecture limit.',
    'S3_consecutive': 'Same subject scheduled in back-to-back periods (Non-Lab).',
    'S4_same_subj_day': 'Subject appearing more than once in a single day.',
    'S5_class_gaps': 'Students have empty gaps between their classes.',
    'S6_teacher_gaps': 'Teachers have long idle gaps between their lectures.',
    'S8_morning_pref': 'Core subjects are preferred in morning periods.',
    'S9_late_period': 'Avoid scheduling difficult subjects in the last periods.',
    'S10_room_spread': 'Classes of the same year are spread too far apart across rooms.'
};
type ViewMode = 'class' | 'teacher' | 'room'
type TabMode = 'timetable' | 'analytics'
>>>>>>> cc0e994 (added API folder which holds the routes and schemas, resolved branch conflicts, and stabilized timetable editor)

import { DotLottieReact } from '@lottiefiles/dotlottie-react'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { institutionId } = useInstitutionStore()
  const nav = useNavigate()
<<<<<<< HEAD
  const [preview, setPreview] = useState<{ type: string, title: string, url: string, content?: string, loading?: boolean } | null>(null)
=======
<<<<<<< Updated upstream

  const [preview, setPreview] = useState<PreviewType>(null)
  const [jsonContent, setJsonContent] = useState<string>('')
  const [jsonLoading, setJsonLoading] = useState(false)
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [htmlLoading, setHtmlLoading] = useState(false)
=======
  const queryClient = useQueryClient()
  
  // Tabs
  const [activeTab, setActiveTab] = useState<TabMode>('timetable')
  
  // View states
  const [view, setView] = useState<ViewMode>('class')
  const [selected, setSelected] = useState('')
  const [pareto, setPareto] = useState(0)
  const [preview, setPreview] = useState<{ type: string, title: string, url: string, content?: string, loading?: boolean } | null>(null)
  const [substitutes, setSubstitutes] = useState<SubstituteTeacher[] | null>(null);
  const [isFindingSubstitutes, setIsFindingSubstitutes] = useState(false);
>>>>>>> Stashed changes
>>>>>>> cc0e994 (added API folder which holds the routes and schemas, resolved branch conflicts, and stabilized timetable editor)

  // Edit states
  const [sourceSlot, setSourceSlot] = useState<{class_id: string, day: number, period: number, isFree?: boolean} | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalyzeChangeResponse | null>(null)
  const [simulatedChanges, setSimulatedChanges] = useState<any[] | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ subject: 'EXTRA', teacher: 'T1', room: '101' })

  // Data fetching
  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    refetchInterval: (q) => (q.state.data?.status === 'pending' || q.state.data?.status === 'running' ? 1000 : false),
  })

  const { data: inst } = useQuery({ queryKey: ['institution', institutionId], queryFn: () => getInstitution(institutionId!), enabled: !!institutionId })
  const { data: tt, isLoading: ttLoading } = useQuery({ 
    queryKey: ['timetable', jobId, pareto], 
    queryFn: () => getTimetable(jobId!, pareto),
    enabled: job?.status === 'completed'
  })

  const isCompleted = job?.status === 'completed'
  const isPolling = job?.status === 'pending' || job?.status === 'running'
  const isFailed = job?.status === 'failed'

<<<<<<< HEAD
  const fitnessData = (res?.fitness_history || []).map((h: Record<string, number>, i: number) => ({ gen: i, ...h }))

  const constraintData = bd ? Object.entries(bd).map(([k, v]) => ({
    name: k, value: v as number, fill: k.startsWith('H') ? '#ef4444' : v === 0 ? '#22c55e' : '#f59e0b',
  })) : []
=======
  const lunchAfter = inst?.lunch_break_after_period ?? 4
  const periodsPerDay = inst?.periods_per_day ?? 8
  const entities = tt ? (view === 'class' ? Object.keys(tt.timetable) : view === 'teacher' ? Object.keys(tt.teacher_timetable) : Object.keys(tt.room_timetable)).sort() : []
  const sel = selected || entities[0] || ''
  const grid = tt ? (view === 'class' ? tt.timetable[sel] : view === 'teacher' ? tt.teacher_timetable[sel] : tt.room_timetable[sel]) : null

  // Analytics Data
  const res = job?.result
  const fitnessHistoryRaw = res?.fitness_history || []
  const fitnessData = fitnessHistoryRaw.map((h: any, i: number) => ({ gen: i, ...h }))
  
  // Flatten breakdown if it's nested (compatibility for older jobs)
  const rawBreakdown = res?.constraint_breakdown || {}
  const flatBreakdown: Record<string, number> = {}
  
  if (rawBreakdown.hard_penalties || rawBreakdown.soft_penalties) {
    Object.assign(flatBreakdown, rawBreakdown.hard_penalties || {})
    Object.assign(flatBreakdown, rawBreakdown.soft_penalties || {})
  } else {
    Object.assign(flatBreakdown, rawBreakdown)
  }

  // Include ALL defined constraints, even if 0, to show a complete status
  const constraintData = Object.keys(CONSTRAINT_DESCRIPTIONS).map(key => {
    const val = flatBreakdown[key] || 0
    return {
      name: key,
      value: val,
      fill: key.startsWith('H') ? (val > 0 ? '#ef4444' : '#22c55e') : (val > 0 ? '#f59e0b' : '#22c55e'),
    }
  })
>>>>>>> cc0e994 (added API folder which holds the routes and schemas, resolved branch conflicts, and stabilized timetable editor)

  // Handlers
  const copyId = () => { navigator.clipboard.writeText(jobId!); toast.success('Copied ID') }
  const handleExportCsv = () => {
     if (view === 'class') downloadExport(jobId!, 'student-csv', sel)
     else if (view === 'teacher') downloadExport(jobId!, 'teacher-csv', sel.replace(/ /g, '_'))
     else downloadExport(jobId!, 'room-csv', sel.replace(/ /g, '_'))
  }

<<<<<<< HEAD
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
=======
  const handleSlotClick = async (dayIndex: number, period: number, slotData: any) => {
    const isFree = !slotData || slotData.subject === 'FREE';
    const actualPeriod = slotData?.is_lab_second_hour ? period - 1 : period;

    // Resolve the class_id based on the current view
    let classId: string | undefined;
    if (view === 'class') {
      classId = sel; 
    } else if (slotData && (slotData as any).class) {
      classId = (slotData as any).class;
    }

    if (!sourceSlot) {
      // First click: selecting a SOURCE
      if (!classId || (isFree && view !== 'class')) return; 
      setSourceSlot({ class_id: classId, day: dayIndex + 1, period: actualPeriod, isFree, data: slotData });
      return;
    }

    // Toggle logic: if clicking the exact same slot again, unselect
    if (sourceSlot.day === dayIndex + 1 && 
        sourceSlot.period === actualPeriod && 
        sourceSlot.class_id === (classId || sourceSlot.class_id)) {
      handleCancel();
      return;
    }

    // If we already have a source, this click is a TARGET for a move/swap
    if (sourceSlot.isFree) { 
      // If previous selection was just an empty slot, treat this click as a new SOURCE selection
      if (!classId || (isFree && view !== 'class')) return;
      setSourceSlot({ class_id: classId, day: dayIndex + 1, period: actualPeriod, isFree, data: slotData }); 
      return; 
    }
      setIsAnalyzing(true);
      try {
        const changes = [{ 
          class_id: sourceSlot.class_id, 
          day: sourceSlot.day, 
          period: sourceSlot.period, 
          new_day: dayIndex + 1, 
          new_period: actualPeriod 
        }];

        // If target slot is occupied, perform a SWAP
        if (!isFree && classId) {
          changes.push({
            class_id: classId,
            day: dayIndex + 1,
            period: actualPeriod,
            new_day: sourceSlot.day,
            new_period: sourceSlot.period
          });
        }

        const result = await analyzeChange(jobId!, changes);
        setSimulatedChanges(changes);
        setAnalysisResult(result);
      } catch (e) { 
        console.error(e); 
        toast.error('Analysis failed. Please check if IDs are valid.');
      } finally { setIsAnalyzing(false); }
  };

  const handleCancel = () => { 
    setSourceSlot(null); 
    setAnalysisResult(null); 
    setSimulatedChanges(null);
    setIsAnalyzing(false); 
    setSubstitutes(null);
    setIsFindingSubstitutes(false);
  };
  const handleApply = async (newChromosome: any[]) => { await commitChange(jobId!, newChromosome); queryClient.invalidateQueries({ queryKey: ['timetable', jobId, pareto] }); handleCancel(); };
  const handleUndo = async () => { await undoChange(jobId!); queryClient.invalidateQueries({ queryKey: ['timetable', jobId, pareto] }); };
  const handleRedo = async () => { await redoChange(jobId!); queryClient.invalidateQueries({ queryKey: ['timetable', jobId, pareto] }); };

  const handleFindSubstitutes = async () => {
    if (!sourceSlot || sourceSlot.isFree) return;
    setIsFindingSubstitutes(true);
    try {
      const res = await getSubstitutes(jobId!, sourceSlot.class_id, sourceSlot.day, sourceSlot.period);
      setSubstitutes(res.substitutes);
    } catch (e) { 
      console.error(e); 
      toast.error('Failed to find substitutes');
    } finally { setIsFindingSubstitutes(false); }
  };

  const handleDeleteSlot = async () => {
    if (!sourceSlot || sourceSlot.isFree) return;
    setIsAnalyzing(true);
    try {
      const changes = [{ class_id: sourceSlot.class_id, day: sourceSlot.day, period: sourceSlot.period, new_day: 0, new_period: 0 }];
      const result = await analyzeChange(jobId!, changes);
      setSimulatedChanges(changes);
      setAnalysisResult(result);
    } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
  };

  const handleAddSlot = async (subject: string, teacher: string, room: string) => {
    if (!sourceSlot || !sourceSlot.isFree) return;
    setIsAnalyzing(true);
    try {
      const changes = [{ 
        class_id: sourceSlot.class_id, 
        day: 0, period: 0, // 0 denotes "new"
        new_day: sourceSlot.day, 
        new_period: sourceSlot.period,
        subject_id: subject,
        new_teacher_id: teacher,
        new_room_id: room
      }];
      const result = await analyzeChange(jobId!, changes);
      setSimulatedChanges(changes);
      setAnalysisResult(result);
    } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
  };

<<<<<<< Updated upstream
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
=======
  const handlePreview = async (type: string, title: string) => {
    const url = `${BASE_URL}/api/v1/jobs/${jobId}/exports/${type}`
    if (type === 'convergence-plot') { setPreview({ type, title, url }) } 
    else {
      setPreview({ type, title, url, loading: true })
      try {
        const fetchRes = await fetch(url); let text = await fetchRes.text()
>>>>>>> cc0e994 (added API folder which holds the routes and schemas, resolved branch conflicts, and stabilized timetable editor)
        if (type === 'html-report') {
          const plotUrl = `${BASE_URL}/api/v1/jobs/${jobId}/exports/convergence-plot`
          text = text.replace(/src=["'][^"']*\bconvergence_plot\.png["']/gi, `src="${plotUrl}"`)
        }
<<<<<<< HEAD
=======
        setPreview({ type, title, url, content: text, loading: false })
      } catch { toast.error('Failed to load preview'); setPreview(null) }
>>>>>>> Stashed changes
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
>>>>>>> cc0e994 (added API folder which holds the routes and schemas, resolved branch conflicts, and stabilized timetable editor)

        setPreview({ type, title, url, content: text, loading: false })
      } catch {
        toast.error('Failed to load preview')
        setPreview(null)
      }
    }
  }

  if (jobLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>

  return (
<<<<<<< Updated upstream
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
=======
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Header Bar */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-4 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Link to="/jobs" className="p-2 hover:bg-elevated rounded-full text-text-secondary transition-colors"><ArrowLeft size={16} /></Link>
             <div className="flex flex-col">
               <div className="flex items-center gap-2">
                 <span className="font-bold text-sm text-text-primary">Job Detail</span>
                 <Badge variant={job.status}>{job.status}</Badge>
               </div>
               <span className="font-code text-[10px] text-text-muted">{truncateId(jobId!, 16)}</span>
             </div>
          </div>

          {isCompleted && (
            <div className="flex bg-elevated rounded-xl p-1 border border-border">
              <button 
                onClick={() => setActiveTab('timetable')}
                className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'timetable' ? 'bg-accent text-white shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Schedule Grid
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-accent text-white shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
              >
                <TrendingUp size={14} className="inline mr-2" /> Analytics
              </button>
            </div>
          )}

          <div className="flex gap-2">
             <Button size="sm" variant="secondary" onClick={() => downloadAllZip(jobId!)} className="h-9"><Download size={14} /></Button>
          </div>
>>>>>>> Stashed changes
        </div>
      </div>

      {isPolling && (
<<<<<<< HEAD
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-8 flex flex-col items-center justify-center gap-5">
          <div className="w-64 h-64 sm:w-80 sm:h-80 aspect-square flex items-center justify-center relative">
            <DotLottieReact
              src="https://lottie.host/bd567b7c-53e5-4ee5-981e-918a05b6c55f/bNS86uJ1qE.lottie"
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
=======
<<<<<<< Updated upstream
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
>>>>>>> cc0e994 (added API folder which holds the routes and schemas, resolved branch conflicts, and stabilized timetable editor)
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
<<<<<<< HEAD
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>Close</Button>
              <Button onClick={() => downloadExport(jobId!, preview.type)}><Download size={14} className="mr-1.5" />Download File</Button>
=======
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
=======
        <div className="flex-1 flex flex-col items-center justify-center bg-surface/30 rounded-2xl border border-dashed border-border p-12">
          <div className="w-64 h-64">
             <DotLottieReact src="https://lottie.host/bd567b7c-53e5-4ee5-981e-918a05b6c55f/bNS86uJ1qE.lottie" loop autoplay />
          </div>
          <h2 className="text-2xl font-black text-text-primary mt-8 mb-2">EVOLVING TIMETABLE</h2>
          <p className="text-text-secondary text-sm font-medium mb-10 max-w-md text-center">
            The Genetic Algorithm is processing millions of combinations to find the most optimal schedule for your institution.
          </p>
          
          {job.progress && (
            <div className="w-full max-w-xl space-y-4">
              <div className="flex justify-between items-end mb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-1">Evolution Progress</span>
                  <span className="text-sm font-bold text-text-primary">Generation {job.progress.current_generation} / {job.progress.max_generations}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">Current Best Fitness</span>
                  <p className="text-sm font-bold text-success tabular-nums">{job.progress.best_fitness.toLocaleString()}</p>
                </div>
              </div>
              <div className="h-4 w-full bg-elevated rounded-full overflow-hidden border border-border shadow-inner">
                <div 
                  className="h-full bg-accent transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(108,99,255,0.4)] relative"
                  style={{ width: `${Math.round((job.progress.current_generation / job.progress.max_generations) * 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
              </div>
              <p className="text-[10px] text-center text-text-muted font-bold uppercase tracking-widest pt-2">
                {Math.round((job.progress.current_generation / job.progress.max_generations) * 100)}% Complete
              </p>
            </div>
          )}
          {!job.progress && <p className="text-accent font-medium animate-pulse">Initializing engine...</p>}
        </div>
      )}

      {isCompleted && (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {activeTab === 'timetable' ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-4 pr-2">
                {/* Controls */}
                <div className="flex items-center gap-3 bg-elevated/30 p-2 rounded-xl border border-border/50 flex-shrink-0">
                  <div className="flex bg-elevated rounded-lg p-1 border border-border">
                    {(['class', 'teacher', 'room'] as ViewMode[]).map(v => (
                      <button key={v} onClick={() => { setView(v); setSelected('') }}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${view === v ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}>{v}</button>
                    ))}
                  </div>
                  <select className="h-9 bg-elevated border border-border text-sm font-medium text-text-primary rounded-lg px-4 focus:outline-none min-w-[180px]" value={sel} onChange={e => setSelected(e.target.value)}>
                    {entities.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <div className="flex bg-elevated rounded-lg p-1 border border-border">
                    <button onClick={handleUndo} className="p-1.5 hover:bg-surface rounded text-text-secondary hover:text-accent"><Undo2 size={16} /></button>
                    <button onClick={handleRedo} className="p-1.5 hover:bg-surface rounded text-text-secondary hover:text-accent"><Redo2 size={16} /></button>
                  </div>
                  <div className="ml-auto">
                     <Button size="sm" variant="secondary" onClick={handleExportCsv} className="h-9 text-[10px]"><Download size={14} className="mr-1" />Export CSV</Button>
                  </div>
                </div>

                {/* Grid */}
                <div className="flex-1 min-h-0 relative">
                  {ttLoading ? <div className="flex justify-center py-20"><Spinner size={32} /></div> : (
                    <div className="h-full overflow-auto rounded-xl border border-border shadow-2xl bg-surface/50 backdrop-blur-sm custom-scrollbar">
                      <table className="w-full text-[11px] border-collapse table-fixed min-w-[900px]">
                        <thead className="sticky top-0 z-30">
                          <tr>
                            <th className="bg-elevated/95 backdrop-blur px-3 py-4 text-text-secondary border border-border/50 w-20 font-bold uppercase tracking-tighter text-[9px]">Period</th>
                            {DAYS.map(d => <th key={d} className="bg-elevated/95 backdrop-blur px-3 py-4 text-text-primary border border-border/50 font-black uppercase tracking-widest">{d}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(p => (
                            <tr key={p}>
                              <td className="bg-elevated/50 text-center font-code text-text-secondary border border-border/50 py-4 font-bold">{p}</td>
                                {DAYS.map(d => {
                                  const dayIdx = DAYS.indexOf(d) + 1;
                                  
                                  // Check if this slot is a TARGET of a simulation
                                  const targetChange = simulatedChanges?.find(c => c.new_day === dayIdx && c.new_period === p);
                                  // Check if this slot is the SOURCE of a simulation (it has moved away)
                                  const sourceChange = simulatedChanges?.find(c => c.day === dayIdx && c.period === p);

                                  let slot = (grid?.[d] || {})[String(p)]
                                  
                                  if (targetChange) {
                                    slot = (sourceSlot as any)?.data || { subject: 'MOVE TARGET' };
                                  } else if (sourceChange) {
                                    // This cell has moved away. If it was swapped, show the other one.
                                    const swap = simulatedChanges?.find(c => c.new_day === dayIdx && c.new_period === p);
                                    if (!swap) slot = null; // Mark as FREE in the preview
                                  }

                                  const subj = slot ? (slot as any).subject : 'FREE'
                                  const isFree = subj === 'FREE'
                                  
                                  const cellClassId = view === 'class' ? sel : (slot as any)?.class
                                  const isSource = sourceSlot?.day === dayIdx && sourceSlot?.period === p && (!cellClassId || sourceSlot?.class_id === cellClassId);
                                  
                                  return (
                                    <td key={d} onClick={() => handleSlotClick(DAYS.indexOf(d), p, slot)}
                                        className={`border border-border/50 px-2 py-3 transition-all cursor-pointer hover:bg-accent/5 
                                          ${isSource ? 'ring-2 ring-accent bg-accent/5' : ''} 
                                          ${targetChange ? 'bg-success/10 ring-2 ring-success ring-inset' : ''}
                                          ${isFree ? 'bg-free-slot/20' : ''}`}>
                                      {isFree ? <span className="text-text-muted opacity-30 font-bold">FREE</span> : (
                                        <div className={targetChange ? 'animate-pulse' : ''}>
                                          <p className="font-bold text-text-primary truncate">{subj}</p>
                                          {view === 'class' && <p className="text-[9px] text-text-secondary truncate">{(slot as any).teacher}</p>}
                                          {view === 'teacher' && <p className="text-[9px] text-accent font-bold truncate">{(slot as any).class}</p>}
                                          {view === 'room' && <p className="text-[9px] text-accent font-bold truncate">{(slot as any).class}</p>}
                                          <p className="text-[9px] text-text-muted truncate">{(slot as any).room || (slot as any).teacher}</p>
                                        </div>
                                      )}
                                    </td>
                                  )
                                })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8 pb-10">
                 {/* System Health Status */}
                 <div className={`p-8 rounded-[2.5rem] border-2 transition-all duration-500 shadow-2xl relative overflow-hidden group ${Object.entries(res?.constraint_breakdown || {}).some(([k, v]) => k.startsWith('H') && (v as number) > 0) ? 'bg-danger/5 border-danger/30' : 'bg-success/5 border-success/30'}`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-110 transition-transform duration-700" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                       <div className="flex items-center gap-8">
                          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-6 transition-transform ${Object.entries(res?.constraint_breakdown || {}).some(([k, v]) => k.startsWith('H') && (v as number) > 0) ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                             {Object.entries(res?.constraint_breakdown || {}).some(([k, v]) => k.startsWith('H') && (v as number) > 0) ? <AlertCircle size={48} /> : <CheckCircle2 size={48} />}
                          </div>
                          <div>
                             <h2 className="text-4xl font-black text-text-primary tracking-tighter mb-2">SYSTEM HEALTH</h2>
                             <div className="flex items-center gap-3">
                                <Badge variant={Object.entries(res?.constraint_breakdown || {}).some(([k, v]) => k.startsWith('H') && (v as number) > 0) ? 'danger' : 'success'} className="px-6 py-2 text-sm font-black uppercase tracking-widest animate-pulse">
                                   {Object.entries(res?.constraint_breakdown || {}).some(([k, v]) => k.startsWith('H') && (v as number) > 0) ? 'INVALID CONFIGURATION' : 'FULLY OPTIMIZED'}
                                </Badge>
                                <span className="text-text-muted font-bold text-xs uppercase tracking-widest opacity-60">Verified by GA Engine</span>
                             </div>
                          </div>
                       </div>
                       <div className="flex gap-4">
                          <div className="text-right">
                             <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">Global Fitness</p>
                             <p className="text-5xl font-black text-text-primary tabular-nums tracking-tighter">{formatScore(res?.fitness_score || 0)}</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Stats Cards */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-surface border border-border rounded-[2rem] p-8 hover:border-accent/50 transition-all shadow-xl">
                       <p className="text-[11px] font-black text-text-dim uppercase tracking-[0.2em] mb-4">Conflict Metrics</p>
                       <div className="flex items-baseline gap-4">
                          <span className="text-5xl font-black text-danger tabular-nums tracking-tighter">{Object.entries(res?.constraint_breakdown || {}).filter(([k]) => k.startsWith('H')).reduce((acc, [_, v]) => acc + (v as number), 0)}</span>
                          <span className="text-sm font-bold text-text-muted uppercase tracking-tight">Hard Clashes</span>
                       </div>
                    </div>
                    <div className="bg-surface border border-border rounded-[2rem] p-8 hover:border-accent/50 transition-all shadow-xl">
                       <p className="text-[11px] font-black text-text-dim uppercase tracking-[0.2em] mb-4">Optimization Iterations</p>
                       <div className="flex items-baseline gap-4">
                          <span className="text-5xl font-black text-text-primary tabular-nums tracking-tighter">{res?.generations_run}</span>
                          <span className="text-sm font-bold text-text-muted uppercase tracking-tight">Generations</span>
                       </div>
                    </div>
                    <div className="bg-surface border border-border rounded-[2rem] p-8 hover:border-accent/50 transition-all shadow-xl">
                       <p className="text-[11px] font-black text-text-dim uppercase tracking-[0.2em] mb-4">Algorithm Profile</p>
                       <div className="flex items-center gap-4 mt-2">
                          <Badge className="capitalize px-6 py-2 text-base font-black bg-accent/10 text-accent border-accent/20">{job.algorithm.replace('_', ' ')}</Badge>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-surface border border-border rounded-[2.5rem] p-10 h-[450px] flex flex-col shadow-2xl">
                       <div className="flex items-center justify-between mb-10">
                          <h3 className="font-display text-sm font-black uppercase tracking-[0.2em] text-text-secondary border-l-4 border-accent pl-4">Optimization Path</h3>
                          <Badge variant="outline" className="text-[10px] font-black border-border/50 text-text-muted px-4 py-1.5 uppercase tracking-widest">Convergence Chart</Badge>
                       </div>
                       <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={fitnessData}>
                            <defs>
                              <linearGradient id="colorBest" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#6c63ff" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#242430" vertical={false} opacity={0.5} />
                            <XAxis 
                              dataKey="gen" 
                              stroke="#44445a" 
                              tick={{ fontSize: 10, fontWeight: 700 }} 
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              stroke="#44445a" 
                              tick={{ fontSize: 10, fontWeight: 700 }} 
                              domain={['auto', 'auto']}
                              tickFormatter={(val) => Math.round(val).toLocaleString()}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 20, fontSize: 12, fontWeight: 'bold', padding: '15px 20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                              formatter={(val: any) => [val.toLocaleString(), 'Score']}
                              labelStyle={{ color: '#88889a', marginBottom: 5 }}
                            />
                            <Area type="monotone" dataKey="best" stroke="#6c63ff" strokeWidth={4} fillOpacity={1} fill="url(#colorBest)" animationDuration={2000} />
                          </AreaChart>
                        </ResponsiveContainer>
                       </div>
                    </div>

                    <div className="bg-surface border border-border rounded-[2.5rem] p-10 h-[450px] flex flex-col shadow-2xl">
                       <div className="flex items-center justify-between mb-10">
                          <h3 className="font-display text-sm font-black uppercase tracking-[0.2em] text-text-secondary border-l-4 border-danger pl-4">Constraint Audit</h3>
                          <Badge variant="outline" className="text-[10px] font-black border-border/50 text-text-muted px-4 py-1.5 uppercase tracking-widest">Rule Distribution</Badge>
                       </div>
                       <div className="flex-1 min-h-0">
                          {constraintData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted opacity-50">
                              <Spinner size={32} className="mb-4" />
                              <p className="text-sm font-bold">Assembling Audit Map...</p>
                            </div>
                          ) : (
                             <ResponsiveContainer width="100%" height="100%">
                               <BarChart 
                                 data={constraintData}
                                 layout="vertical"
                               >
                                 <CartesianGrid strokeDasharray="3 3" stroke="#242430" horizontal={true} vertical={false} />
                                 <XAxis type="number" stroke="#44445a" tick={{ fontSize: 10 }} label={{ value: 'Penalty Points', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#44445a' }} />
                                 <YAxis 
                                   dataKey="name" 
                                   type="category" 
                                   stroke="#44445a" 
                                   tick={{ fontSize: 9, fontWeight: 'bold' }} 
                                   width={140}
                                   tickFormatter={(val) => val.split('_').slice(1).join(' ').toUpperCase() || val.toUpperCase()}
                                 />
                                 <Tooltip 
                                   cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                   content={({ active, payload }) => {
                                     if (active && payload && payload.length) {
                                       const data = payload[0].payload;
                                       return (
                                         <div className="bg-[#111118] border border-[#242430] rounded-xl p-3 shadow-2xl max-w-xs">
                                           <div className="flex justify-between items-start mb-2">
                                              <p className="text-[10px] font-black text-accent uppercase tracking-widest">{data.name}</p>
                                              <Badge variant={data.value === 0 ? 'success' : (data.name.startsWith('H') ? 'danger' : 'warning')} className="text-[8px]">
                                                {data.value === 0 ? 'Satisfied' : 'Violated'}
                                              </Badge>
                                           </div>
                                           <p className="text-lg font-black text-text-primary mb-1">{data.value} <span className="text-[10px] text-text-muted">Penalty Points</span></p>
                                           <p className="text-[10px] text-text-secondary leading-relaxed italic border-t border-border/30 pt-1.5 mt-1.5">
                                             {CONSTRAINT_DESCRIPTIONS[data.name] || 'General scheduling conflict detected.'}
                                           </p>
                                         </div>
                                       );
                                     }
                                     return null;
                                   }}
                                 />
                                 <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                                   {constraintData.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={entry.fill} />
                                   ))}
                                 </Bar>
                               </BarChart>
                             </ResponsiveContainer>
                          )}
                      </div>
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Side Impact Panel */}
          {sourceSlot && activeTab === 'timetable' && (
            <div className="flex-shrink-0 animate-in slide-in-from-right duration-300">
              <ImpactPanel 
                analysis={analysisResult} 
                isLoading={isAnalyzing} 
                onApply={handleApply} 
                onUseSuggestion={(s: any) => handleApply(s.modified_chromosome)} 
                onAutoFix={handleApply} 
                onCancel={handleCancel} 
                onFindSubstitutes={handleFindSubstitutes} 
                substitutes={substitutes}
                isFindingSubstitutes={isFindingSubstitutes}
                sourceSlot={sourceSlot}
                onDeleteSlot={handleDeleteSlot}
                onAddSlot={handleAddSlot}
              />
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Preview: ${preview?.title}`} wide>
        {preview && (
          <div className="space-y-4">
            <div className="bg-elevated rounded-xl border border-border flex justify-center items-start overflow-hidden overflow-y-auto max-h-[70vh]">
              {preview.loading ? ( <div className="p-16"><Spinner size={32} /></div> ) : 
               preview.type === 'convergence-plot' ? ( <img src={preview.url} alt="Convergence Plot" className="w-full object-contain" /> ) : 
               preview.type === 'html-report' ? ( <iframe srcDoc={preview.content} className="w-full h-[70vh] bg-white border-none" sandbox="allow-same-origin allow-scripts" /> ) : (
                <pre className="text-[10px] font-code p-6 text-text-secondary w-full whitespace-pre-wrap">{preview.content}</pre>
               )}
>>>>>>> Stashed changes
>>>>>>> cc0e994 (added API folder which holds the routes and schemas, resolved branch conflicts, and stabilized timetable editor)
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
