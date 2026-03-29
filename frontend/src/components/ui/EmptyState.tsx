import { Inbox } from 'lucide-react'

export default function EmptyState({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-muted">
      <Inbox size={48} className="mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
