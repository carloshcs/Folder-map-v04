import React from "react";

export type PostItNoteProps = {
  width?: number;
  height?: number;
  noteColor?: string; // main color
  pinColor?: string; // pushpin head color
  foldSize?: number; // size of the folded corner
  radius?: number; // corner radius of the note
  label?: string; // optional text on the note
  fontSize?: number;
  fontFamily?: string;
  withShadow?: boolean;
  className?: string; // to position/scale from parent
};

/**
 * SVG Post-it note with a folded corner and a pushpin.
 * No external deps. Fully scalable.
 *
 * Example:
 * <PostItNote width={300} height={300} label="Pick up coffee beans" />
 */
export default function PostItNote({
  width = 320,
  height = 320,
  noteColor = "#FFE082",
  pinColor = "#E74C3C",
  foldSize = 36,
  radius = 16,
  label,
  fontSize = 16,
  fontFamily = "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  withShadow = true,
  className,
}: PostItNoteProps) {
  const w = width;
  const h = height;
  // Scale the fold size proportionally to the note size
  const scaleFactor = Math.min(w, h) / 320; // Base scale on 320px default
  const fold = Math.min(foldSize * scaleFactor, Math.min(w, h) / 2);

  // Slightly darker color for shading/fold
  const darken = (hex: string, p = 0.15) => {
    const n = hex.replace("#", "");
    const bigint = parseInt(n.length === 3 ? n.split("").map(c => c + c).join("") : n, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const mix = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - p))));
    return `#${mix(r).toString(16).padStart(2, "0")}${mix(g).toString(16).padStart(2, "0")}${mix(b).toString(16).padStart(2, "0")}`;
  };

  const noteDark = darken(noteColor, 0.18);
  const noteDarker = darken(noteColor, 0.28);

  const pinShadowId = React.useId();
  const dropShadowId = React.useId();
  const paperGradId = React.useId();

  return (
    <svg
      className={className}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label ? `Post-it: ${label}` : "Post-it note"}
    >
      <defs>
        {/* Soft paper lighting */}
        <linearGradient id={paperGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.05" />
        </linearGradient>

        {/* Note drop shadow */}
        <filter id={dropShadowId} x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
          <feOffset dx="0" dy="6" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.35" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Pushpin shadow */}
        <filter id={pinShadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* Paper shadow */}
      {withShadow && (
        <g filter={`url(#${dropShadowId})`}>
          <rect x={12} y={12} width={w - 24} height={h - 24} fill="transparent" />
        </g>
      )}

      {/* Note base with folded corner */}
      <g>
        {/* Paper with fold */}
        <path
          d={`M${radius} 0 H${w - fold} L${w} ${fold} V${h - radius} a${radius} ${radius} 0 0 1 -${radius} ${radius} H${radius}
             a${radius} ${radius} 0 0 1 -${radius} -${radius} V${radius} a${radius} ${radius} 0 0 1 ${radius} -${radius} Z`}
          fill={noteColor}
        />

        {/* Folded corner with bigger flap */}
        <path
          d={`M${w - fold} 0 L${w} ${fold} L${w - fold * 0.6} ${fold} Z`}
          fill={noteDark}
        />

        {/* Subtle inner gradient for paper feel */}
        <path
          d={`M${radius} 0 H${w - fold} L${w} ${fold} V${h - radius} a${radius} ${radius} 0 0 1 -${radius} ${radius} H${radius}
             a${radius} ${radius} 0 0 1 -${radius} -${radius} V${radius} a${radius} ${radius} 0 0 1 ${radius} -${radius} Z`}
          fill={`url(#${paperGradId})`}
        />

        {/* Fold shadow */}
        <path
          d={`M${w - fold} 0 L${w - fold * 0.6} ${fold} L${w} ${fold}`}
          fill="none"
          stroke={noteDarker}
          strokeOpacity={0.35}
        />

        {/* Bottom curl shadow (subtle) */}
        <path
          d={`M${w * 0.12} ${h - 1} C ${w * 0.35} ${h - fold * 0.15}, ${w * 0.7} ${h - fold * 0.05}, ${w - 4} ${h - 1}`}
          stroke="#000"
          strokeOpacity="0.08"
          fill="none"
        />
      </g>

      {/* Pushpin at ~top-center */}
      <g transform={`translate(${w * 0.52}, ${h * 0.08})`}>
        {/* pin shadow on paper */}
        <ellipse cx={0} cy={fold * 0.5} rx={fold * 0.45} ry={fold * 0.18} fill="#000" opacity={0.18} filter={`url(#${pinShadowId})`} />

        {/* metal pin */}
        <rect x={-2} y={-6} width={4} height={fold * 0.9} rx={2} fill="#C0C0C0" />
        <rect x={-1.2} y={-6} width={2.4} height={fold * 0.9} rx={1.2} fill="#d8d8d8" />

        {/* head */}
        <circle cx={0} cy={0} r={fold * 0.32} fill={pinColor} />
        <path d={`M ${-fold * 0.22} ${-fold * 0.1} a ${fold * 0.18} ${fold * 0.18} 0 1 0 ${fold * 0.38} 0`} fill={pinColor} opacity={0.8} />
        {/* highlight */}
        <circle cx={-fold * 0.12} cy={-fold * 0.12} r={fold * 0.08} fill="#fff" opacity={0.7} />
        {/* rim shadow */}
        <circle cx={0} cy={0} r={fold * 0.32} fill="none" stroke="#000" strokeOpacity={0.15} />
      </g>

      {/* Optional text */}
      {label && (
        <text
          x={w * 0.08}
          y={h * 0.28}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill="#3d3d3d"
          opacity={0.95}
        >
          {label}
        </text>
      )}
    </svg>
  );
}