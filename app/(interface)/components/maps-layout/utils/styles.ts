import { getNodeId } from '../orbital-map/nodeUtils';
import { D3HierarchyNode, NodeVisualStyle } from '../orbital-map/types';
import { getPaletteColors, getReadableTextColor, shiftColor } from '@/app/(interface)/lib/utils/colors';

const MAX_LIGHTENING = 0.75;
const LIGHTEN_STEP = 0.18;
const FIRST_CHILD_LIGHTEN = 0;

export const DIMMED_FILL_LIGHTEN = 0.55;

type ComputeNodeStylesOptions = {
  resetIndexAtDepth?: number | null;
};

export const computeNodeStyles = (
  root: D3HierarchyNode,
  paletteId?: string | null,
  options?: ComputeNodeStylesOptions,
) => {
  const palette = getPaletteColors(paletteId);
  if (!palette.length) {
    return new Map<string, NodeVisualStyle>();
  }

  const styles = new Map<string, NodeVisualStyle>();

  const assignSubtree = (entryNode: D3HierarchyNode) => {
    let paletteIndex = 0;

    const assign = (node: D3HierarchyNode, branchColor?: string) => {
      const nodeId = getNodeId(node);

      if (node.depth === 2) {
        const basePaletteColor = palette[paletteIndex % palette.length];
        paletteIndex += 1;
        const fill = basePaletteColor;
        styles.set(nodeId, {
          fill,
          textColor: getReadableTextColor(fill),
        });
        node.children?.forEach(child => assign(child, basePaletteColor));
      } else if (node.depth > 2) {
        const basePaletteColor = branchColor ?? palette[Math.max(paletteIndex - 1, 0) % palette.length];
        const relativeDepth = node.depth - 2;
        const amount = Math.min(
          MAX_LIGHTENING,
          FIRST_CHILD_LIGHTEN + Math.max(relativeDepth - 1, 0) * LIGHTEN_STEP,
        );
        const fill = shiftColor(basePaletteColor, amount);
        styles.set(nodeId, {
          fill,
          textColor: getReadableTextColor(fill),
        });
        node.children?.forEach(child => assign(child, basePaletteColor));
      } else {
        node.children?.forEach(child => assign(child, branchColor));
      }
    };

    assign(entryNode);
  };

  const resetDepth = options?.resetIndexAtDepth;

  if (resetDepth === null) {
    assignSubtree(root);
  } else if (typeof resetDepth === 'number') {
    const traverse = (node: D3HierarchyNode) => {
      if (node.depth === resetDepth) {
        assignSubtree(node);
        return;
      }

      node.children?.forEach(child => traverse(child));
    };

    traverse(root);
  } else {
    assignSubtree(root);
  }

  return styles;
};

const findBranchRoot = (node: D3HierarchyNode): D3HierarchyNode | null => {
  let current: D3HierarchyNode | undefined = node;

  while (current && current.depth > 2) {
    current = current.parent;
  }

  return current ?? null;
};

const getBranchBaseStyle = (
  node: D3HierarchyNode,
  palette: string[],
): NodeVisualStyle | null => {
  if (node.depth < 2) {
    return null;
  }

  const nodeId = getNodeId(node);

  if (node.depth === 2) {
    const parent = node.parent;
    const siblings = parent?.children?.filter(child => child.depth === 2) ?? [];
    const index = siblings.findIndex(sibling => getNodeId(sibling) === nodeId);
    const paletteIndex = index >= 0 ? index : 0;
    const fill = palette[paletteIndex % palette.length];
    return {
      fill,
      textColor: getReadableTextColor(fill),
    };
  }

  return null;
};

export const resolveNodeVisualStyle = (
  node: D3HierarchyNode,
  styles: Map<string, NodeVisualStyle>,
  paletteId?: string | null,
): NodeVisualStyle | null => {
  const existing = styles.get(getNodeId(node));
  if (existing) {
    return existing;
  }

  if (node.depth < 2) {
    return null;
  }

  const palette = getPaletteColors(paletteId);
  if (!palette.length) {
    return null;
  }

  const branchRoot = findBranchRoot(node);
  if (!branchRoot) {
    return null;
  }

  const branchStyle =
    styles.get(getNodeId(branchRoot)) ?? getBranchBaseStyle(branchRoot, palette);

  if (!branchStyle) {
    return null;
  }

  if (branchRoot === node) {
    return branchStyle;
  }

  const relativeDepth = node.depth - branchRoot.depth;
  const amount = Math.min(
    MAX_LIGHTENING,
    FIRST_CHILD_LIGHTEN + Math.max(relativeDepth - 1, 0) * LIGHTEN_STEP,
  );
  const fill = shiftColor(branchStyle.fill, amount);

  return {
    fill,
    textColor: getReadableTextColor(fill),
  };
};
