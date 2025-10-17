import React from "react";

export type DialogueIconProps = {
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  className?: string;
};

/**
 * Simple dialogue/speech bubble icon for menu display
 */
export default function DialogueIcon({
  width = 16,
  height = 16,
  strokeColor = "currentColor",
  fillColor = "transparent",
  strokeWidth = 1.5,
  className,
}: DialogueIconProps) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main speech bubble circle */}
      <circle cx="12" cy="8" r="7" fill={fillColor} />
      {/* Small tail pointing down */}
      <path d="M8.5 14.5L7 16.5L8.5 15" fill={fillColor} />
    </svg>
  );
}