import { type FoxTreeNode, DEFAULT_MAX_DEPTH } from '../config';
import { type Node } from 'reactflow';
import { type FoxNodeData } from '../config';

export const collectDescendantIds = (
  lookup: Map<string, FoxTreeNode[]>,
  nodeId: string,
): string[] => {
  const result: string[] = [];
  const queue = [...(lookup.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current.id);
    const children = lookup.get(current.id);
    if (children && children.length > 0) queue.push(...children);
  }
  return result;
};

export const computeFamilySetFromNodes = (
  nodes: Array<Node<FoxNodeData>>,
  serviceId: FoxNodeData['serviceId'] | undefined,
): Set<string> => {
  if (!serviceId) return new Set();
  return new Set(nodes.filter(n => (n.data as FoxNodeData).serviceId === serviceId).map(n => n.id));
};

export const collectVisibleNodeIds = (
  root: FoxTreeNode,
  expandedState: Map<string, boolean>,
): Set<string> => {
  const visible = new Set<string>();

  const traverse = (node: FoxTreeNode, depth: number) => {
    visible.add(node.id);
    if (!node.children || node.children.length === 0) return;
    const explicit = expandedState.get(node.id);
    const isExpanded = explicit !== undefined ? explicit : depth < DEFAULT_MAX_DEPTH;
    if (!isExpanded) return;
    node.children.forEach(child => traverse(child, depth + 1));
  };

  traverse(root, 0);
  return visible;
};

export const buildParentLookup = (root: FoxTreeNode): Map<string, string | null> => {
  const map = new Map<string, string | null>();
  const traverse = (node: FoxTreeNode, parentId: string | null) => {
    map.set(node.id, parentId);
    node.children?.forEach(child => traverse(child, node.id));
  };
  traverse(root, null);
  return map;
};

export const buildChildrenLookup = (root: FoxTreeNode): Map<string, FoxTreeNode[]> => {
  const map = new Map<string, FoxTreeNode[]>();
  const traverse = (node: FoxTreeNode) => {
    if (node.children && node.children.length > 0) {
      map.set(node.id, node.children);
      node.children.forEach(traverse);
    }
  };
  traverse(root);
  return map;
};
