import { useState, useEffect } from 'react';
import type { AnalyzeChangeResponse, Suggestion, SubstituteTeacher } from '../api/analyzer';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Zap, TrendingUp, AlertCircle, CheckCircle2, Trash2, Edit3, Save, X, Plus } from 'lucide-react';
import Spinner from './ui/Spinner';

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

interface ImpactPanelProps {
    analysis: AnalyzeChangeResponse | null;
    isLoading: boolean;
    onApply: (chromosome: any[]) => void;
    onUseSuggestion: (s: Suggestion) => void;
    onAutoFix: (chromosome: any[]) => void;
    onCancel: () => void;
    onFindSubstitutes: () => void;
    substitutes: SubstituteTeacher[] | null;
    isFindingSubstitutes: boolean;
    sourceSlot?: {class_id: string, day: number, period: number, isFree?: boolean} | null;
    onDeleteSlot?: () => void;
    onAddSlot?: (subject: string, teacher: string, room: string) => void;
}

export default function ImpactPanel({ 
    analysis, 
    isLoading, 
    onApply, 
    onUseSuggestion, 
    onAutoFix, 
    onCancel, 
    onFindSubstitutes,
    substitutes,
    isFindingSubstitutes,
    sourceSlot,
    onDeleteSlot,
    onAddSlot
}: ImpactPanelProps) {
    const [addSubject, setAddSubject] = useState('');
    const [addTeacher, setAddTeacher] = useState('');
    const [addRoom, setAddRoom] = useState('');

    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (sourceSlot && !sourceSlot.isFree && !analysis) {
            const data = (sourceSlot as any).data;
            if (data) {
                setAddSubject(data.subject || '');
                setAddTeacher(data.teacher_id || data.teacher || '');
                setAddRoom(data.room_id || data.room || '');
            }
        } else if (sourceSlot && sourceSlot.isFree) {
            setAddSubject('');
            setAddTeacher('');
            setAddRoom('');
            setIsEditing(true);
        } else if (!sourceSlot) {
            setAddSubject('');
            setAddTeacher('');
            setAddRoom('');
            setIsEditing(false);
        }
    }, [sourceSlot, analysis]);

    if (isLoading) {
        return (
            <div className="w-full bg-base border-l border-border h-full flex flex-col flex-shrink-0 relative overflow-y-auto custom-scrollbar">
                <div className="p-8 border-b border-border sticky top-0 bg-base/90 backdrop-blur-md z-20 flex justify-between items-center shadow-md">
                    <h3 className="font-black text-2xl text-text-primary uppercase tracking-tighter">SIMULATING...</h3>
                    <button onClick={onCancel} className="p-2 hover:bg-elevated rounded-2xl transition-all text-text-muted hover:text-text-primary text-4xl">&times;</button>
                </div>
                <div className="p-12 flex flex-col items-center justify-center space-y-8">
                    <div className="w-32 h-32 rounded-full border-4 border-accent/20 border-t-accent animate-spin flex items-center justify-center">
                        <Zap size={48} className="text-accent animate-pulse" />
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-black text-text-primary tracking-tight mb-2 uppercase">Engine Analyzing</p>
                        <p className="text-sm text-text-dim font-bold uppercase tracking-widest">Recalculating Global Fitness...</p>
                    </div>
                    <div className="w-full space-y-4 pt-12">
                        <div className="h-4 bg-elevated rounded-full w-full animate-pulse"></div>
                        <div className="h-4 bg-elevated rounded-full w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-elevated rounded-full w-5/6 animate-pulse"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!analysis && !isLoading) {
        return (
            <div className="w-full bg-elevated border-l border-border h-full flex flex-col flex-shrink-0 relative overflow-y-auto custom-scrollbar">
                <div className="p-8 border-b border-border sticky top-0 flex justify-between items-center bg-elevated/80 backdrop-blur-md z-10 shadow-lg">
                    <h3 className="font-black text-2xl text-text-primary uppercase tracking-tighter">Slot Analysis</h3>
                    <button onClick={onCancel} className="text-text-muted hover:text-text-primary text-4xl transition-colors">&times;</button>
                </div>

                <div className="flex-1">
                    {sourceSlot ? (
                        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="p-6 bg-accent/5 rounded-3xl border border-accent/20 shadow-inner">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-accent font-black text-2xl shadow-lg">
                                        {sourceSlot.class_id ? sourceSlot.class_id[0] : '?'}
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase font-black tracking-[0.2em] mb-1">Active Selection</p>
                                        <p className="text-2xl font-black text-text-primary tracking-tight">{sourceSlot.class_id}</p>
                                    </div>
                                    <div className="ml-auto">
                                        <Badge variant="outline" className="text-sm px-4 py-1.5 font-black border-accent/30 text-accent">D{sourceSlot.day} P{sourceSlot.period}</Badge>
                                    </div>
                                </div>
                            </div>

                            {!sourceSlot.isFree ? (
                                <div className="space-y-6">
                                    <div className="p-6 bg-surface rounded-3xl border border-border shadow-2xl">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <p className="text-xs font-black text-text-secondary uppercase tracking-[0.15em] mb-2">Current Lecture</p>
                                                <p className="text-xl font-black text-text-primary tracking-tight">{addSubject}</p>
                                                <p className="text-base font-bold text-text-secondary mt-1">{addTeacher} • {addRoom}</p>
                                            </div>
                                            <button 
                                                onClick={() => setIsEditing(!isEditing)}
                                                className="p-3 hover:bg-accent/10 rounded-2xl text-text-muted hover:text-accent transition-all shadow-sm"
                                                title="Edit Details"
                                            >
                                                <Edit3 size={24} />
                                            </button>
                                        </div>

                                        <div className="flex gap-4 mt-8 pt-8 border-t border-border/50">
                                            <Button 
                                                variant="primary" 
                                                size="sm" 
                                                className="flex-1 h-16 text-base font-black gap-3 shadow-2xl shadow-accent/30" 
                                                onClick={onFindSubstitutes} 
                                                disabled={isFindingSubstitutes}
                                            >
                                                {isFindingSubstitutes ? <Spinner size={20} /> : <TrendingUp size={24} />}
                                                Find Substitute Teacher
                                            </Button>
                                            {onDeleteSlot && (
                                                <Button variant="danger" size="sm" className="h-16 px-6 flex items-center justify-center rounded-2xl shadow-lg" onClick={onDeleteSlot}>
                                                    <Trash2 size={24} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>


                                    {/* Substitution Results */}
                                    {substitutes && (
                                        <div className="mt-6 space-y-8 animate-in slide-in-from-bottom-4 pb-12">
                                            {substitutes.length > 0 ? (
                                                (() => {
                                                    const qualified = substitutes.filter(s => s.is_qualified);
                                                    const freeUnqualified = substitutes.filter(s => !s.is_qualified && s.is_free);
                                                    
                                                    return (
                                                        <>
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between sticky top-0 bg-elevated/80 backdrop-blur-md py-4 z-10 border-b border-border/10 mb-4">
                                                                    <p className="text-[13px] font-black text-text-secondary uppercase tracking-[0.2em]">Qualified Teachers</p>
                                                                    <Badge variant={qualified.length > 0 ? 'success' : 'outline'} className="font-black px-4 py-1.5 text-xs">{qualified.length} Found</Badge>
                                                                </div>
                                                                {qualified.length > 0 ? (
                                                                    qualified.map((s, idx) => (
                                                                        <div key={`q-${idx}`} className="p-6 bg-surface border border-border rounded-2xl hover:border-accent/50 transition-all group cursor-default shadow-xl">
                                                                            <div className="flex justify-between items-center mb-4">
                                                                                <div className="flex items-center gap-5">
                                                                                    <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center text-success font-black text-lg shadow-md">
                                                                                        {s.teacher_name[0]}
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-lg font-black text-text-primary tracking-tight">{s.teacher_name}</p>
                                                                                        <p className={`text-sm font-bold mt-1 ${s.penalty_delta <= 0 ? 'text-success' : 'text-warning'}`}>
                                                                                            Impact: {s.penalty_delta <= 0 ? 'Optimal' : 'Caution'} ({s.penalty_delta > 0 ? '+' : ''}{s.penalty_delta})
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <Button size="sm" variant="primary" className="h-12 px-6 text-sm font-black" onClick={() => onApply(s.modified_chromosome)}>
                                                                                    Apply
                                                                                </Button>
                                                                            </div>
                                                                            {/* Detailed constraint changes */}
                                                                            {s.constraint_details && s.constraint_details.length > 0 && (
                                                                                <div className="space-y-2 mt-4 pt-4 border-t border-border/30">
                                                                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Constraint Impact</p>
                                                                                    {s.constraint_details.map((cd, ci) => (
                                                                                        <div key={ci} className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold ${cd.status === 'worsened' ? 'bg-danger/5 text-danger' : 'bg-success/5 text-success'}`}>
                                                                                            <div className="flex items-center gap-2">
                                                                                                {cd.status === 'worsened' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                                                                                                <span>{cd.constraint.split('_').slice(1).join(' ').toUpperCase()}</span>
                                                                                                {cd.is_hard && <span className="text-[8px] bg-danger/20 text-danger px-1.5 py-0.5 rounded font-black">HARD</span>}
                                                                                            </div>
                                                                                            <span className="tabular-nums">{cd.before} → {cd.after} ({cd.delta > 0 ? '+' : ''}{cd.delta})</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            {s.conflicts.length > 0 && !s.constraint_details?.length && (
                                                                                <div className="space-y-3 mt-5 pt-5 border-t border-border/30">
                                                                                    {s.conflicts.map((c, ci) => (
                                                                                        <p key={ci} className="text-[12px] text-danger/80 flex items-center gap-3 italic font-bold">
                                                                                            <AlertCircle size={16} /> {c}
                                                                                        </p>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="p-8 bg-danger/5 border-2 border-dashed border-danger/20 rounded-2xl text-center py-12 shadow-inner">
                                                                        <AlertCircle size={40} className="mx-auto text-danger mb-4 opacity-50" />
                                                                        <p className="text-xl text-danger font-black uppercase tracking-tight">No qualified teachers available!</p>
                                                                        <p className="text-sm text-danger/60 mt-3 font-bold uppercase tracking-wider">Checking emergency covers below...</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {freeUnqualified.length > 0 && (
                                                                <div className="space-y-4 pt-8 border-t-2 border-border/30">
                                                                    <div className="flex items-center justify-between sticky top-0 bg-elevated/80 backdrop-blur-md py-4 z-10">
                                                                        <p className="text-[13px] font-black text-text-muted uppercase tracking-[0.2em]">Emergency (Free Teachers)</p>
                                                                        <Badge variant="outline" className="font-black px-4 py-1.5 text-xs text-text-muted border-text-muted/30">{freeUnqualified.length} Free</Badge>
                                                                    </div>
                                                                    <p className="text-[13px] text-text-muted italic px-2 leading-relaxed font-bold">Note: These teachers are free but not qualified for this subject.</p>
                                                                    <div className="grid grid-cols-1 gap-5">
                                                                        {freeUnqualified.map((s, idx) => (
                                                                            <div key={`u-${idx}`} className="p-6 bg-surface/40 border border-border/50 rounded-2xl hover:border-accent/30 transition-all group opacity-80 hover:opacity-100 shadow-xl">
                                                                                <div className="flex justify-between items-center">
                                                                                    <div className="flex items-center gap-5">
                                                                                        <div className="w-14 h-14 rounded-2xl bg-text-muted/10 flex items-center justify-center text-text-muted font-black text-lg shadow-md">
                                                                                            {s.teacher_name[0]}
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-lg font-black text-text-secondary tracking-tight">{s.teacher_name}</p>
                                                                                            <Badge variant="outline" className="text-[11px] h-6 px-3 mt-3 border-text-muted/30 text-text-muted font-black uppercase tracking-widest">Available Now</Badge>
                                                                                        </div>
                                                                                    </div>
                                                                                    <Button size="sm" variant="secondary" className="h-12 px-6 text-sm font-black" onClick={() => onApply(s.modified_chromosome)}>
                                                                                        Substitute
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()
                                            ) : (
                                                <div className="p-8 bg-surface border-2 border-dashed border-border rounded-2xl text-center py-12">
                                                    <AlertCircle size={40} className="mx-auto text-text-muted mb-4 opacity-50" />
                                                    <p className="text-lg text-text-primary font-black uppercase tracking-tight">No teachers found</p>
                                                    <p className="text-sm text-text-muted mt-2 font-bold italic">Neither qualified nor free teachers are available for this slot.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 bg-surface border-2 border-dashed border-border rounded-3xl space-y-8 py-12 shadow-2xl">
                                    <div className="flex flex-col items-center">
                                        <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-6">
                                            <Plus size={40} />
                                        </div>
                                        <p className="text-2xl font-black text-text-primary uppercase tracking-tight">Schedule New Lecture</p>
                                        <p className="text-sm text-text-muted font-bold mt-2">Fill details to add to D{sourceSlot.day} P{sourceSlot.period}</p>
                                    </div>

                                    <div className="space-y-5 text-left">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Subject Code</label>
                                            <input 
                                                className="w-full h-14 bg-elevated border border-border rounded-2xl px-5 text-sm font-bold focus:ring-2 ring-accent/50 outline-none transition-all"
                                                placeholder="e.g. CS101"
                                                value={addSubject}
                                                onChange={e => setAddSubject(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Teacher ID</label>
                                            <input 
                                                className="w-full h-14 bg-elevated border border-border rounded-2xl px-5 text-sm font-bold focus:ring-2 ring-accent/50 outline-none transition-all"
                                                placeholder="e.g. T001"
                                                value={addTeacher}
                                                onChange={e => setAddTeacher(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Room ID</label>
                                            <input 
                                                className="w-full h-14 bg-elevated border border-border rounded-2xl px-5 text-sm font-bold focus:ring-2 ring-accent/50 outline-none transition-all"
                                                placeholder="e.g. R101"
                                                value={addRoom}
                                                onChange={e => setAddRoom(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <Button 
                                        variant="primary" 
                                        className="w-full h-16 text-lg font-black shadow-2xl shadow-accent/20"
                                        disabled={!addSubject || !addTeacher || !addRoom}
                                        onClick={() => onAddSlot?.(addSubject, addTeacher, addRoom)}
                                    >
                                        Add to Timetable
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-16 text-center flex flex-col items-center justify-center h-full space-y-12">
                            <div className="w-32 h-32 rounded-[2rem] bg-accent/10 flex items-center justify-center text-accent rotate-6 shadow-2xl shadow-accent/30 border border-accent/20">
                                <Zap size={64} />
                            </div>
                            <div>
                                <p className="text-4xl font-black text-text-primary tracking-tighter leading-none mb-6">READY TO OPTIMIZE</p>
                                <p className="text-xl text-text-secondary leading-relaxed px-12 font-bold opacity-80 uppercase tracking-tight">
                                    Select a target slot in the timetable to simulate the move and analyze potential conflicts.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!analysis) return null;

    const { penalty_delta, ripple_effect, suggestions, hill_climbed_chromosome, hill_climb_improved } = analysis;

    return (
        <div className="w-full bg-base border-l border-border h-full flex flex-col flex-shrink-0 relative overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="p-8 border-b border-border sticky top-0 bg-base/90 backdrop-blur-md z-20 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-4">
                    <h3 className="font-black text-2xl text-text-primary uppercase tracking-tighter">MOVE ANALYSIS</h3>
                    {penalty_delta <= 0 && (
                        <div className="flex items-center gap-2 bg-success/10 text-success text-xs font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full border border-success/30 shadow-sm animate-pulse">
                            <CheckCircle2 size={16} />
                            <span>Safe Move</span>
                        </div>
                    )}
                </div>
                <button onClick={onCancel} className="p-2 hover:bg-elevated rounded-2xl transition-all text-text-muted hover:text-text-primary text-4xl">&times;</button>
            </div>

            <div className="p-4 space-y-8">
                {/* Fitness Impact */}
                <section className="space-y-3">
                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest border-l-2 border-accent pl-2">System Impact</h4>
                    <div className={`p-4 rounded-2xl border-2 transition-all duration-300 ${penalty_delta > 0 ? 'bg-red-500/5 border-red-500/10' : penalty_delta < 0 ? 'bg-green-500/5 border-green-500/10' : 'bg-elevated border-border'}`}>
                        <div className="flex items-end justify-between mb-4">
                            <div>
                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-tight mb-1">Fitness Score</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black tabular-nums">{(200000 - analysis.penalty_after).toLocaleString()}</span>
                                    <span className={`text-sm font-black px-2 py-0.5 rounded ${penalty_delta > 0 ? 'text-danger' : 'text-success'}`}>
                                        {penalty_delta > 0 ? '↓' : '↑'}{Math.abs(penalty_delta)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {analysis.penalty_details && analysis.penalty_details_before && (
                            <div className="space-y-3 border-t border-border/50 pt-4">
                                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">New Violations (Delta)</p>
                                {(() => {
                                    const afterDetails = { ...analysis.penalty_details.hard_penalties, ...analysis.penalty_details.soft_penalties };
                                    const beforeDetails = { ...analysis.penalty_details_before.hard_penalties, ...analysis.penalty_details_before.soft_penalties };
                                    
                                    const newViolations = Object.entries(afterDetails)
                                        .map(([key, count]) => ({ key, delta: (count as number) - (beforeDetails[key] as number || 0) }))
                                        .filter(v => v.delta > 0);

                                    if (newViolations.length === 0) {
                                        return <p className="text-[11px] text-success italic flex items-center gap-2"><CheckCircle2 size={12} /> No new violations introduced.</p>;
                                    }

                                    return newViolations.map(({key, delta}) => (
                                        <div key={key} className="space-y-1.5 group p-2.5 bg-red-500/5 rounded-lg border border-red-500/10">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[11px] font-bold text-text-primary group-hover:text-accent transition-colors">
                                                    {key.split('_').slice(1).join(' ').toUpperCase() || key.toUpperCase()}
                                                </span>
                                                <span className={`text-[11px] font-bold ${key.startsWith('H') ? 'text-danger' : 'text-warning'}`}>
                                                    +{delta} {key.startsWith('H') ? 'Critical' : 'Soft'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-text-muted leading-relaxed italic">
                                                {CONSTRAINT_DESCRIPTIONS[key] || 'General scheduling constraint violation.'}
                                            </p>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                </section>

                {/* Conflict Map */}
                <section className="space-y-3">
                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest border-l-2 border-danger pl-2">
                      Cross-Section Conflict Map
                    </h4>
                    {ripple_effect.direct_conflicts.length === 0 ? (
                        <div className="bg-success/5 border border-success/10 rounded-xl p-3 flex items-center gap-3">
                            <CheckCircle2 size={16} className="text-success" />
                            <p className="text-[11px] text-success font-medium">No collisions detected across any section.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {ripple_effect.direct_conflicts.map((c, i) => {
                                const label = c.type === 'teacher'
                                    ? `${c.id} is already teaching in ${c.clashed_with_class} at this time`
                                    : c.type === 'room'
                                    ? `Room ${c.id} is occupied by ${c.clashed_with_class} at this time`
                                    : `Class ${c.id} already has a lecture at this slot`;
                                return (
                                <div key={i} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-red-500/20 flex items-center justify-center text-red-500 text-[10px] font-black flex-shrink-0">!</div>
                                        <span className="text-[10px] font-black text-danger uppercase tracking-tight">
                                          {c.type} clash — {c.clashed_with_class || 'Unknown'}
                                        </span>
                                        <Badge variant="outline" className="text-[8px] ml-auto flex-shrink-0">D{c.day} P{c.period}</Badge>
                                    </div>
                                    <p className="text-[11px] text-text-secondary leading-relaxed pl-8">
                                        {label}
                                    </p>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Best Moves */}
                <section className="space-y-3">
                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest border-l-2 border-success pl-2">Recommended Moves</h4>
                    {suggestions.length === 0 ? (
                        <p className="text-[11px] text-text-muted italic px-2">No better alternatives found nearby.</p>
                    ) : (
                        <div className="space-y-2">
                            {suggestions.map((s, i) => (
                                <div key={i} className="group p-3 rounded-xl bg-elevated border border-border hover:border-accent/50 transition-all flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="success" className="text-[8px]">Option {i+1}</Badge>
                                            <span className="text-[11px] font-bold text-text-primary">D{s.day} Period {s.period}</span>
                                        </div>
                                        <p className={`text-[10px] font-medium flex items-center gap-1 ${s.penalty_delta <= 0 ? 'text-success' : 'text-warning'}`}>
                                            <TrendingUp size={10} className={s.penalty_delta > 0 ? "rotate-180" : ""} />
                                            {s.penalty_delta < 0 ? 'Improves fitness' : s.penalty_delta === 0 ? 'Maintains quality' : 'Slightly degrades fitness'}
                                        </p>
                                        {s.reasons && s.reasons.length > 0 && (
                                            <div className="mt-1.5 space-y-1">
                                                {s.reasons.map((r, idx) => {
                                                    const isViolation = r.startsWith('Violates');
                                                    return (
                                                        <p key={idx} className={`text-[11px] italic flex items-center gap-1.5 ${isViolation ? 'text-danger' : 'text-success'}`}>
                                                            {isViolation ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                                                            {r}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <Button size="xs" variant={s.penalty_delta <= 0 ? "primary" : "outline"} onClick={() => onUseSuggestion(s)} className={`opacity-0 group-hover:opacity-100 shadow-lg ${s.penalty_delta <= 0 ? 'shadow-accent/20' : ''}`}>Use</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Global Actions */}
                <div className="pt-6 border-t border-border space-y-3">
                    <Button className="w-full h-11 text-sm font-bold shadow-xl" variant={penalty_delta <= 0 ? 'primary' : 'danger'} onClick={() => onApply(analysis.modified_chromosome)}>
                        {penalty_delta <= 0 ? 'Apply Optimized' : 'Apply Anyway'}
                    </Button>
                    
                    {hill_climbed_chromosome && hill_climb_improved && (
                        <Button className="w-full h-11 relative overflow-hidden group shadow-lg" variant="primary" onClick={() => onAutoFix(hill_climbed_chromosome)}>
                            <div className="absolute inset-0 bg-gradient-to-r from-accent/40 to-transparent group-hover:scale-110 transition-transform"></div>
                            <span className="flex items-center justify-center gap-2 relative z-10 font-bold text-sm">
                                <Zap size={16} fill="currentColor" /> Magic Auto-Fix
                            </span>
                        </Button>
                    )}
                    
                    <button onClick={onCancel} className="w-full text-xs font-bold text-text-muted hover:text-text-primary uppercase tracking-widest transition-colors py-2">Discard Changes</button>
                </div>
            </div>
        </div>
    );
}
