import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTimetable, getJob } from '../api/jobs'
import { downloadExport, downloadAllZip } from '../api/exports'
import { getInstitution } from '../api/institutions'
import { useInstitutionStore } from '../store/institutionStore'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import { ArrowLeft, Download, Undo2, Redo2, Trash2, Plus } from 'lucide-react'
import ImpactPanel from '../components/ImpactPanel'
import { analyzeChange, commitChange, undoChange, redoChange, getSubstitutes } from '../api/analyzer'
import type { AnalyzeChangeResponse, SubstituteTeacher } from '../api/analyzer'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
type ViewMode = 'class' | 'teacher' | 'room'

export default function TimetablePage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { institutionId } = useInstitutionStore()
  const [view, setView] = useState<ViewMode>('class')
  const [selected, setSelected] = useState('')
  const [pareto, setPareto] = useState(0)
  
  const queryClient = useQueryClient()
  const [sourceSlot, setSourceSlot] = useState<{class_id: string, day: number, period: number, isFree?: boolean} | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalyzeChangeResponse | null>(null)
  const [substitutes, setSubstitutes] = useState<SubstituteTeacher[] | null>(null)
  const [isFindingSubstitutes, setIsFindingSubstitutes] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ subject: 'EXTRA', teacher: 'T1', room: '101' })

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

  const handleSlotClick = async (dayIndex: number, period: number, slotData: any) => {
    if (view !== 'class') return;
    const class_id = sel;
    const isFree = !slotData || slotData.subject === 'FREE';

    if (!sourceSlot) {
      setSourceSlot({ class_id, day: dayIndex + 1, period, isFree });
    } else {
      if (sourceSlot.day === dayIndex + 1 && sourceSlot.period === period) {
        setSourceSlot(null);
        return;
      }
      if (sourceSlot.isFree) {
        setSourceSlot({ class_id, day: dayIndex + 1, period, isFree });
        return;
      }

      setIsAnalyzing(true);
      try {
        const changes = [{
          class_id: sourceSlot.class_id,
          day: sourceSlot.day,
          period: sourceSlot.period,
          new_day: dayIndex + 1,
          new_period: period,
        }];
        const res = await analyzeChange(jobId!, changes);
        setAnalysisResult(res);
      } catch (e) {
        console.error(e);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleApply = async (newChromosome: any[]) => {
    await commitChange(jobId!, newChromosome);
    queryClient.invalidateQueries({ queryKey: ['timetable', jobId, pareto] });
    handleCancel();
  };

  const handleUseSuggestion = async (s: any) => {
    setIsAnalyzing(true);
    try {
      const changes = [{
        class_id: sourceSlot!.class_id,
        day: sourceSlot!.day,
        period: sourceSlot!.period,
        new_day: s.day,
        new_period: s.period,
      }];
      const res = await analyzeChange(jobId!, changes);
      if (res.modified_chromosome) {
        await commitChange(jobId!, res.modified_chromosome);
        queryClient.invalidateQueries({ queryKey: ['timetable', jobId, pareto] });
        handleCancel();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCancel = () => {
    setSourceSlot(null);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setSubstitutes(null);
    setIsFindingSubstitutes(false);
  };

  const handleUndo = async () => {
    try {
      await undoChange(jobId!);
      queryClient.invalidateQueries({ queryKey: ['timetable', jobId, pareto] });
    } catch (e) {
      console.error("Undo failed", e);
    }
  };

  const handleRedo = async () => {
    try {
      await redoChange(jobId!);
      queryClient.invalidateQueries({ queryKey: ['timetable', jobId, pareto] });
    } catch (e) {
      console.error("Redo failed", e);
    }
  };

  const handleDeleteSlot = async () => {
    if (!sourceSlot) return;
    setIsAnalyzing(true);
    try {
      const changes = [{
        class_id: sourceSlot.class_id,
        day: sourceSlot.day,
        period: sourceSlot.period,
        new_day: 0,
        new_period: 0,
      }];
      const res = await analyzeChange(jobId!, changes);
      setAnalysisResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleAddSlot = async () => {
    if (!sourceSlot) return;
    setShowAddModal(true);
  };

  const submitAddClass = async () => {
    if (!sourceSlot) return;
    setShowAddModal(false);
    setIsAnalyzing(true);
    try {
      const changes = [{
        class_id: sourceSlot.class_id,
        day: 0,
        period: 0,
        new_day: sourceSlot.day,
        new_period: sourceSlot.period,
        subject_id: addForm.subject,
        new_teacher_id: addForm.teacher,
        new_room_id: addForm.room
      }];
      const res = await analyzeChange(jobId!, changes);
      setAnalysisResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFindSubstitutes = async () => {
    if (!sourceSlot || sourceSlot.isFree) return;
    setIsFindingSubstitutes(true);
    try {
      console.log("DEBUG: Calling getSubstitutes", jobId, sourceSlot.class_id, sourceSlot.day, sourceSlot.period);
      const res = await getSubstitutes(jobId!, sourceSlot.class_id, sourceSlot.day, sourceSlot.period);
      console.log("DEBUG: Substitutes found:", res.substitutes);
      setSubstitutes(res.substitutes);
    } catch (e) {
      console.error("DEBUG: Substitute search failed", e);
    } finally {
      setIsFindingSubstitutes(false);
    }
  };

  const handleUpdateSlot = async (subject_id: string, teacher_id: string, room_id: string) => {
    if (!sourceSlot) return;
    setIsAnalyzing(true);
    try {
      const changes = [{
        class_id: sourceSlot.class_id,
        day: sourceSlot.day,
        period: sourceSlot.period,
        new_day: sourceSlot.day,
        new_period: sourceSlot.period,
        subject_id,
        new_teacher_id: teacher_id,
        new_room_id: room_id
      }];
      const res = await analyzeChange(jobId!, changes);
      setAnalysisResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Header Section */}
      <div className="bg-base/90 backdrop-blur-md z-20 pb-4 border-b border-border shadow-sm px-4">
        <div className="flex items-center justify-between mb-4 pt-4">
          <Link to={`/jobs/${jobId}`} className="group text-sm font-medium text-text-secondary hover:text-accent transition-colors flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-elevated border border-border flex items-center justify-center group-hover:border-accent/50 transition-all">
              <ArrowLeft size={16} />
            </div>
            <span>Back to Analytics Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex bg-elevated rounded-lg p-1 border border-border mr-2">
              <button onClick={handleUndo} className="p-1.5 hover:bg-surface rounded text-text-secondary hover:text-accent transition-all" title="Undo"><Undo2 size={16} /></button>
              <div className="w-px h-4 bg-border mx-1 self-center"></div>
              <button onClick={handleRedo} className="p-1.5 hover:bg-surface rounded text-text-secondary hover:text-accent transition-all" title="Redo"><Redo2 size={16} /></button>
            </div>
            <Button size="sm" variant="secondary" onClick={handleExportCsv} className="h-9"><Download size={14} className="mr-2" />Export CSV</Button>
            <Button size="sm" variant="secondary" onClick={() => downloadAllZip(jobId!)} className="h-9"><Download size={14} className="mr-2" />Download ZIP</Button>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-elevated/30 p-2 rounded-xl border border-border/50">
          <div className="flex bg-elevated rounded-lg p-1 border border-border">
            {(['class', 'teacher', 'room'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => { setView(v); setSelected('') }}
                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${view === v ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}>{v}</button>
            ))}
          </div>
          
          <div className="h-6 w-px bg-border mx-1"></div>

          <select className="h-9 bg-elevated border border-border text-sm font-medium text-text-primary rounded-lg px-4 focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none min-w-[200px] transition-all" value={sel} onChange={e => setSelected(e.target.value)}>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          {job?.algorithm === 'nsga2' && (
            <div className="flex items-center gap-3 bg-elevated border border-border rounded-lg px-3 h-9">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Pareto Solution</span>
              <input type="number" min={0} value={pareto} onChange={e => setPareto(+e.target.value)} className="w-12 bg-transparent text-sm font-bold focus:outline-none text-accent" />
            </div>
          )}
          
          {sourceSlot && view === 'class' && (
            <div className="flex gap-2 ml-auto">
              {!sourceSlot.isFree && (
                <Button size="sm" variant="danger" onClick={handleDeleteSlot} className="h-9 shadow-sm shadow-red-500/10"><Trash2 size={14} className="mr-2"/> Delete</Button>
              )}
              {sourceSlot.isFree && (
                <Button size="sm" variant="primary" onClick={handleAddSlot} className="h-9 shadow-sm shadow-accent/10"><Plus size={14} className="mr-2"/> Add Class</Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content (Scrollable Grid) */}
      <div className="flex-1 min-h-0 relative group p-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size={32} /></div>
        ) : !grid ? (
          <p className="text-text-muted text-sm py-8 text-center">No timetable data</p>
        ) : (
          <div className="h-full overflow-auto rounded-xl border border-border shadow-2xl bg-surface/50 backdrop-blur-sm custom-scrollbar">
            <table className="w-full text-lg border-collapse table-fixed min-w-[1400px]">
              <thead className="sticky top-0 z-30">
                <tr>
                  <th className="bg-elevated/95 backdrop-blur px-8 py-10 text-text-secondary border border-border/50 w-40 font-black uppercase tracking-widest text-sm">Period</th>
                  {DAYS.map(d => (
                    <th key={d} className="bg-elevated/95 backdrop-blur px-8 py-10 text-text-primary border border-border/50 font-black uppercase tracking-[0.2em] text-xl shadow-lg">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(p => (
                   <tr key={p}>
                    <td className="bg-elevated/50 text-center font-code text-text-secondary border border-border/50 py-10 font-black text-2xl">{p}</td>
                    {DAYS.map(d => {
                      const slot = (grid[d] || {})[String(p)]
                      const subj = slot ? (slot as any).subject : 'FREE'
                      const isFree = subj === 'FREE'
                      const isLab = slot ? (slot as any).is_lab || subj?.endsWith('(L)') : false
                      const isSource = sourceSlot?.class_id === sel && sourceSlot?.day === DAYS.indexOf(d) + 1 && sourceSlot?.period === p;

                      if (isFree) return (
                        <td key={d} onClick={() => handleSlotClick(DAYS.indexOf(d), p, { subject: 'FREE' })}
                            className={`bg-free-slot/30 border border-border/50 text-center text-text-muted/60 px-6 py-10 text-lg font-black tracking-widest ${view === 'class' ? 'cursor-pointer hover:bg-accent/10 transition-colors' : ''} ${isSource ? 'ring-4 ring-accent bg-accent/20' : ''}`}>
                          FREE
                        </td>
                      )

                      let l1 = '', l2 = '', l3 = ''
                      if (view === 'class') {
                        l1 = subj; l2 = (slot as any).teacher || ''; l3 = (slot as any).room || ''
                      } else if (view === 'teacher') {
                        l1 = (slot as any).class || subj; l2 = (slot as any).subject || subj; l3 = (slot as any).room || ''
                      } else {
                        l1 = (slot as any).class || subj; l2 = (slot as any).subject || subj; l3 = (slot as any).teacher || ''
                      }

                      return (
                        <td key={d} onClick={() => handleSlotClick(DAYS.indexOf(d), p, slot)}
                          className={`border border-border/50 px-6 py-10 transition-all ${isLab ? 'border-l-8 border-l-lab-badge' : ''} ${view === 'class' ? 'cursor-pointer hover:bg-elevated' : ''} ${isSource ? 'ring-4 ring-accent bg-accent/10 shadow-2xl z-10' : ''}`}>
                          <p className="font-black text-text-primary text-xl truncate mb-2 tracking-tighter uppercase">{l1}</p>
                          <p className="text-[15px] font-black text-text-secondary truncate leading-tight mb-1.5 uppercase opacity-90">{l2}</p>
                          <p className="text-[14px] font-bold text-text-muted truncate leading-tight uppercase opacity-80">{l3}</p>
                          {isLab && <div className="mt-4"><Badge variant="lab" className="text-[12px] px-3 py-1 font-black">LAB SESSION</Badge></div>}
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

      {/* Panels and Modals */}
      {sourceSlot && (
        <ImpactPanel 
          analysis={analysisResult} 
          isLoading={isAnalyzing} 
          onApply={handleApply} 
          onUseSuggestion={handleUseSuggestion} 
          onAutoFix={handleApply} 
          onCancel={handleCancel} 
          onFindSubstitutes={handleFindSubstitutes}
          substitutes={substitutes}
          isFindingSubstitutes={isFindingSubstitutes}
          sourceSlot={sourceSlot}
          onAddSlot={handleUpdateSlot}
          onDeleteSlot={handleDeleteSlot}
        />
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-base border border-border p-6 rounded-2xl shadow-2xl w-80 max-w-full scale-in">
            <h3 className="text-lg font-bold text-text-primary mb-4">Quick Add Class</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5">Subject Code</label>
                <input type="text" value={addForm.subject} onChange={e => setAddForm({...addForm, subject: e.target.value})} className="w-full bg-elevated border border-border text-sm text-text-primary rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5">Teacher Code</label>
                <input type="text" value={addForm.teacher} onChange={e => setAddForm({...addForm, teacher: e.target.value})} className="w-full bg-elevated border border-border text-sm text-text-primary rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5">Room Code</label>
                <input type="text" value={addForm.room} onChange={e => setAddForm({...addForm, room: e.target.value})} className="w-full bg-elevated border border-border text-sm text-text-primary rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={submitAddClass}>Add Class</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
