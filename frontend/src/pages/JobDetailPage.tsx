import { useState } from 'react'
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
import { Copy, Download, Undo2, Redo2, Trash2, Plus, ArrowLeft, TrendingUp, Calendar, FileText, FileJson, Image, CheckCircle2, AlertCircle, X } from 'lucide-react'
import ImpactPanel from '../components/ImpactPanel'
import { analyzeChange, commitChange, undoChange, redoChange, getSubstitutes } from '../api/analyzer'
import type { AnalyzeChangeResponse, SubstituteTeacher } from '../api/analyzer'
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

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { institutionId } = useInstitutionStore()
  const nav = useNavigate()
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

  // Edit states
  const [sourceSlot, setSourceSlot] = useState<{class_id: string, day: number, period: number, isFree?: boolean, data?: any} | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalyzeChangeResponse | null>(null)
  const [simulatedChanges, setSimulatedChanges] = useState<any[] | null>(null)

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

  const constraintData = Object.keys(CONSTRAINT_DESCRIPTIONS).map(key => {
    const val = flatBreakdown[key] || 0
    return {
      name: key,
      value: val,
      fill: key.startsWith('H') ? (val > 0 ? '#ef4444' : '#22c55e') : (val > 0 ? '#f59e0b' : '#22c55e'),
    }
  })

  // Handlers
  const copyId = () => { navigator.clipboard.writeText(jobId!); toast.success('Copied ID') }
  const handleExportCsv = () => {
     if (view === 'class') downloadExport(jobId!, 'student-csv', sel)
     else if (view === 'teacher') downloadExport(jobId!, 'teacher-csv', sel.replace(/ /g, '_'))
     else downloadExport(jobId!, 'room-csv', sel.replace(/ /g, '_'))
  }

  const handleSlotClick = async (dayIndex: number, period: number, slotData: any) => {
    const isFree = !slotData || slotData.subject === 'FREE';
    const actualPeriod = slotData?.is_lab_second_hour ? period - 1 : period;

    let classId: string | undefined;
    if (view === 'class') {
      classId = sel; 
    } else if (slotData && (slotData as any).class) {
      classId = (slotData as any).class;
    }

    if (!sourceSlot) {
      if (!classId || (isFree && view !== 'class')) return; 
      setSourceSlot({ class_id: classId, day: dayIndex + 1, period: actualPeriod, isFree, data: slotData });
      return;
    }

    if (sourceSlot.day === dayIndex + 1 && 
        sourceSlot.period === actualPeriod && 
        sourceSlot.class_id === (classId || sourceSlot.class_id)) {
      handleCancel();
      return;
    }

    if (sourceSlot.isFree) { 
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
      toast.error('Analysis failed.');
    } finally { setIsAnalyzing(false); }
  };

  const handleCancel = () => { 
    setSourceSlot(null); setAnalysisResult(null); setSimulatedChanges(null);
    setIsAnalyzing(false); setSubstitutes(null); setIsFindingSubstitutes(false);
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
    } catch (e) { toast.error('Failed to find substitutes'); } 
    finally { setIsFindingSubstitutes(false); }
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
        day: 0, period: 0, 
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

  const handlePreview = async (type: string, title: string) => {
    const url = `${BASE_URL}/api/v1/jobs/${jobId}/exports/${type}`
    if (type === 'convergence-plot') { setPreview({ type, title, url }) } 
    else {
      setPreview({ type, title, url, loading: true })
      try {
        const fetchRes = await fetch(url); let text = await fetchRes.text()
        if (type === 'html-report') {
          const plotUrl = `${BASE_URL}/api/v1/jobs/${jobId}/exports/convergence-plot`
          text = text.replace(/src=["'][^"']*\bconvergence_plot\.png["']/gi, `src="${plotUrl}"`)
        }
        setPreview({ type, title, url, content: text, loading: false })
      } catch { toast.error('Failed to load preview'); setPreview(null) }
    }
  }

  if (jobLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>
  if (!job) return <div>Job not found</div>

  return (
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
        </div>
      </div>

      {isPolling && (
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
                    <button onClick={handleUndo} title="Undo" className="p-1.5 hover:bg-surface rounded text-text-secondary hover:text-accent"><Undo2 size={16} /></button>
                    <button onClick={handleRedo} title="Redo" className="p-1.5 hover:bg-surface rounded text-text-secondary hover:text-accent"><Redo2 size={16} /></button>
                  </div>
                  <div className="ml-auto">
                     <Button size="sm" variant="secondary" onClick={handleExportCsv} className="h-9 text-[10px]"><Download size={14} className="mr-1" />Export CSV</Button>
                  </div>
                </div>

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
                                  const targetChange = simulatedChanges?.find(c => c.new_day === dayIdx && c.new_period === p);
                                  const sourceChange = simulatedChanges?.find(c => c.day === dayIdx && c.period === p);

                                  let slot = (grid?.[d] || {})[String(p)]
                                  if (targetChange) {
                                    slot = sourceSlot?.data || { subject: 'MOVE TARGET' };
                                  } else if (sourceChange) {
                                    const swap = simulatedChanges?.find(c => c.new_day === dayIdx && c.new_period === p);
                                    if (!swap) slot = null;
                                  }

                                  const subj = slot ? (slot as any).subject : 'FREE'
                                  const isFree = subj === 'FREE'
                                  const cellClassId = view === 'class' ? sel : (slot as any)?.class
                                  const isSource = sourceSlot?.day === dayIdx && sourceSlot?.period === p && (!cellClassId || sourceSlot?.class_id === cellClassId);
                                  
                                  return (
                                    <td key={d} onClick={() => handleSlotClick(DAYS.indexOf(d), p, slot)}
                                        className={`border border-border/50 px-3 py-4 transition-all cursor-pointer group relative
                                          ${isSource ? 'bg-accent/10 ring-2 ring-accent ring-inset' : 'hover:bg-elevated'} 
                                          ${targetChange ? 'bg-success/20 ring-2 ring-success ring-inset animate-pulse' : ''}
                                          ${isFree ? 'bg-black/5' : 'bg-surface/30'}`}>
                                      {isSource && <div className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full animate-ping" />}
                                      {isFree ? (
                                        <div className="flex flex-col items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                                          <Plus size={14} className="text-text-muted mb-1" />
                                          <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Empty</span>
                                        </div>
                                      ) : (
                                        <div className="relative z-10">
                                          <p className="font-black text-text-primary text-xs tracking-tight truncate group-hover:text-accent transition-colors">{subj}</p>
                                          <div className="flex flex-col gap-0.5 mt-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                            {view === 'class' && (
                                              <p className="text-[9px] text-text-secondary font-bold truncate flex items-center gap-1">
                                                <div className="w-1 h-1 rounded-full bg-accent/50" /> {(slot as any).teacher}
                                              </p>
                                            )}
                                            {(view === 'teacher' || view === 'room') && (
                                              <p className="text-[9px] text-accent font-black truncate uppercase tracking-tighter">
                                                {(slot as any).class}
                                              </p>
                                            )}
                                            <p className="text-[9px] text-text-muted font-medium truncate italic">
                                              @ {(slot as any).room || (slot as any).teacher}
                                            </p>
                                          </div>
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
                            <XAxis dataKey="gen" stroke="#44445a" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                            <YAxis stroke="#44445a" tick={{ fontSize: 10, fontWeight: 700 }} domain={['auto', 'auto']} tickFormatter={(val) => Math.round(val).toLocaleString()} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 20, fontSize: 12, fontWeight: 'bold', padding: '15px 20px' }} formatter={(val: any) => [val.toLocaleString(), 'Score']} />
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
                              <BarChart layout="vertical" data={constraintData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#242430" horizontal={false} opacity={0.5} />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" stroke="#88889a" tick={{ fontSize: 9, fontWeight: 700 }} width={120} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 15, fontSize: 11 }} />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={12}>
                                  {constraintData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="bg-surface border border-border rounded-[2.5rem] p-10 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="font-display text-sm font-black uppercase tracking-[0.2em] text-text-secondary border-l-4 border-success pl-4">Available Reports</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       {[
                         { title: 'Interactive Report', type: 'html-report', icon: <FileText className="text-accent" />, desc: 'Full-featured timetable report' },
                         { title: 'Convergence Plot', type: 'convergence-plot', icon: <Image className="text-success" />, desc: 'Evolution history visualization' },
                         { title: 'Best Chromosome', type: 'chromosome', icon: <FileJson className="text-warning" />, desc: 'Raw genetic structure (JSON)' }
                       ].map(report => (
                         <div key={report.type} className="bg-elevated/40 border border-border rounded-2xl p-6 hover:bg-elevated transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform">{report.icon}</div>
                            <h4 className="text-sm font-bold text-text-primary mb-1">{report.title}</h4>
                            <p className="text-[10px] text-text-muted mb-6">{report.desc}</p>
                            <div className="flex gap-2">
                               <Button size="sm" className="flex-1" onClick={() => handlePreview(report.type, report.title)}>Preview</Button>
                               <Button size="sm" variant="secondary" onClick={() => downloadExport(jobId!, report.type)}><Download size={14} /></Button>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Right Panel: Impact & Actions */}
          <div className="w-[450px] flex-shrink-0 ml-4 border-l border-border pl-4 overflow-y-auto custom-scrollbar">
             <ImpactPanel 
                institutionId={institutionId!}
                analysis={analysisResult}
                isLoading={isAnalyzing}
                onApply={handleApply}
                onCancel={handleCancel}
                substitutes={substitutes}
                isFindingSubstitutes={isFindingSubstitutes}
                onFindSubstitutes={handleFindSubstitutes}
                onDeleteSlot={handleDeleteSlot}
                onAddSlot={handleAddSlot}
                sourceSlot={sourceSlot}
                onUseSuggestion={(s) => handleApply(s.modified_chromosome)}
                onAutoFix={(c) => handleApply(c)}
             />
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Modal 
        isOpen={!!preview} 
        onClose={() => setPreview(null)}
        title={preview?.title || ''}
        size={preview?.type === 'html-report' ? 'xl' : 'lg'}
      >
        <div className="flex flex-col h-[70vh]">
          {preview?.loading ? <div className="flex-1 flex items-center justify-center"><Spinner size={32} /></div> : (
            <>
              {preview?.type === 'convergence-plot' ? (
                <div className="flex-1 flex items-center justify-center bg-black/20 rounded-xl overflow-hidden p-4">
                  <img src={preview.url} alt="Plot" className="max-w-full max-h-full object-contain" />
                </div>
              ) : preview?.type === 'html-report' ? (
                <iframe srcDoc={preview.content} className="flex-1 w-full bg-white rounded-xl" />
              ) : (
                <pre className="flex-1 bg-elevated p-6 rounded-xl overflow-auto text-xs font-code text-text-secondary">{preview?.content}</pre>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
