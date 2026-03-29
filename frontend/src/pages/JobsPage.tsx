import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useInstitutionStore } from '../store/institutionStore'
import { listJobs, createJob, deleteJob } from '../api/jobs'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { Eye, Trash2, Zap } from 'lucide-react'
import { truncateId, formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'

const ALGORITHMS = [
  { value: 'basic_ga', label: 'Basic GA', desc: 'Standard genetic algorithm' },
  { value: 'memetic_ga', label: 'Memetic GA', desc: 'GA + local hill climbing' },
  { value: 'island_ga', label: 'Island GA', desc: '4-island parallel model' },
  { value: 'hyper_heuristic', label: 'Hyper-heuristic', desc: 'Adaptive operator selection' },
  { value: 'nsga2', label: 'NSGA-II', desc: 'Multi-objective Pareto search' },
]

const defaultConfig = { population_size: 100, max_generations: 500, crossover_rate: 0.85, mutation_rate: 0.02, tournament_size: 5, elitism_count: 2, stagnation_window: 50, stagnation_mutation_boost: 0.08, target_fitness: 9800, random_seed: 42, hard_penalty_weight: 1, soft_penalty_weight: 1 }

export default function JobsPage() {
  const { institutionId } = useInstitutionStore()
  const id = institutionId!
  const nav = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const [algo, setAlgo] = useState('basic_ga')
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState(defaultConfig)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: jobs, isLoading } = useQuery({ queryKey: ['jobs', id], queryFn: () => listJobs(id) })

  const createMut = useMutation({
    mutationFn: () => createJob({ institution_id: id, algorithm: algo, ga_config: config }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['jobs', id] }); toast.success('Job started'); nav(`/jobs/${(r as Record<string, string>).job_id}`) },
    onError: (e) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: () => deleteJob(deleting!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs', id] }); setDeleting(null); toast.success('Job deleted') },
  })

  const tabs = ['', 'pending', 'running', 'completed', 'failed']
  const filtered = (jobs || []).filter(j => !filter || j.status === filter)

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold tracking-tight">Jobs</h2>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${filter === t ? 'bg-accent text-white' : 'bg-elevated text-text-secondary hover:text-text-primary'}`}>
            {t || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : filtered.length === 0 ? <EmptyState message="No jobs" /> : (
        <div className="space-y-2">
          {filtered.map(j => (
            <div key={j.job_id} className="bg-surface border border-border rounded-lg px-5 py-3 flex items-center justify-between hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-4">
                <span className="font-code text-xs text-text-secondary">{truncateId(j.job_id)}</span>
                <Badge>{j.algorithm}</Badge>
                <Badge variant={j.status}>
                  {j.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-1.5" />}
                  {j.status}
                </Badge>
                <span className="text-xs text-text-muted">{formatDate(j.created_at)}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => nav(`/jobs/${j.job_id}`)}><Eye size={12} className="mr-1" />View</Button>
                <button onClick={() => setDeleting(j.job_id)} className="text-text-muted hover:text-danger"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
        <h3 className="font-display text-sm font-bold">Create New Job</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {ALGORITHMS.map(a => (
            <button key={a.value} onClick={() => setAlgo(a.value)}
              className={`rounded-lg p-3 text-left border transition-colors ${algo === a.value ? 'border-accent bg-accent-dim' : 'border-border bg-elevated hover:border-accent/30'}`}>
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-text-muted mt-0.5">{a.desc}</p>
            </button>
          ))}
        </div>

        <button onClick={() => setShowConfig(!showConfig)} className="text-xs text-accent hover:text-accent-hover">
          {showConfig ? '▼' : '▶'} Advanced GA Configuration
        </button>
        {showConfig && (
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(config).map(([k, v]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs text-text-secondary">{k.replace(/_/g, ' ')}</label>
                <input type="number" step={typeof v === 'number' && v < 1 ? 0.01 : 1} value={v}
                  onChange={e => setConfig(c => ({ ...c, [k]: +e.target.value }))}
                  className="w-full bg-elevated border border-border text-text-primary rounded px-2 py-1.5 text-sm focus:border-accent focus:outline-none" />
              </div>
            ))}
          </div>
        )}

        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="w-full" size="lg">
          <Zap size={16} className="mr-2" />{createMut.isPending ? 'Starting...' : 'Generate Timetable'}
        </Button>
      </div>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => delMut.mutate()} title="Delete Job" message="Delete this job and all its output files?" loading={delMut.isPending} />
    </div>
  )
}
