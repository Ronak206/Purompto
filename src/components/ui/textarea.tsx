import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea className={cn("flex w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50 resize-none", className)} ref={ref} {...props} />
));
Textarea.displayName = "Textarea";
export { Textarea };
