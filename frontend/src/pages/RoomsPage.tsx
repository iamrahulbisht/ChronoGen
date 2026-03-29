import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useInstitutionStore } from '../store/institutionStore'
import { listRooms, createRoom, updateRoom, deleteRoom } from '../api/institutions'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import type { RoomResponse } from '../types/institution'

const ROOM_TYPES = ['classroom', 'lab', 'seminar_room', 'lecture_hall']

export default function RoomsPage() {
  const { institutionId } = useInstitutionStore()
  const id = institutionId!
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RoomResponse | null>(null)
  const [deleting, setDeleting] = useState<RoomResponse | null>(null)
  const [form, setForm] = useState({ room_code: '', name: '', capacity: 60, type: 'classroom' })

  const { data: rooms, isLoading } = useQuery({ queryKey: ['rooms', id], queryFn: () => listRooms(id) })

  const saveMut = useMutation({
    mutationFn: () => editing
      ? updateRoom(id, editing.id, form)
      : createRoom(id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', id] })
      setShowForm(false); setEditing(null)
      toast.success(editing ? 'Room updated' : 'Room created')
    },
    onError: (e) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: () => deleteRoom(id, deleting!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', id] })
      setDeleting(null); toast.success('Room deleted')
    },
    onError: (e) => toast.error(e.message),
  })

  const openAdd = () => { setForm({ room_code: '', name: '', capacity: 60, type: 'classroom' }); setEditing(null); setShowForm(true) }
  const openEdit = (r: RoomResponse) => { setForm({ room_code: r.room_code, name: r.name, capacity: r.capacity, type: r.type }); setEditing(r); setShowForm(true) }

  const filtered = (rooms || []).filter((r) => {
    if (search && !r.room_code.toLowerCase().includes(search.toLowerCase()) && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter && r.type !== typeFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-2xl font-bold tracking-tight">Rooms</h2>
        <Button onClick={openAdd} size="sm"><Plus size={14} className="mr-1.5" />Add Room</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className="w-full bg-elevated border border-border text-sm text-text-primary rounded pl-9 pr-3 py-2 focus:border-accent focus:outline-none" placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="bg-elevated border border-border text-sm text-text-primary rounded px-3 py-2 focus:border-accent focus:outline-none" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {isLoading ? <Spinner size={24} /> : filtered.length === 0 ? <EmptyState message="No rooms found" /> : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-elevated text-text-secondary uppercase tracking-wider text-xs">
              <th className="text-left px-5 py-2.5">Code</th><th className="text-left px-5 py-2.5">Name</th>
              <th className="text-left px-5 py-2.5">Capacity</th><th className="text-left px-5 py-2.5">Type</th>
              <th className="text-right px-5 py-2.5">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border hover:bg-elevated transition-colors">
                  <td className="px-5 py-2.5 font-code text-xs">{r.room_code}</td>
                  <td className="px-5 py-2.5">{r.name}</td>
                  <td className="px-5 py-2.5 tabular-nums">{r.capacity}</td>
                  <td className="px-5 py-2.5"><Badge variant={r.type}>{r.type}</Badge></td>
                  <td className="px-5 py-2.5 text-right space-x-2">
                    <button onClick={() => openEdit(r)} className="text-text-secondary hover:text-accent"><Pencil size={14} /></button>
                    <button onClick={() => setDeleting(r)} className="text-text-secondary hover:text-danger"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Room' : 'Add Room'}>
        <div className="space-y-4">
          <Input label="Room Code" value={form.room_code} onChange={(e) => setForm({ ...form, room_code: e.target.value })} placeholder="e.g. CR-601" />
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Classroom 601" />
          <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Button onClick={() => saveMut.mutate()} disabled={!form.room_code || !form.name || saveMut.isPending} className="w-full">
            {saveMut.isPending ? 'Saving...' : editing ? 'Update Room' : 'Add Room'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => delMut.mutate()} title="Delete Room" message={`Delete room "${deleting?.name}"?`} loading={delMut.isPending} />
    </div>
  )
}
