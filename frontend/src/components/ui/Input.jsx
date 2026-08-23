import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-xl border border-white/10 bg-[#1A1A1A]/50 px-4 py-2 text-sm text-[#F5F5F5] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#6b7280] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4A437] focus-visible:border-[#D4A437] disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-md",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
export default Input

