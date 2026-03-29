import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listInstitutions, createInstitution } from '../api/institutions'
import { useInstitutionStore } from '../store/institutionStore'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { Plus, Calendar } from 'lucide-react'
import { formatDate } from '../utils/formatters'

export default function SelectInstitutionPage() {
  const navigate = useNavigate()
  const { setInstitution } = useInstitutionStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', days_per_week: 5, periods_per_day: 8, period_duration_minutes: 55, lunch_break_after_period: 4 })

  const { data: institutions, isLoading } = useQuery({ queryKey: ['institutions'], queryFn: listInstitutions })

  const createMut = useMutation({
    mutationFn: () => createInstitution(form),
    onSuccess: (inst) => {
      qc.invalidateQueries({ queryKey: ['institutions'] })
      setShowForm(false)
      setInstitution(inst.id, inst.name)
      navigate('/dashboard')
    },
  })

  const handleSelect = (id: string, name: string) => {
    setInstitution(id, name)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-bold tracking-tight text-accent mb-2">ChronoGen</h1>
        <p className="text-text-secondary text-sm">Genetic Algorithm Timetable Generator</p>
      </div>

      {isLoading ? (
        <Spinner size={32} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
          {institutions?.map((inst) => (
            <div key={inst.id} className="bg-surface border border-border rounded-lg p-5 hover:border-accent/40 transition-colors group">
              <h3 className="font-display font-bold text-base tracking-tight mb-1">{inst.name}</h3>
              <div className="text-xs text-text-secondary space-y-1 mb-4">
                <p className="flex items-center gap-1.5"><Calendar size={12} />{inst.days_per_week} days × {inst.periods_per_day} periods</p>
                <p>{formatDate(inst.created_at)}</p>
              </div>
              <Button size="sm" onClick={() => handleSelect(inst.id, inst.name)} className="w-full">Select</Button>
            </div>
          ))}

          <button onClick={() => setShowForm(true)} className="border-2 border-dashed border-border rounded-lg p-5 flex flex-col items-center justify-center gap-2 text-text-muted hover:border-accent/40 hover:text-accent transition-colors min-h-[160px]">
            <Plus size={24} />
            <span className="text-sm font-medium">New Institution</span>
          </button>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Institution">
        <div className="space-y-4">
          <Input label="Institution Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. GEHU Bhimtal" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Days / Week" type="number" value={form.days_per_week} onChange={(e) => setForm({ ...form, days_per_week: +e.target.value })} />
            <Input label="Periods / Day" type="number" value={form.periods_per_day} onChange={(e) => setForm({ ...form, periods_per_day: +e.target.value })} />
            <Input label="Period Duration (min)" type="number" value={form.period_duration_minutes} onChange={(e) => setForm({ ...form, period_duration_minutes: +e.target.value })} />
            <Input label="Lunch After Period" type="number" value={form.lunch_break_after_period} onChange={(e) => setForm({ ...form, lunch_break_after_period: +e.target.value })} />
          </div>
          <Button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} className="w-full">
            {createMut.isPending ? 'Creating...' : 'Create Institution'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
