import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useInstitutionStore } from '../store/institutionStore'
import { listSubjects, createSubject, updateSubject, deleteSubject } from '../api/subjects'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { Plus, Pencil, Trash2, FlaskConical, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SubjectResponse } from '../types/subject'

const ROOM_TYPES = ['classroom', 'lab', 'seminar_room', 'lecture_hall']
const defaultForm = { subject_code: '', name: '', requires_room_type: 'classroom', min_lectures_per_week: 3, is_lab: false, is_split_allowed: true }

export default function SubjectsPage() {
  const { institutionId } = useInstitutionStore()
  const id = institutionId!
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SubjectResponse | null>(null)
  const [deleting, setDeleting] = useState<SubjectResponse | null>(null)
  const [form, setForm] = useState(defaultForm)

  const { data: subjects, isLoading } = useQuery({ queryKey: ['subjects', id], queryFn: () => listSubjects(id) })

  const saveMut = useMutation({
    mutationFn: () => editing ? updateSubject(id, editing.id, form) : createSubject(id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects', id] }); setShowForm(false); setEditing(null); toast.success(editing ? 'Subject updated' : 'Subject created') },
    onError: (e) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: () => deleteSubject(id, deleting!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects', id] }); setDeleting(null); toast.success('Subject deleted') },
  })

  const openAdd = () => { setForm({ ...defaultForm }); setEditing(null); setShowForm(true) }
  const openEdit = (s: SubjectResponse) => { setForm({ subject_code: s.subject_code, name: s.name, requires_room_type: s.requires_room_type, min_lectures_per_week: s.min_lectures_per_week, is_lab: s.is_lab, is_split_allowed: s.is_split_allowed }); setEditing(s); setShowForm(true) }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-2xl font-bold tracking-tight">Subjects</h2>
        <Button onClick={openAdd} size="sm"><Plus size={14} className="mr-1.5" />Add Subject</Button>
      </div>

      {isLoading ? <Spinner size={24} /> : !subjects?.length ? <EmptyState message="No subjects found" /> : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-elevated text-text-secondary uppercase tracking-wider text-xs">
              <th className="text-left px-5 py-2.5">Code</th><th className="text-left px-5 py-2.5">Name</th>
              <th className="text-left px-5 py-2.5">Room Type</th><th className="text-left px-5 py-2.5">Lec/wk</th>
              <th className="text-left px-5 py-2.5">Lab</th><th className="text-left px-5 py-2.5">Split</th>
              <th className="text-right px-5 py-2.5">Actions</th>
            </tr></thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-elevated transition-colors">
                  <td className="px-5 py-2.5 font-code text-xs">{s.subject_code}</td>
                  <td className="px-5 py-2.5">{s.name}</td>
                  <td className="px-5 py-2.5"><Badge variant={s.requires_room_type}>{s.requires_room_type}</Badge></td>
                  <td className="px-5 py-2.5 tabular-nums">{s.min_lectures_per_week}</td>
                  <td className="px-5 py-2.5">{s.is_lab ? <FlaskConical size={14} className="text-lab-badge" /> : <X size={14} className="text-text-muted" />}</td>
                  <td className="px-5 py-2.5">{s.is_split_allowed ? <Check size={14} className="text-success" /> : <X size={14} className="text-text-muted" />}</td>
                  <td className="px-5 py-2.5 text-right space-x-2">
                    <button onClick={() => openEdit(s)} className="text-text-secondary hover:text-accent"><Pencil size={14} /></button>
                    <button onClick={() => setDeleting(s)} className="text-text-secondary hover:text-danger"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Subject' : 'Add Subject'}>
        <div className="space-y-4">
          <Input label="Subject Code" value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })} placeholder="e.g. TCS-611" />
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Data Structures" />
          <Select label="Requires Room Type" value={form.requires_room_type} onChange={(e) => setForm({ ...form, requires_room_type: e.target.value })}>{ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</Select>
          <Input label="Min Lectures / Week" type="number" value={form.min_lectures_per_week} onChange={(e) => setForm({ ...form, min_lectures_per_week: +e.target.value })} />
          <div className="flex gap-4">
            <button onClick={() => setForm(f => ({ ...f, is_lab: !f.is_lab }))} className={`flex-1 rounded px-3 py-2 text-sm border ${form.is_lab ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-border bg-elevated text-text-secondary'}`}>
              🧪 Lab {form.is_lab ? '(Yes)' : '(No)'}
            </button>
            <button onClick={() => setForm(f => ({ ...f, is_split_allowed: !f.is_split_allowed }))} className={`flex-1 rounded px-3 py-2 text-sm border ${form.is_split_allowed ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-border bg-elevated text-text-secondary'}`}>
              Split {form.is_split_allowed ? '(Yes)' : '(No)'}
            </button>
          </div>
          {form.is_lab && <p className="text-xs text-sky-400 bg-sky-500/5 rounded px-3 py-2">Lab subjects consume 2 consecutive periods</p>}
          <Button onClick={() => saveMut.mutate()} disabled={!form.subject_code || !form.name || saveMut.isPending} className="w-full">
            {saveMut.isPending ? 'Saving...' : editing ? 'Update Subject' : 'Add Subject'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => delMut.mutate()} title="Delete Subject" message={`Delete subject "${deleting?.name}"?`} loading={delMut.isPending} />
    </div>
  )
}
