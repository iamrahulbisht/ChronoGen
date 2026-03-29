import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useInstitutionStore } from '../store/institutionStore'
import { listSections, createSection, updateSection, deleteSection } from '../api/sections'
import { listSubjects } from '../api/subjects'
import { listTeachers } from '../api/teachers'
import { listRooms } from '../api/institutions'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SectionResponse } from '../types/section'

interface CurRow { subject_id: string; teacher_id: string; min_per_week: number }
const defaultForm = { section_code: '', name: '', student_count: 60, fixed_classroom: '', fixed_lab: '', curriculum: [] as CurRow[] }

export default function SectionsPage() {
  const { institutionId } = useInstitutionStore()
  const id = institutionId!
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SectionResponse | null>(null)
  const [deleting, setDeleting] = useState<SectionResponse | null>(null)
  const [form, setForm] = useState(defaultForm)

  const { data: sections, isLoading } = useQuery({ queryKey: ['sections', id], queryFn: () => listSections(id) })
  const { data: subjects } = useQuery({ queryKey: ['subjects', id], queryFn: () => listSubjects(id) })
  const { data: teachers } = useQuery({ queryKey: ['teachers', id], queryFn: () => listTeachers(id) })
  const { data: rooms } = useQuery({ queryKey: ['rooms', id], queryFn: () => listRooms(id) })

  const saveMut = useMutation({
    mutationFn: () => {
      const p = { ...form, fixed_classroom: form.fixed_classroom || null, fixed_lab: form.fixed_lab || null }
      return editing ? updateSection(id, editing.id, p) : createSection(id, p)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections', id] }); setShowForm(false); setEditing(null); toast.success(editing ? 'Updated' : 'Created') },
    onError: (e) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: () => deleteSection(id, deleting!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections', id] }); setDeleting(null); toast.success('Deleted') },
  })

  const openAdd = () => { setForm({ ...defaultForm, curriculum: [] }); setEditing(null); setShowForm(true) }
  const openEdit = (s: SectionResponse) => {
    setForm({ section_code: s.section_code, name: s.name, student_count: s.student_count, fixed_classroom: s.fixed_classroom || '', fixed_lab: s.fixed_lab || '', curriculum: s.curriculum.map(c => ({ ...c })) })
    setEditing(s); setShowForm(true)
  }
  const addCurRow = () => setForm(f => ({ ...f, curriculum: [...f.curriculum, { subject_id: '', teacher_id: '', min_per_week: 3 }] }))
  const removeCurRow = (i: number) => setForm(f => ({ ...f, curriculum: f.curriculum.filter((_, j) => j !== i) }))
  const updateCurRow = (i: number, key: keyof CurRow, val: string | number) => setForm(f => ({ ...f, curriculum: f.curriculum.map((r, j) => j === i ? { ...r, [key]: val } : r) }))

  const tMap = Object.fromEntries((teachers || []).map(t => [t.teacher_code, t]))
  const classrooms = (rooms || []).filter(r => r.type === 'classroom')
  const labs = (rooms || []).filter(r => r.type === 'lab')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-2xl font-bold tracking-tight">Sections</h2>
        <Button onClick={openAdd} size="sm"><Plus size={14} className="mr-1.5" />Add Section</Button>
      </div>
      {isLoading ? <Spinner /> : !sections?.length ? <EmptyState message="No sections" /> : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-elevated text-text-secondary uppercase tracking-wider text-xs">
              <th className="text-left px-5 py-2.5">Code</th><th className="text-left px-5 py-2.5">Name</th>
              <th className="text-left px-5 py-2.5">Students</th><th className="text-left px-5 py-2.5">Subjects</th>
              <th className="text-right px-5 py-2.5">Actions</th>
            </tr></thead>
            <tbody>{sections.map(s => (
              <tr key={s.id} className="border-b border-border hover:bg-elevated">
                <td className="px-5 py-2.5 font-code text-xs">{s.section_code}</td>
                <td className="px-5 py-2.5">{s.name}</td>
                <td className="px-5 py-2.5 tabular-nums">{s.student_count}</td>
                <td className="px-5 py-2.5"><Badge>{s.curriculum.length}</Badge></td>
                <td className="px-5 py-2.5 text-right space-x-2">
                  <button onClick={() => openEdit(s)} className="text-text-secondary hover:text-accent"><Pencil size={14} /></button>
                  <button onClick={() => setDeleting(s)} className="text-text-secondary hover:text-danger"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Section' : 'Add Section'} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Code" value={form.section_code} onChange={e => setForm({ ...form, section_code: e.target.value })} />
            <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input label="Students" type="number" value={form.student_count} onChange={e => setForm({ ...form, student_count: +e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Fixed Classroom" value={form.fixed_classroom} onChange={e => setForm({ ...form, fixed_classroom: e.target.value })}>
              <option value="">None</option>{classrooms.map(r => <option key={r.id} value={r.room_code}>{r.name}</option>)}
            </Select>
            <Select label="Fixed Lab" value={form.fixed_lab} onChange={e => setForm({ ...form, fixed_lab: e.target.value })}>
              <option value="">None</option>{labs.map(r => <option key={r.id} value={r.room_code}>{r.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-text-secondary font-medium">Curriculum</label>
              <Button size="sm" variant="secondary" onClick={addCurRow}><Plus size={12} className="mr-1" />Add</Button>
            </div>
            {form.curriculum.length === 0 && <p className="text-xs text-text-muted">Add at least one subject</p>}
            {form.curriculum.map((row, i) => {
              const t = tMap[row.teacher_id]; const mis = t && row.subject_id && !t.teaches_subjects.includes(row.subject_id)
              return (<div key={i} className="space-y-1">
                <div className="flex gap-2 items-end">
                  <Select value={row.subject_id} onChange={e => updateCurRow(i, 'subject_id', e.target.value)} className="flex-1">
                    <option value="">Subject</option>{(subjects || []).map(s => <option key={s.subject_code} value={s.subject_code}>{s.subject_code}</option>)}
                  </Select>
                  <Select value={row.teacher_id} onChange={e => updateCurRow(i, 'teacher_id', e.target.value)} className="flex-1">
                    <option value="">Teacher</option>{(teachers || []).map(t => <option key={t.teacher_code} value={t.teacher_code}>{t.name}</option>)}
                  </Select>
                  <Input type="number" value={row.min_per_week} onChange={e => updateCurRow(i, 'min_per_week', +e.target.value)} className="w-16" />
                  <button onClick={() => removeCurRow(i)} className="text-text-muted hover:text-danger pb-1"><Trash2 size={14} /></button>
                </div>
                {mis && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle size={12} />Teacher not assigned to this subject</p>}
              </div>)
            })}
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={!form.section_code || form.curriculum.length === 0 || saveMut.isPending} className="w-full">
            {saveMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
          </Button>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => delMut.mutate()} title="Delete Section" message={`Delete "${deleting?.name}"?`} loading={delMut.isPending} />
    </div>
  )
}
