import Button from './Button'

interface Props { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; loading?: boolean }

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, loading }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-lg p-6 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-base font-bold mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>{loading ? 'Deleting...' : 'Delete'}</Button>
        </div>
      </div>
    </div>
  )
}
