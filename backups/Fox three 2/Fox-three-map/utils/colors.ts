import { getPaletteColors, getReadableTextColor, shiftColor } from '@/app/(interface)/lib/utils/colors';
import { type FoxTreeNode } from '../config';

export type NodeColorAssignment = {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
};

const MAX_LIGHTENING = 0.75;
const DESCENDANT_LIGHTEN_STEP = 0.18;
const FIRST_DESCENDANT_LIGHTEN = 0.24;
const TOP_LEVEL_LIGHTEN = 0.08;
const ROOT_DARKEN = -0.12;
const BORDER_DARKEN = -0.35;

export const computeColorAssignments = (
  root: FoxTreeNode,
  paletteId?: string | null,
): Map<string, NodeColorAssignment> => {
  const palette = getPaletteColors(paletteId);
  if (!palette.length) return new Map();

  const assignments = new Map<string, NodeColorAssignment>();

  const setAssignment = (node: FoxTreeNode, baseColor: string, lightAmount: number) => {
    const backgroundColor = shiftColor(baseColor, lightAmount);
    const textColor = getReadableTextColor(backgroundColor);
    const borderColor = shiftColor(backgroundColor, BORDER_DARKEN);
    assignments.set(node.id, {
      backgroundColor,
      textColor,
      borderColor,
      accentColor: baseColor,
    });
  };

  const getLightenAmount = (depth: number): number => {
    if (depth <= 0) return ROOT_DARKEN;
    if (depth === 1) return TOP_LEVEL_LIGHTEN;
    const relativeDepth = depth - 1;
    return Math.min(MAX_LIGHTENING, FIRST_DESCENDANT_LIGHTEN + Math.max(relativeDepth - 1, 0) * DESCENDANT_LIGHTEN_STEP);
  };

  const assignBranch = (node: FoxTreeNode, depth: number, branchColor: string) => {
    setAssignment(node, branchColor, getLightenAmount(depth));
    node.children?.forEach(child => assignBranch(child, depth + 1, branchColor));
  };

  if (root) {
    const rootBase = palette[0];
    setAssignment(root, rootBase, getLightenAmount(0));
  }

  let paletteIndex = palette.length > 1 ? 1 : 0;
  root.children?.forEach(child => {
    const baseColor = palette[paletteIndex % palette.length];
    paletteIndex += 1;
    assignBranch(child, 1, baseColor);
  });

  return assignments;
};
