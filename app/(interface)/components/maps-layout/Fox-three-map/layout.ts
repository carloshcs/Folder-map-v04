import { type Edge, type Node, type XYPosition } from 'reactflow';
import {
  DEFAULT_MAX_DEPTH,
  HORIZONTAL_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  SNAP_SIZE,
  VERTICAL_GAP,
  type FoxNodeData,
  type FoxTreeNode,
} from './config';

// Create a node for rendering
const createNode = (
  treeNode: FoxTreeNode,
  depth: number,
  position: { x: number; y: number },
  parentId: string | null,
): Node<FoxNodeData> => {
  const item = treeNode.item;
  const snappedPosition = {
    x: snapPosition(position.x),
    y: snapPosition(position.y),
  };

  return {
    id: treeNode.id,
    type: 'fox-folder',
    position: snappedPosition,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    data: {
      label: treeNode.name,
      depth,
      metrics: item?.metrics,
      link: item?.link,
      createdDate: item?.createdDate,
      modifiedDate: item?.modifiedDate,
      activityScore: item?.activityScore,
      pathSegments: treeNode.pathSegments,
      serviceName: treeNode.serviceName ?? (depth === 1 ? treeNode.name : undefined),
      childrenCount: treeNode.children?.length ?? 0,
      serviceId: treeNode.serviceId,
      parentId,
      logoSrc: treeNode.logoSrc,
    },
  };
};

// Should a node be expanded?
const shouldExpandNode = (
  node: FoxTreeNode,
  depth: number,
  expandedState: Map<string, boolean>,
): boolean => {
  if (!node.children || node.children.length === 0) return false;

  // Always show root level
  if (depth === 0) return true;

  const explicit = expandedState.get(node.id);
  if (explicit !== undefined) return explicit;

  // Otherwise, only expand up to default depth
  return depth < DEFAULT_MAX_DEPTH;
};

// Layout each branch vertically with consistent spacing
const determineExpansionDirection = (
  x: number,
  y: number,
  depth: number,
): { x: 1 | -1; y: 1 | -1 } => {
  const defaultDirection = { x: x >= 0 ? 1 : -1, y: y >= 0 ? 1 : -1 } as const;

  if (depth < 1) {
    return defaultDirection;
  }

  if (x >= 0 && y >= 0) return { x: 1, y: 1 } as const;
  if (x >= 0 && y < 0) return { x: 1, y: -1 } as const;
  if (x < 0 && y < 0) return { x: -1, y: -1 } as const;
  return { x: -1, y: 1 } as const;
};

const resolveEffectivePosition = (
  nodeId: string,
  fallback: { x: number; y: number },
  manualPositions?: Map<string, XYPosition>,
): { x: number; y: number } => {
  if (!manualPositions) return fallback;
  const manual = manualPositions.get(nodeId);
  if (!manual) return fallback;
  return manual;
};

const layoutBranch = (
  node: FoxTreeNode,
  depth: number,
  currentX: number,
  currentY: number,
  expandedState: Map<string, boolean>,
  nodes: Array<Node<FoxNodeData>>,
  edges: Edge[],
  parentId: string,
  manualPositions?: Map<string, XYPosition>,
): number => {
  const effectivePosition = resolveEffectivePosition(node.id, { x: currentX, y: currentY }, manualPositions);
  const snappedX = snapPosition(effectivePosition.x);
  const snappedY = snapPosition(effectivePosition.y);
  nodes.push(createNode(node, depth, { x: snappedX, y: snappedY }, parentId));

  const children = node.children ?? [];
  if (!shouldExpandNode(node, depth, expandedState)) return snappedY;

  // Only expand direct children, not grandchildren
  const expandChildren = expandedState.get(node.id);
  if (!expandChildren) return snappedY;

  let cursorY = snappedY;

  // Determine expansion direction based on parent's quadrant relative to origin (0,0)
  const { x: xDir, y: yDir } = determineExpansionDirection(snappedX, snappedY, depth);

  children.forEach((child) => {
    // Expand children away from the origin, preserving the parent's quadrant
    const childY = snapPosition(cursorY + yDir * VERTICAL_GAP);
    const childX = snapPosition(snappedX + xDir * HORIZONTAL_GAP);

    edges.push({
      id: `${node.id}__${child.id}`,
      source: node.id,
      target: child.id,
      animated: true,
    });

    // Add only direct children first (not recursive grandchildren unless previously opened)
    const isChildExpanded = expandedState.get(child.id);
    if (isChildExpanded) {
      cursorY = layoutBranch(
        child,
        depth + 1,
        childX,
        childY,
        expandedState,
        nodes,
        edges,
        node.id,
        manualPositions,
      );
    } else {
      nodes.push(createNode(child, depth + 1, { x: childX, y: childY }, node.id));
      cursorY = childY;
    }
  });

  return cursorY;
};

// Main function that creates the flow layout
export const createFlowLayout = (
  tree: FoxTreeNode,
  expandedState: Map<string, boolean>,
  manualPositions?: Map<string, XYPosition>,
): { nodes: Array<Node<FoxNodeData>>; edges: Edge[] } => {
  const nodes: Array<Node<FoxNodeData>> = [];
  const edges: Edge[] = [];

  const rootFallback = { x: 0, y: 0 };
  const rootPosition = resolveEffectivePosition(tree.id, rootFallback, manualPositions);
  const snappedRootX = snapPosition(rootPosition.x);
  const snappedRootY = snapPosition(rootPosition.y);
  nodes.push(createNode(tree, 0, { x: snappedRootX, y: snappedRootY }, null));

  const rootChildren = tree.children ?? [];
  let cursorY = snappedRootY;

  // Root expansion direction is determined by the root's current position (normally 0,0)
  const { x: rootXDir, y: rootYDir } = determineExpansionDirection(snappedRootX, snappedRootY, 0);

  rootChildren.forEach((child) => {
    const childY = snapPosition(cursorY + rootYDir * VERTICAL_GAP);
    const childX = snapPosition(snappedRootX + rootXDir * HORIZONTAL_GAP);

    edges.push({
      id: `${tree.id}__${child.id}`,
      source: tree.id,
      target: child.id,
      animated: true,
    });

    const isChildExpanded = expandedState.get(child.id);
    if (isChildExpanded) {
      cursorY = layoutBranch(
        child,
        1,
        childX,
        childY,
        expandedState,
        nodes,
        edges,
        tree.id,
        manualPositions,
      );
    } else {
      nodes.push(createNode(child, 1, { x: childX, y: childY }, tree.id));
      cursorY = childY;
    }
  });

  return { nodes, edges };
};

export const snapPosition = (value: number) => Math.round(value / SNAP_SIZE) * SNAP_SIZE;
