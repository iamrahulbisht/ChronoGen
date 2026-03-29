import { X } from 'lucide-react'

interface Props { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }

export default function Modal({ open, onClose, title, children, wide }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-surface border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto ${wide ? 'w-[720px]' : 'w-[500px]'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
