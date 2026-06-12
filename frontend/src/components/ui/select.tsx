import * as React from "react"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      className={`flex h-9 w-full rounded border border-border bg-background text-foreground px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = "Select"

export { Select }
