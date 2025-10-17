import React from "react";

export type DialogueBoxProps = {
  width?: number;
  height?: number;
  radius?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  pointerWidth?: number;
  pointerHeight?: number;
  pointerPosition?: "left" | "center" | "right";
  className?: string;
  label?: string;
  fontSize?: number;
  fontFamily?: string;
};

/**
 * Clean rectangular dialogue box with a triangular pointer connected seamlessly.
 * Example:
 * <DialogueBox width={300} height={140} label="Hello!" />
 */
export default function DialogueBox({
  width = 320,
  height = 160,
  radius = 16,
  strokeColor = "#000",
  fillColor = "#fff",
  strokeWidth = 2,
  pointerWidth = 28,
  pointerHeight = 24,
  pointerPosition = "left",
  className,
  label,
  fontSize = 16,
  fontFamily = "Arial, sans-serif",
}: DialogueBoxProps) {
  const w = width;
  const h = height;
  
  // Add padding for stroke to prevent clipping at edges
  const strokePadding = Math.max(strokeWidth / 2, 1);
  const innerW = w - strokePadding * 2;
  const innerH = h - strokePadding * 2;

  let baseX = innerW * 0.2 + strokePadding;
  if (pointerPosition === "center") baseX = innerW * 0.5 - pointerWidth / 2 + strokePadding;
  if (pointerPosition === "right") baseX = innerW * 0.8 - pointerWidth + strokePadding;

  // Adjust coordinates for stroke padding
  const adjustedRadius = Math.min(radius, Math.min(innerW, innerH - pointerHeight) / 4);
  
  // Path combines rectangle and pointer so the pointer is part of the outline
  const path = `M${adjustedRadius + strokePadding} ${strokePadding} 
    H${innerW - adjustedRadius + strokePadding} 
    Q${innerW + strokePadding} ${strokePadding}, ${innerW + strokePadding} ${adjustedRadius + strokePadding} 
    V${innerH - pointerHeight - adjustedRadius + strokePadding}
    Q${innerW + strokePadding} ${innerH - pointerHeight + strokePadding}, ${innerW - adjustedRadius + strokePadding} ${innerH - pointerHeight + strokePadding} 
    H${baseX + pointerWidth} 
    L${baseX + pointerWidth / 2} ${innerH + strokePadding} 
    L${baseX} ${innerH - pointerHeight + strokePadding}
    H${adjustedRadius + strokePadding} 
    Q${strokePadding} ${innerH - pointerHeight + strokePadding}, ${strokePadding} ${innerH - pointerHeight - adjustedRadius + strokePadding} 
    V${adjustedRadius + strokePadding} 
    Q${strokePadding} ${strokePadding}, ${adjustedRadius + strokePadding} ${strokePadding} Z`;

  return (
    <svg
      className={className}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label ? `Dialogue box: ${label}` : "Dialogue box"}
    >
      {/* Bubble with integrated pointer */}
      <path
        d={path}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />

      {/* Text */}
      {label && (
        <text
          x={w / 2}
          y={(h - pointerHeight) / 2}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={strokeColor}
        >
          {label}
        </text>
      )}
    </svg>
  );
}