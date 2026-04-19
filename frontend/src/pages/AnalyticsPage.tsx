import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listJobs, getJob } from '../api/jobs'
import { useInstitutionStore } from '../store/institutionStore'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import { formatScore } from '../utils/formatters'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { TrendingUp, Activity, AlertCircle, Calendar } from 'lucide-react'

export default function AnalyticsPage() {
  const { institutionId } = useInstitutionStore()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', institutionId],
    queryFn: () => listJobs(institutionId!),
    enabled: !!institutionId
  })

  // Filter only completed jobs for analytics
  const completedJobs = jobs?.filter(j => j.status === 'completed') || []
  const currentJobId = selectedJobId || completedJobs[0]?.job_id

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', currentJobId],
    queryFn: () => getJob(currentJobId!),
    enabled: !!currentJobId
  })

  if (jobsLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>

  const res = job?.result
  const fitnessData = (res?.fitness_history || []).map((h: any, i: number) => ({ gen: i, ...h }))
  const constraintData = res?.constraint_breakdown ? Object.entries(res.constraint_breakdown).map(([k, v]) => ({
    name: k, value: v as number, fill: k.startsWith('H') ? '#ef4444' : v === 0 ? '#22c55e' : '#f59e0b',
  })) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <TrendingUp className="text-accent" /> Engine Analytics
          </h1>
          <p className="text-sm text-text-secondary">Analyze algorithm performance and constraint optimization</p>
        </div>
        
        {completedJobs.length > 0 && (
          <div className="flex items-center gap-3 bg-surface border border-border p-1.5 rounded-xl">
            <Calendar size={14} className="ml-2 text-text-muted" />
            <select 
              value={currentJobId} 
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-transparent text-sm font-medium text-text-primary focus:outline-none pr-4"
            >
              {completedJobs.map(j => (
                <option key={j.job_id} value={j.job_id}>{j.algorithm} - {new Date(j.created_at).toLocaleDateString()}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!currentJobId ? (
        <div className="bg-surface border border-border rounded-2xl p-20 text-center">
          <Activity size={48} className="mx-auto text-text-muted mb-4 opacity-20" />
          <p className="text-text-secondary">No completed jobs found to analyze. Generate a timetable first!</p>
        </div>
      ) : jobLoading ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : (
        <div className="space-y-6">
           {/* Top Stats */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Algorithm</p>
              <Badge className="capitalize">{job?.algorithm}</Badge>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-6">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Final Fitness</p>
              <p className="font-display text-2xl font-black text-accent">{formatScore(res?.fitness_score || 0)}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-6">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Total Generations</p>
              <p className="font-display text-2xl font-black text-text-primary">{res?.generations_run}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-6">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Hard Constraints</p>
              <div className="flex items-center gap-2">
                <p className={`font-display text-2xl font-black ${res?.total_penalty === 0 ? 'text-success' : 'text-danger'}`}>
                   {Object.entries(res?.constraint_breakdown || {}).filter(([k]) => k.startsWith('H')).reduce((acc, [_, v]) => acc + (v as number), 0)}
                </p>
                {res?.total_penalty !== 0 && <AlertCircle size={16} className="text-danger" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fitness Convergence Chart */}
            <div className="bg-surface border border-border rounded-2xl p-6 h-[400px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  Convergence Rate
                </h3>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fitnessData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#242430" vertical={false} />
                    <XAxis dataKey="gen" stroke="#44445a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#44445a" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 12, fontSize: 11 }} />
                    <Line type="monotone" dataKey="best" stroke="#6c63ff" strokeWidth={3} dot={false} animationDuration={2000} />
                    <Line type="monotone" dataKey="mean" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Constraint Bar Chart */}
            <div className="bg-surface border border-border rounded-2xl p-6 h-[400px] flex flex-col">
               <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-sm font-bold uppercase tracking-widest">
                  Constraint Violations
                </h3>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <ResponsiveContainer width="100%" height={Math.max(300, constraintData.length * 35)}>
                  <BarChart layout="vertical" data={constraintData} margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#242430" horizontal={false} />
                    <XAxis type="number" stroke="#44445a" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" stroke="#44445a" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} width={120} />
                    <Tooltip cursor={{ fill: '#242430' }} contentStyle={{ background: '#111118', border: '1px solid #242430', borderRadius: 12, fontSize: 11 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {constraintData.map((d, i) => <Cell key={`cell-${i}`} fill={d.fill || '#fff'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
