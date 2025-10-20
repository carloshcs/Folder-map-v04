import * as d3 from 'd3';
import { INTEGRATION_NAMES } from './constants';
import { D3HierarchyNode, FolderItem } from './types';

function mapFolderToHierarchy(folder: FolderItem): any {
  const children = folder.children ? folder.children.map(mapFolderToHierarchy) : [];
  return { name: folder.name, children };
}

export function buildHierarchy(folders: FolderItem[]) {
  const folderFox = {
    name: 'Folder Fox',
    children: folders.filter(f => INTEGRATION_NAMES.includes(f.name)).map(mapFolderToHierarchy),
  };
  return d3.hierarchy(folderFox) as unknown as D3HierarchyNode;
}

export function getVisibleNodesAndLinks(root: any, expanded: Set<string>) {
  const allNodes: D3HierarchyNode[] = root.descendants();
  const allLinks = root.links();

  const visibleNodes = allNodes.filter(d => {
    if (d.depth <= 1) return true;
    const parent = d.parent;
    if (!parent) return false;
    return expanded.has(parent.data.name);
  });

  const visibleLinks = allLinks.filter(
    (d: any) => visibleNodes.includes(d.source) && visibleNodes.includes(d.target),
  );

  visibleNodes.forEach(node => {
    node.isExpanded = expanded.has(node.data.name);
    node.hasChildren = (node.children && node.children.length > 0) || false;
  });

  return { visibleNodes, visibleLinks };
}
