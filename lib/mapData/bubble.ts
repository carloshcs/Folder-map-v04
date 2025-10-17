import type { FolderItem } from "@/app/(interface)/components/right-sidebar/data";

export interface BubbleNode {
  id: string;
  name: string;
  size: number;
  depth: number;
  parentId: string | null;
  serviceId: string | null;
}

export interface BubbleTreeNode extends BubbleNode {
  children: BubbleTreeNode[];
}

export interface BubbleTree {
  roots: BubbleTreeNode[];
  nodeMap: Map<string, BubbleTreeNode>;
}

interface TraverseContext {
  serviceId: string | null;
  parentId: string | null;
  depth: number;
}

const ensurePositiveNumber = (value: unknown): number => {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return value;
};

const collectBubbleNodes = (
  folders: FolderItem[],
  context: TraverseContext,
  nodes: BubbleNode[],
): number => {
  let branchTotal = 0;

  folders.forEach(folder => {
    if (!folder.isSelected) {
      return;
    }

    const children = folder.children ?? [];
    const serviceId = context.depth === 0 ? folder.id : context.serviceId;
    const nextContext: TraverseContext = {
      parentId: folder.id,
      depth: context.depth + 1,
      serviceId,
    };

    const childrenTotal = children.length
      ? collectBubbleNodes(children, nextContext, nodes)
      : 0;

    const ownSize = ensurePositiveNumber(folder.metrics?.totalSize);
    const computedSize = Math.max(ownSize, childrenTotal);

    nodes.push({
      id: folder.id,
      name: folder.name,
      size: computedSize,
      depth: context.depth,
      parentId: context.parentId,
      serviceId,
    });

    branchTotal += computedSize;
  });

  return branchTotal;
};

export const buildBubbleNodes = (folders: FolderItem[]): BubbleNode[] => {
  if (!folders || folders.length === 0) {
    return [];
  }

  const nodes: BubbleNode[] = [];
  collectBubbleNodes(
    folders,
    { depth: 0, parentId: null, serviceId: null },
    nodes,
  );

  return nodes;
};

const sortBySizeDesc = (a: BubbleTreeNode, b: BubbleTreeNode) => b.size - a.size;

export const buildBubbleTree = (
  nodes: BubbleNode[],
  options: { minDepth?: number } = {},
): BubbleTree => {
  const { minDepth = 0 } = options;

  const filteredNodes = nodes.filter(node => node.size > 0 && node.depth >= minDepth);
  const nodeMap = new Map<string, BubbleTreeNode>();

  filteredNodes.forEach(node => {
    nodeMap.set(node.id, {
      ...node,
      children: [],
    });
  });

  const roots: BubbleTreeNode[] = [];

  nodeMap.forEach(node => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  roots.sort(sortBySizeDesc);
  nodeMap.forEach(node => node.children.sort(sortBySizeDesc));

  return { roots, nodeMap };
};
