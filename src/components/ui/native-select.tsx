import * as React from "react";
import { cn } from "@/lib/utils";

// Native <select> styled like shadcn inputs — best UX on phones.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { NativeSelect };
