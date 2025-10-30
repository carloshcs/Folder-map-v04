import { type Node, type XYPosition } from 'reactflow';
import { HORIZONTAL_GAP, SNAP_SIZE, VERTICAL_GAP, NODE_HEIGHT, type FoxNodeData } from '../config';
import { snapPosition } from '../layout';
// Re-export for consumers that import snapPosition from utils/grid
export { snapPosition } from '../layout';

export const GLOBAL_MIN_X_GAP = HORIZONTAL_GAP;
export const GLOBAL_MIN_Y_GAP = VERTICAL_GAP;

export const snapUpToGrid = (value: number): number => Math.ceil(value / SNAP_SIZE) * SNAP_SIZE;
export const snapDownToGrid = (value: number): number => Math.floor(value / SNAP_SIZE) * SNAP_SIZE;

export const resolveDirectionHint = (
  primary: number | null | undefined,
  fallback: number | null | undefined,
): number => {
  if (primary !== null && primary !== undefined && primary !== 0) {
    return primary > 0 ? 1 : -1;
  }
  if (fallback !== null && fallback !== undefined && fallback !== 0) {
    return fallback > 0 ? 1 : -1;
  }
  return 1;
};

export const snapWithMinimum = (
  value: number,
  reference: number,
  minimum: number,
  directionHint: number,
): number => {
  const snapped = snapPosition(value);
  const diff = snapped - reference;

  let direction = diff === 0 ? directionHint : diff > 0 ? 1 : -1;
  if (direction === 0) direction = 1;

  if (Math.abs(diff) >= minimum) return snapped;

  if (direction > 0) {
    return snapUpToGrid(reference + minimum);
  }
  return snapDownToGrid(reference - minimum);
};

export const enforceGridAndReflow = (
  nodes: Array<Node<FoxNodeData>>,
): Array<Node<FoxNodeData>> => {
  if (nodes.length === 0) return nodes;
  return nodes.map(node => {
    const snappedX = snapPosition(node.position.x);
    const snappedY = snapPosition(node.position.y);
    if (snappedX === node.position.x && snappedY === node.position.y) return node;
    return { ...node, position: { x: snappedX, y: snappedY } };
  });
};

export const clampToParentGap = (
  parent: XYPosition,
  desired: XYPosition,
): XYPosition => {
  let clampedX = desired.x;
  let clampedY = desired.y;

  if (parent.x >= 0) {
    const minX = parent.x + HORIZONTAL_GAP;
    if (clampedX < minX) clampedX = minX;
  } else {
    const maxX = parent.x - HORIZONTAL_GAP;
    if (clampedX > maxX) clampedX = maxX;
  }

  if (parent.y >= 0) {
    const minY = parent.y + VERTICAL_GAP;
    if (clampedY < minY) clampedY = minY;
  } else {
    const maxY = parent.y - VERTICAL_GAP;
    if (clampedY > maxY) clampedY = maxY;
  }

  return { x: snapPosition(clampedX), y: snapPosition(clampedY) };
};

export const enforceDepthVerticalSeparation = (
  nodesList: Array<Node<FoxNodeData>>,
  scopeSet: Set<string>,
  depth: number,
  getDescendants: (id: string) => string[],
): Array<Node<FoxNodeData>> => {
  const nodes = nodesList.slice();
  const idToIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const group = nodes
    .filter(n => scopeSet.has(n.id) && (n.data as FoxNodeData).depth === depth)
    .sort((a, b) => a.position.y - b.position.y);

  if (group.length <= 1) return nodes;

  let lastBottom = group[0].position.y + NODE_HEIGHT;
  for (let i = 1; i < group.length; i += 1) {
    const curr = group[i];
    const minY = lastBottom + GLOBAL_MIN_Y_GAP;
    if (curr.position.y < minY) {
      const dy = snapPosition(minY - curr.position.y);
      const branchIds = new Set([curr.id, ...getDescendants(curr.id)]);
      branchIds.forEach(nid => {
        const idx = idToIndex.get(nid);
        if (idx === undefined) return;
        nodes[idx] = {
          ...nodes[idx],
          position: { x: nodes[idx].position.x, y: snapPosition(nodes[idx].position.y + dy) },
        };
      });
      lastBottom = minY + NODE_HEIGHT;
    } else {
      lastBottom = curr.position.y + NODE_HEIGHT;
    }
  }

  return nodes;
};

export const computeBranchBounds = (
  nodes: Array<Node<FoxNodeData>>,
  branchIds: Set<string>,
): { minY: number; maxY: number } => {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (!branchIds.has(n.id)) continue;
    const top = n.position.y;
    const bottom = n.position.y + NODE_HEIGHT;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }
  if (!isFinite(minY) || !isFinite(maxY)) {
    return { minY: 0, maxY: 0 };
  }
  return { minY: snapPosition(minY), maxY: snapPosition(maxY) };
};
