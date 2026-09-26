import * as React from "react"

import { cn } from "@/lib/utils"
import { withSelectAllOnFocus } from "@/lib/selectOnFocus"

const Input = React.forwardRef(({ className, type, onWheel, onKeyDown, onFocus, ...props }, ref) => {
  const selectProps = withSelectAllOnFocus({ type, onFocus });
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      onWheel={(e) => {
        if (type === "number") e.currentTarget.blur();
        onWheel?.(e);
      }}
      onKeyDown={(e) => {
        if (type === "number" && (e.key === "ArrowUp" || e.key === "ArrowDown")) e.preventDefault();
        onKeyDown?.(e);
      }}
      {...props}
      {...selectProps}
    />
  );
})
Input.displayName = "Input"

export { Input }
