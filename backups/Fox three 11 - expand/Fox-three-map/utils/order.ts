import { type FoxTreeNode } from '../config';

export const reorderTreeWithCustomOrder = (
  node: FoxTreeNode,
  orderMap: Map<string, string[]>,
): FoxTreeNode => {
  const children = node.children ?? [];
  if (!children.length) return { ...node };

  const order = orderMap.get(node.id);
  const originalIndex = new Map(children.map((child, index) => [child.id, index]));
  const orderIndex = order
    ? new Map(order.map((childId, index) => [childId, index]))
    : new Map<string, number>();

  const sortedChildren = [...children].sort((a, b) => {
    const orderA = orderIndex.get(a.id);
    const orderB = orderIndex.get(b.id);
    if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
    if (orderA !== undefined) return -1;
    if (orderB !== undefined) return 1;
    return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
  });

  return { ...node, children: sortedChildren.map(child => reorderTreeWithCustomOrder(child, orderMap)) };
};

