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

// Create a node for rendering
const createNode = (
  treeNode: FoxTreeNode,
  depth: number,
  position: { x: number; y: number },
  parentId?: string,
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
      parentId,
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

const orderChildren = (
  children: FoxTreeNode[],
  parentId: string,
  ordering: Map<string, string[]>,
): FoxTreeNode[] => {
  const desiredOrder = ordering.get(parentId);
  if (!desiredOrder) {
    return children;
  }

  const orderIndex = new Map<string, number>();
  desiredOrder.forEach((id, index) => orderIndex.set(id, index));

  return [...children].sort((a, b) => {
    const aIndex = orderIndex.get(a.id);
    const bIndex = orderIndex.get(b.id);

    if (aIndex === undefined && bIndex === undefined) {
      return 0;
    }

    if (aIndex === undefined) {
      return 1;
    }

    if (bIndex === undefined) {
      return -1;
    }

    return aIndex - bIndex;
  });
};

// Layout each branch vertically with consistent spacing
const layoutBranch = (
  node: FoxTreeNode,
  depth: number,
  currentX: number,
  currentY: number,
  expandedState: Map<string, boolean>,
  ordering: Map<string, string[]>,
  nodes: Array<Node<FoxNodeData>>,
  edges: Edge[],
  parentId?: string,
): number => {
  nodes.push(createNode(node, depth, { x: currentX, y: currentY }, parentId));

  const children = node.children ? orderChildren(node.children, node.id, ordering) : [];
  if (!shouldExpandNode(node, depth, expandedState)) return currentY;

  // Only expand direct children, not grandchildren
  const expandChildren = expandedState.get(node.id);
  if (!expandChildren) return currentY;

  let cursorY = currentY;

  children.forEach((child) => {
    // Fixed vertical gap for all siblings and parent-child pairs
    const childY = cursorY + VERTICAL_GAP;
    const childX = currentX + HORIZONTAL_GAP;

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
        ordering,
        nodes,
        edges,
        node.id,
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
  ordering: Map<string, string[]>,
): { nodes: Array<Node<FoxNodeData>>; edges: Edge[] } => {
  const nodes: Array<Node<FoxNodeData>> = [];
  const edges: Edge[] = [];

  const rootX = 0;
  const rootY = 0;

  nodes.push(createNode(tree, 0, { x: rootX, y: rootY }));

  const rootChildren = tree.children ? orderChildren(tree.children, tree.id, ordering) : [];
  let cursorY = rootY;

  rootChildren.forEach((child) => {
    const childY = cursorY + VERTICAL_GAP;
    const childX = rootX + HORIZONTAL_GAP;

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
        ordering,
        nodes,
        edges,
        tree.id,
      );
    } else {
      nodes.push(createNode(child, 1, { x: childX, y: childY }, tree.id));
      cursorY = childY;
    }
  });

  return { nodes, edges };
};

export const snapPosition = (value: number) => Math.round(value / SNAP_SIZE) * SNAP_SIZE;
