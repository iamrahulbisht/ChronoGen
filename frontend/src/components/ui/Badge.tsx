import { cn } from '../../utils/cn'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  running: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
  valid: 'bg-green-500/10 text-green-400',
  invalid: 'bg-red-500/10 text-red-400',
  lab: 'bg-sky-500/10 text-sky-400',
  classroom: 'bg-violet-500/10 text-violet-400',
  seminar_room: 'bg-amber-500/10 text-amber-400',
  lecture_hall: 'bg-teal-500/10 text-teal-400',
}

type BadgeProps = {
  children: React.ReactNode
  variant?: string
  className?: string
}

export default function Badge({
  children,
  variant,
  className,
}: BadgeProps) {
  const color = statusColors[variant || ''] || 'bg-elevated text-text-secondary'

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium inline-block',
        color,
        className
      )}
    >
      {children}
    </span>
  )
}