export const BOX_TYPES = [
  'box',
  'parallelogram',
  'postit',
  'dialogue',
  'circle',
  'rounded',
] as const;

export type BoxType = (typeof BOX_TYPES)[number];
