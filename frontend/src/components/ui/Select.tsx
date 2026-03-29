import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string }

const Select = forwardRef<HTMLSelectElement, Props>(({ label, error, className, children, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="text-xs text-text-secondary font-medium">{label}</label>}
    <select ref={ref} className={cn('w-full bg-elevated border border-border text-text-primary rounded px-3 py-2 text-sm focus:border-accent focus:outline-none', className)} {...props}>
      {children}
    </select>
    {error && <p className="text-xs text-danger">{error}</p>}
  </div>
))
Select.displayName = 'Select'
export default Select
