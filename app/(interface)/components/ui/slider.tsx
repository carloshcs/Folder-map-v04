"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "./utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    {/* Track (gray line) */}
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-muted-foreground/20" />
    </SliderPrimitive.Track>

    {/* Thumb (the draggable button) */}
    <SliderPrimitive.Thumb
      className={cn(
        // Core thumb style
        "block h-4 w-4 rounded-full shadow-sm ring-0 transition-transform duration-200",
        // Light mode: black thumb
        "bg-black border border-black",
        // Dark mode: white thumb with white border
        "dark:bg-white dark:border-white",
        // Hover / focus polish
        "hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
