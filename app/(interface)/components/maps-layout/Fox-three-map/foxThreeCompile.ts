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

const layoutBranch = (
  node: FoxTreeNode,
  depth: number,
  columnX: number,
  currentY: number,
  expandedState: Map<string, boolean>,
  nodes: Array<Node<FoxNodeData>>,
  edges: Edge[],
): number => {
  nodes.push(createNode(node, depth, { x: columnX, y: currentY }));

  const children = node.children ?? [];
  if (!shouldExpandNode(node, depth, expandedState)) {
    return currentY;
  }

  let cursorY = currentY;

  children.forEach(child => {
    const childY = cursorY + VERTICAL_GAP;
    edges.push({
      id: `${node.id}__${child.id}`,
      source: node.id,
      target: child.id,
      animated: true,
    });

    cursorY = layoutBranch(
      child,
      depth + 1,
      columnX,
      childY,
      expandedState,
      nodes,
      edges,
    );
  });

  return cursorY;
};

export const createFlowLayout = (
  tree: FoxTreeNode,
  expandedState: Map<string, boolean>,
): { nodes: Array<Node<FoxNodeData>>; edges: Edge[] } => {
  const nodes: Array<Node<FoxNodeData>> = [];
  const edges: Edge[] = [];

  const rootChildren = tree.children ?? [];
  const firstLevelCount = rootChildren.length;
  const totalWidth = firstLevelCount > 0 ? (firstLevelCount - 1) * HORIZONTAL_GAP : 0;
  const rootX = totalWidth / 2;
  const rootY = 0;

  nodes.push(createNode(tree, 0, { x: rootX, y: rootY }));

  rootChildren.forEach((child, index) => {
    const columnX = index * HORIZONTAL_GAP;
    const childY = rootY + VERTICAL_GAP;

    edges.push({
      id: `${tree.id}__${child.id}`,
      source: tree.id,
      target: child.id,
      animated: true,
    });

    layoutBranch(child, 1, columnX, childY, expandedState, nodes, edges);
  });

  return { nodes, edges };
};

export const snapPosition = (value: number) => Math.round(value / SNAP_SIZE) * SNAP_SIZE;
