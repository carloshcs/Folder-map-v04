import type { FolderItem, FolderMetrics } from '../right-sidebar/data';

export interface HierarchyNode {
  id: string;
  name: string;
  metrics: Required<FolderMetrics>;
  children?: HierarchyNode[];
}

const ensureMetrics = (metrics?: FolderMetrics): Required<FolderMetrics> => ({
  totalSize: metrics?.totalSize ?? 0,
  fileCount: metrics?.fileCount ?? 0,
  folderCount: metrics?.folderCount ?? 0,
});

const addMetrics = (target: Required<FolderMetrics>, source: Required<FolderMetrics>) => {
  target.totalSize += source.totalSize;
  target.fileCount += source.fileCount;
  target.folderCount += source.folderCount;
};

const buildNode = (folder: FolderItem): HierarchyNode => {
  const children = folder.children?.map(buildNode) ?? [];
  const metrics = ensureMetrics(folder.metrics);

  const aggregatedMetrics = { ...metrics } as Required<FolderMetrics>;

  children.forEach(child => {
    addMetrics(aggregatedMetrics, child.metrics);
  });

  return {
    id: folder.id,
    name: folder.name,
    metrics: aggregatedMetrics,
    children: children.length > 0 ? children : undefined,
  };
};

export const buildHierarchyTree = (folders: FolderItem[]): HierarchyNode => {
  const rootChildren = folders.map(buildNode);

  const rootMetrics: Required<FolderMetrics> = { totalSize: 0, fileCount: 0, folderCount: 0 };
  rootChildren.forEach(child => addMetrics(rootMetrics, child.metrics));

  return {
    id: 'root',
    name: 'Workspace',
    metrics: rootMetrics,
    children: rootChildren,
  };
};

export const flattenHierarchy = (root: HierarchyNode): HierarchyNode[] => {
  const nodes: HierarchyNode[] = [];

  const traverse = (node: HierarchyNode) => {
    nodes.push(node);
    node.children?.forEach(traverse);
  };

  traverse(root);

  return nodes;
};
