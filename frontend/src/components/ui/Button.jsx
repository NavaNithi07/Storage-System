import * as React from "react"
import { cn } from "../../lib/utils"

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
  
  const variants = {
    default: "bg-[#D4A437] text-black shadow-none hover:bg-[#D4A437]/90 hover:shadow-[0_0_15px_rgba(212,164,55,0.4)] transition-all",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "border border-[#D4A437]/30 bg-transparent text-[#D4A437] shadow-sm hover:bg-[#D4A437]/10 hover:text-[#D4A437] backdrop-blur-sm transition-all",
    secondary: "bg-[#1A1A1A] text-[#F5F5F5] shadow-sm hover:bg-[#2A2A2A] border border-white/5",
    ghost: "hover:bg-[#D4A437]/10 hover:text-[#D4A437] text-slate-300 transition-colors",
    link: "text-[#D4A437] underline-offset-4 hover:underline",
  }

  const sizes = {
    default: "h-10 px-6 py-2",
    sm: "h-8 px-4 text-xs",
    lg: "h-12 px-8 text-base",
    icon: "h-10 w-10",
  }

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
export default Button

