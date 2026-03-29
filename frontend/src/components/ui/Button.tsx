import { cn } from '../../utils/cn'

const variants: Record<string, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-white',
  secondary: 'bg-transparent border border-border text-text-secondary hover:border-accent hover:text-accent',
  danger: 'bg-transparent border border-danger text-danger hover:bg-danger hover:text-white',
}

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export default function Button({ variant = 'primary', size = 'md', className, children, ...props }: Props) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'
  return (
    <button className={cn('font-medium rounded transition-colors disabled:opacity-40', variants[variant], sizeClass, className)} {...props}>
      {children}
    </button>
  )
}
