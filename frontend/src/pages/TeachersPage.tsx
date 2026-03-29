import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useInstitutionStore } from '../store/institutionStore'
import { listTeachers, createTeacher, updateTeacher, deleteTeacher } from '../api/teachers'
import { listSubjects } from '../api/subjects'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { Plus, Pencil, Trash2, Search, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TeacherResponse } from '../types/teacher'

const defaultForm = { teacher_code: '', name: '', teaches_subjects: [] as string[], max_lectures_per_week: 20, max_consecutive_lectures: 4, prefers_morning: false, unavailable_periods: [] as [number, number][] }

export default function TeachersPage() {
  const { institutionId } = useInstitutionStore()
  const id = institutionId!
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TeacherResponse | null>(null)
  const [deleting, setDeleting] = useState<TeacherResponse | null>(null)
  const [form, setForm] = useState(defaultForm)

  const { data: teachers, isLoading } = useQuery({ queryKey: ['teachers', id], queryFn: () => listTeachers(id) })
  const { data: subjects } = useQuery({ queryKey: ['subjects', id], queryFn: () => listSubjects(id) })

  const saveMut = useMutation({
    mutationFn: () => editing ? updateTeacher(id, editing.id, form) : createTeacher(id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teachers', id] }); setShowForm(false); setEditing(null); toast.success(editing ? 'Teacher updated' : 'Teacher created') },
    onError: (e) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: () => deleteTeacher(id, deleting!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teachers', id] }); setDeleting(null); toast.success('Teacher deleted') },
    onError: (e) => toast.error(e.message),
  })

  const openAdd = () => { setForm({ ...defaultForm }); setEditing(null); setShowForm(true) }
  const openEdit = (t: TeacherResponse) => {
    setForm({ teacher_code: t.teacher_code, name: t.name, teaches_subjects: [...t.teaches_subjects], max_lectures_per_week: t.max_lectures_per_week, max_consecutive_lectures: t.max_consecutive_lectures, prefers_morning: t.prefers_morning, unavailable_periods: [...t.unavailable_periods] })
    setEditing(t); setShowForm(true)
  }

  const toggleSubject = (code: string) => {
    setForm(f => ({ ...f, teaches_subjects: f.teaches_subjects.includes(code) ? f.teaches_subjects.filter(s => s !== code) : [...f.teaches_subjects, code] }))
  }

  const filtered = (teachers || []).filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.teacher_code.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-2xl font-bold tracking-tight">Teachers</h2>
        <Button onClick={openAdd} size="sm"><Plus size={14} className="mr-1.5" />Add Teacher</Button>
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input className="w-full bg-elevated border border-border text-sm text-text-primary rounded pl-9 pr-3 py-2 focus:border-accent focus:outline-none" placeholder="Search teachers..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? <Spinner size={24} /> : filtered.length === 0 ? <EmptyState message="No teachers found" /> : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-elevated text-text-secondary uppercase tracking-wider text-xs">
              <th className="text-left px-5 py-2.5">Code</th><th className="text-left px-5 py-2.5">Name</th>
              <th className="text-left px-5 py-2.5">Subjects</th><th className="text-left px-5 py-2.5">Max/wk</th>
              <th className="text-left px-5 py-2.5">Consec</th><th className="text-left px-5 py-2.5">AM</th>
              <th className="text-right px-5 py-2.5">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-elevated transition-colors">
                  <td className="px-5 py-2.5 font-code text-xs">{t.teacher_code}</td>
                  <td className="px-5 py-2.5">{t.name}</td>
                  <td className="px-5 py-2.5"><div className="flex flex-wrap gap-1">{t.teaches_subjects.map(s => <Badge key={s}>{s}</Badge>)}</div></td>
                  <td className="px-5 py-2.5 tabular-nums">{t.max_lectures_per_week}</td>
                  <td className="px-5 py-2.5 tabular-nums">{t.max_consecutive_lectures}</td>
                  <td className="px-5 py-2.5">{t.prefers_morning && <Sun size={14} className="text-warning" />}</td>
                  <td className="px-5 py-2.5 text-right space-x-2">
                    <button onClick={() => openEdit(t)} className="text-text-secondary hover:text-accent"><Pencil size={14} /></button>
                    <button onClick={() => setDeleting(t)} className="text-text-secondary hover:text-danger"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Teacher' : 'Add Teacher'} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Teacher Code" value={form.teacher_code} onChange={(e) => setForm({ ...form, teacher_code: e.target.value })} placeholder="e.g. T001" />
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dr. Singh" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Max Lectures/Week" type="number" value={form.max_lectures_per_week} onChange={(e) => setForm({ ...form, max_lectures_per_week: +e.target.value })} />
            <Input label="Max Consecutive" type="number" value={form.max_consecutive_lectures} onChange={(e) => setForm({ ...form, max_consecutive_lectures: +e.target.value })} />
            <div className="space-y-1">
              <label className="text-xs text-text-secondary font-medium">Prefers Morning</label>
              <button onClick={() => setForm(f => ({ ...f, prefers_morning: !f.prefers_morning }))} className={`w-full rounded px-3 py-2 text-sm border ${form.prefers_morning ? 'border-accent bg-accent-dim text-accent' : 'border-border bg-elevated text-text-secondary'}`}>
                {form.prefers_morning ? '☀️ Yes' : 'No'}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary font-medium">Teaches Subjects</label>
            <div className="flex flex-wrap gap-1.5">
              {(subjects || []).map(s => (
                <button key={s.subject_code} onClick={() => toggleSubject(s.subject_code)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${form.teaches_subjects.includes(s.subject_code) ? 'border-accent bg-accent-dim text-accent' : 'border-border bg-elevated text-text-secondary hover:border-accent/40'}`}>
                  {s.subject_code}
                </button>
              ))}
              {(!subjects || subjects.length === 0) && <p className="text-xs text-text-muted">Add subjects first</p>}
            </div>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={!form.teacher_code || !form.name || saveMut.isPending} className="w-full">
            {saveMut.isPending ? 'Saving...' : editing ? 'Update Teacher' : 'Add Teacher'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => delMut.mutate()} title="Delete Teacher" message={`Delete teacher "${deleting?.name}"?`} loading={delMut.isPending} />
    </div>
  )
}
