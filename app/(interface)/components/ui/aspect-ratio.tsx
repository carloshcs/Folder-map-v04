"use client";

import * as React from "react";

import { cn } from "./utils";

type AspectRatioProps = React.HTMLAttributes<HTMLDivElement> & {
  ratio?: number;
};

const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ ratio = 1, className, style, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="aspect-ratio"
      className={cn("relative w-full overflow-hidden", className)}
      style={style}
      {...props}
    >
      <div
        aria-hidden
        className="block"
        style={{ paddingBottom: `${100 / ratio}%` }}
      />
      <div className="absolute inset-0 h-full w-full">{children}</div>
    </div>
  ),
);

AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
