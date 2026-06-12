import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none"

    const variants = {
      default: "btn-primary text-white hover:opacity-90",
      destructive: "btn-destructive text-white hover:opacity-90",
      outline: "border border-border bg-transparent text-foreground hover:bg-muted",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "text-foreground hover:bg-muted",
      link: "underline-offset-4 hover:underline text-primary",
    }

    const sizes = {
      default: "h-9 py-2 px-4",
      sm: "h-8 px-3 text-xs",
      lg: "h-10 px-6",
      icon: "h-9 w-9",
    }

    return (
      <button
        className={cn(base, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
