import { type Edge, type Node } from 'reactflow';

import {
  DEFAULT_MAX_DEPTH,
  HORIZONTAL_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  SNAP_SIZE,
  VERTICAL_GAP,
  type FoxNodeData,
  type FoxTreeNode,
} from './foxThreeConfig';

const createNode = (
  treeNode: FoxTreeNode,
  depth: number,
  position: { x: number; y: number },
): Node<FoxNodeData> => {
  const item = treeNode.item;

  return {
    id: treeNode.id,
    type: 'fox-folder',
    position,
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
    },
  };
};

const shouldExpandNode = (
  node: FoxTreeNode,
  depth: number,
  expandedState: Map<string, boolean>,
): boolean => {
  if (!node.children || node.children.length === 0) {
    return false;
  }

  if (depth === 0) {
    return true;
  }

  const explicit = expandedState.get(node.id);
  if (explicit !== undefined) {
    return explicit;
  }

  return depth < DEFAULT_MAX_DEPTH;
};

/**
 * Vertical recursive layout:
 * - Each child appears BELOW the parent (vertical stacking)
 * - Each depth level moves horizontally (indentation)
 * - Automatically reflows when expanding/collapsing
 */
const layoutBranch = (
  node: FoxTreeNode,
  depth: number,
  currentX: number,
  currentY: number,
  expandedState: Map<string, boolean>,
  nodes: Array<Node<FoxNodeData>>,
  edges: Edge[],
): number => {
  nodes.push(createNode(node, depth, { x: currentX, y: currentY }));

  const children = node.children ?? [];
  if (!shouldExpandNode(node, depth, expandedState)) {
    return currentY;
  }

  let cursorY = currentY;

  children.forEach(child => {
    const childX = currentX + HORIZONTAL_GAP; // indent for depth
    const childY = cursorY + VERTICAL_GAP; // stack vertically

    edges.push({
      id: `${node.id}__${child.id}`,
      source: node.id,
      target: child.id,
      animated: true,
    });

    // layout each subtree recursively and update Y position
    cursorY = layoutBranch(
      child,
      depth + 1,
      childX,
      childY,
      expandedState,
      nodes,
      edges,
    );
  });

  return cursorY;
};

/**
 * Root layout:
 * - The root is centered at the top
 * - Children appear below in a vertical cascading structure
 */
export const createFlowLayout = (
  tree: FoxTreeNode,
  expandedState: Map<string, boolean>,
): { nodes: Array<Node<FoxNodeData>>; edges: Edge[] } => {
  const nodes: Array<Node<FoxNodeData>> = [];
  const edges: Edge[] = [];

  const rootX = 0;
  const rootY = 0;

  nodes.push(createNode(tree, 0, { x: rootX, y: rootY }));

  const rootChildren = tree.children ?? [];

  rootChildren.forEach((child, index) => {
    const childY = rootY + VERTICAL_GAP + index * VERTICAL_GAP;

    edges.push({
      id: `${tree.id}__${child.id}`,
      source: tree.id,
      target: child.id,
      animated: true,
    });

    // Layout each branch vertically
    layoutBranch(
      child,
      1,
      rootX + HORIZONTAL_GAP,
      childY,
      expandedState,
      nodes,
      edges,
    );
  });

  return { nodes, edges };
};

export const snapPosition = (value: number) => Math.round(value / SNAP_SIZE) * SNAP_SIZE;
