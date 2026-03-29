import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

interface Props extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string }

const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="text-xs text-text-secondary font-medium">{label}</label>}
    <input ref={ref} className={cn('w-full bg-elevated border border-border text-text-primary rounded px-3 py-2 text-sm focus:border-accent focus:outline-none placeholder:text-text-muted', error && 'border-danger', className)} {...props} />
    {error && <p className="text-xs text-danger">{error}</p>}
  </div>
))
Input.displayName = 'Input'
export default Input
