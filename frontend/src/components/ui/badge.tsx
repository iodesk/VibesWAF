import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-primary/10 text-primary",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive/10 text-destructive",
    outline: "bg-transparent text-foreground border border-border",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
    warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
