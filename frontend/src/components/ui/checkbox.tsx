import * as React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<
  HTMLInputElement,
  CheckboxProps
>(({ className, onCheckedChange, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    className={cn(
      "h-4 w-4 shrink-0 rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-card)] accent-[var(--color-primary)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
