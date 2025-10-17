import { color as d3Color } from 'd3-color';

export const DEFAULT_MAP_PALETTE = 'blue';

export const MAP_COLOR_PALETTES: Record<string, string[]> = {
  blue: ['#1d4ed8', '#2563eb', '#60a5fa', '#0ea5e9', '#312e81', '#1e40af', '#38bdf8', '#6366f1'],
  magenta: ['#c026d3', '#db2777', '#f472b6', '#f43f5e', '#a21caf', '#f97316', '#ec4899', '#fb7185'],
  grayscale: ['#0f172a', '#1f2937', '#334155', '#475569', '#64748b', '#94a3b8', '#e2e8f0', '#cbd5f5'],
  minimal: ['#0f172a', '#1e293b', '#334155', '#64748b', '#94a3b8', '#cbd5f5', '#e2e8f0', '#f1f5f9'],
  teal: ['#0f766e', '#115e59', '#14b8a6', '#0ea5e9', '#2dd4bf', '#5eead4', '#134e4a', '#0f172a'],
  pastel: ['#A3C9A8', '#FFD3B6', '#FFAAA5', '#D5AAFF', '#85E3FF', '#FCF8A1', '#B5EAD7', '#FFDAC1'],
  bright: ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6A4C93', '#1A535C', '#FF8C42', '#2D9BF0', '#FF3F81'],
  neon: ['#39FF14', '#FF3131', '#04D9FF', '#BC13FE', '#FFD700', '#FF007F', '#0AFF99', '#FF8C00'],
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const mixChannel = (channel: number, target: number, ratio: number) =>
  Math.round(channel + (target - channel) * ratio);

const mixColor = (hex: string, ratio: number, target: number): string => {
  const parsed = d3Color(hex)?.rgb();
  if (!parsed) {
    return hex;
  }

  const clampedRatio = clamp(Math.abs(ratio), 0, 1);
  const destination = clamp(target, 0, 255);

  const r = mixChannel(parsed.r, destination, clampedRatio);
  const g = mixChannel(parsed.g, destination, clampedRatio);
  const b = mixChannel(parsed.b, destination, clampedRatio);

  return `rgb(${r}, ${g}, ${b})`;
};

export const shiftColor = (hex: string, amount: number): string => {
  if (amount === 0) {
    return hex;
  }

  const target = amount > 0 ? 255 : 0;
  return mixColor(hex, amount, target);
};

export const getPaletteColors = (paletteId?: string | null): string[] => {
  if (!paletteId) {
    return MAP_COLOR_PALETTES[DEFAULT_MAP_PALETTE];
  }

  return MAP_COLOR_PALETTES[paletteId] ?? MAP_COLOR_PALETTES[DEFAULT_MAP_PALETTE];
};

export const getPaletteColor = (paletteId: string | null | undefined, index: number): string => {
  const colors = getPaletteColors(paletteId);
  if (!colors.length) {
    return '#475569';
  }

  return colors[((index % colors.length) + colors.length) % colors.length];
};

export const getReadableTextColor = (hex: string): string => {
  const parsed = d3Color(hex)?.rgb();
  if (!parsed) {
    return '#f8fafc';
  }

  const brightness = (parsed.r * 299 + parsed.g * 587 + parsed.b * 114) / 1000;
  return brightness > 160 ? '#0f172a' : '#f8fafc';
};
