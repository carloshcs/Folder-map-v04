import React from "react";

export type ParallelogramProps = {
  width?: number;
  height?: number;
  slant?: number; // how much the sides are slanted
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  fontSize?: number;
  fontFamily?: string;
};

/**
 * Simple parallelogram shape component with cleaner, more angular design.
 * Example:
 * <Parallelogram width={200} height={100} slant={30} label="Note" />
 */
export default function Parallelogram({
  width = 200,
  height = 100,
  slant = 12,
  strokeColor = "#000",
  fillColor = "#fff",
  strokeWidth = 2,
  className,
  style,
  label,
  fontSize = 16,
  fontFamily = "Arial, sans-serif",
}: ParallelogramProps) {
  const w = width;
  const h = height;
  const s = slant;

  // More angular parallelogram design with cleaner edges
  const path = `M${s} 0 L${w + s} 0 L${w} ${h} L0 ${h} Z`;

  return (
    <svg
      className={className}
      style={style}
      width={w + s}
      height={h}
      viewBox={`0 0 ${w + s} ${h}`}
      role="img"
      aria-label={label ? `Parallelogram: ${label}` : "Parallelogram"}
    >
      <path
        d={path}
        fill={fillColor}
        stroke={strokeWidth > 0 ? strokeColor : "none"}
        strokeWidth={strokeWidth > 0 ? strokeWidth : 0}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {label && (
        <text
          x={(w + s) / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
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