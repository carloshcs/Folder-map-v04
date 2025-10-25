import { color as d3Color } from 'd3-color';

export const DEFAULT_MAP_PALETTE = 'blue';

export const MAP_COLOR_PALETTES: Record<string, string[]> = {
  blue: ['#1d4ed8', '#2563eb', '#60a5fa', '#0ea5e9', '#312e81', '#1e40af', '#38bdf8', '#6366f1'],
  magenta: ['#c026d3', '#db2777', '#f472b6', '#f43f5e', '#a21caf', '#f97316', '#ec4899', '#fb7185'],
  teal: ['#0f766e', '#115e59', '#14b8a6', '#0ea5e9', '#2dd4bf', '#5eead4', '#134e4a', '#0f172a'],
  bright: ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6a4c93', '#1a535c', '#ff8c42', '#2d9bf0', '#ff3f81'],
  neon: ['#39ff14', '#ff3131', '#04d9ff', '#bc13fe', '#ffd700', '#ff007f', '#0aff99', '#ff8c00'],
  minimal: ['#1c1c1e', '#2c2c2e', '#3a3a3c', '#48484a', '#636366', '#8e8e93', '#aeaeb2', '#d1d1d6'],
  appleMidnight: ['#0a1f44', '#102a56', '#1b3a73', '#274c8f', '#345ea8', '#4f7ac1', '#6c95d8', '#8fb0ed'],
  appleStarlight: ['#3f3a2f', '#5a5241', '#7a6e54', '#9a8d6a', '#b9ab81', '#d6c99b', '#ede0b8', '#f7f1d8'],
  appleForest: ['#1f3b2c', '#2f573d', '#41744e', '#5a9361', '#74b377', '#8fd48d', '#afe4a6', '#d0f3c5'],
  appleSky: ['#0d2f4f', '#16456c', '#205b89', '#2b72a6', '#3b8ec2', '#52a9dd', '#71c4f3', '#a5ddff'],
  appleCoral: ['#462227', '#6a2f35', '#8d3d43', '#b34d52', '#d76062', '#ed7b75', '#f89b8f', '#ffc3b9'],
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
