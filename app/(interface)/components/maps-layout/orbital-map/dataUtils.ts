//datautils

import type { FolderItem } from '../../right-sidebar/data';
import * as d3 from 'd3';

export function mapFolderToHierarchy(folder: FolderItem): any {
  const children = folder.children ? folder.children.map(mapFolderToHierarchy) : [];
  return { name: folder.name, children };
}

export function buildHierarchy(folders: FolderItem[]) {
  const integrations = ['Google Drive', 'Dropbox', 'OneDrive', 'Notion'];
  const folderFox = {
    name: 'Folder Fox',
    children: folders.filter(f => integrations.includes(f.name)).map(mapFolderToHierarchy),
  };
  return d3.hierarchy(folderFox);
}

export function getVisibleNodesAndLinks(root: d3.HierarchyNode<any>, expanded: Set<string>) {
  const allNodes = root.descendants();
  const allLinks = root.links();

  const visibleNodes = allNodes.filter(d => {
    if (d.depth <= 1) return true; // root + integrations
    const parent = d.parent;
    if (!parent) return false;
    return expanded.has(parent.data.name);
  });

  const visibleLinks = allLinks.filter(
    d => visibleNodes.includes(d.source) && visibleNodes.includes(d.target),
  );

  return { visibleNodes, visibleLinks };
}
