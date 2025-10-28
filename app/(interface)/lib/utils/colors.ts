import { color as d3Color } from 'd3-color';

export const DEFAULT_MAP_PALETTE = 'system-light';

export const MAP_COLOR_PALETTES: Record<string, string[]> = {
  'system-light': ['#1d4ed8', '#2563eb', '#0ea5e9', '#10b981', '#f97316', '#f59e0b', '#6366f1', '#0f172a'],
  'system-dark': ['#93c5fd', '#60a5fa', '#38bdf8', '#34d399', '#fbbf24', '#f97316', '#c084fc', '#f4f4f5'],
  'minimal-light': ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
  'minimal-dark': ['#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827'],
  rainbow: ['#ef4444', '#f97316', '#facc15', '#22c55e', '#10b981', '#3b82f6', '#6366f1', '#a855f7'],
  heatmap: ['#991b1b', '#ef4444', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#2563eb', '#1d4ed8'],
  slate: ['#0f172a', '#1f2937', '#27364a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5f5'],
  stone: ['#1f2933', '#323f4b', '#3e4c59', '#52606d', '#7b8794', '#9aa5b1', '#bcccdc', '#d9e2ec'],
  forest: ['#0b3d2e', '#14553c', '#1f6f4a', '#2f8552', '#3f9c61', '#55b776', '#74d39e', '#c4f1c5'],
  mist: ['#312e81', '#3730a3', '#4338ca', '#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#e0e7ff'],
  blush: ['#5b2333', '#7a2f4b', '#9d4b73', '#b96a8d', '#d783a6', '#e8a6c3', '#f4c6d7', '#fde6ef'],
  blue: ['#1d4ed8', '#2563eb', '#60a5fa', '#0ea5e9', '#312e81', '#1e40af', '#38bdf8', '#6366f1'],
  magenta: ['#c026d3', '#db2777', '#f472b6', '#f43f5e', '#a21caf', '#f97316', '#ec4899', '#fb7185'],
  teal: ['#0f766e', '#115e59', '#14b8a6', '#0ea5e9', '#2dd4bf', '#5eead4', '#134e4a', '#0f172a'],
  bright: ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6a4c93', '#1a535c', '#ff8c42', '#2d9bf0', '#ff3f81'],
  neon: ['#39ff14', '#ff3131', '#04d9ff', '#bc13fe', '#ffd700', '#ff007f', '#0aff99', '#ff8c00'],
};

const RANDOM_PALETTE_ID = 'random';
const RANDOM_PALETTE_SIZE = 24;
const paletteCache = new Map<string, string[]>();

const hslToHex = (h: number, s: number, l: number): string => {
  const hue = h % 360;
  const saturation = Math.max(0, Math.min(1, s));
  const lightness = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (value: number) => {
    const channel = Math.round((value + m) * 255);
    return channel.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const generateRandomPalette = (count: number): string[] => {
  const colors: string[] = [];
  let hue = Math.random() * 360;
  const goldenRatioConjugate = 0.61803398875;

  for (let index = 0; index < count; index += 1) {
    hue = (hue + goldenRatioConjugate * 360) % 360;
    const saturation = 0.55 + Math.random() * 0.25;
    const lightness = 0.38 + Math.random() * 0.22;
    colors.push(hslToHex(hue, saturation, lightness));
  }

  return colors;
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

  if (paletteId === RANDOM_PALETTE_ID) {
    const cached = paletteCache.get(paletteId);
    if (cached) {
      return cached;
    }

    const generated = generateRandomPalette(RANDOM_PALETTE_SIZE);
    paletteCache.set(paletteId, generated);
    return generated;
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
