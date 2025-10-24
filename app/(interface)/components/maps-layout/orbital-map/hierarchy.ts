// hierarchy.ts - Fixed to only show direct children when expanding

import * as d3 from 'd3';
import { INTEGRATION_NAMES } from './constants';
import { getNodeId } from './nodeUtils';
import { D3HierarchyNode, FolderItem } from './types';

function mapFolderToHierarchy(folder: FolderItem): any {
  const children = folder.children ? folder.children.map(mapFolderToHierarchy) : [];

  return {
    name: folder.name,
    id: folder.id,
    path: folder.path,
    link: folder.link,
    metrics: folder.metrics,
    serviceId: folder.serviceId,
    createdDate: folder.createdDate,
    modifiedDate: folder.modifiedDate,
    activityScore: folder.activityScore,
    item: folder,
    children,
  };
}

export function buildHierarchy(folders: FolderItem[]) {
  const folderFox = {
    name: 'Folder Fox',
    id: 'folder-fox',
    children: folders.filter(f => INTEGRATION_NAMES.includes(f.name)).map(mapFolderToHierarchy),
  };
  return d3.hierarchy(folderFox) as unknown as D3HierarchyNode;
}

export function getVisibleNodesAndLinks(root: any, expanded: Set<string>) {
  const visibleNodes: D3HierarchyNode[] = [];
  const visibleLinks: any[] = [];
  const seenNodes = new Set<string>();
  const addedLinks = new Set<string>();

  const addNode = (node: D3HierarchyNode) => {
    const nodeId = getNodeId(node);
    if (seenNodes.has(nodeId)) return;
    seenNodes.add(nodeId);
    visibleNodes.push(node);
  };

  const addLink = (source: D3HierarchyNode, target: D3HierarchyNode) => {
    const linkId = `${getNodeId(source)}-${getNodeId(target)}`;
    if (addedLinks.has(linkId)) return;
    addedLinks.add(linkId);
    visibleLinks.push({ source, target });
  };

  function traverse(node: D3HierarchyNode) {
    addNode(node);

    if (!node.children || node.children.length === 0) {
      return;
    }

    if (node.depth === 0) {
      node.children.forEach(child => {
        addNode(child);
        addLink(node, child);

        const childId = getNodeId(child);
        if (expanded.has(childId) && child.children && child.children.length > 0) {
          child.children.forEach(grandchild => {
            addNode(grandchild);
            addLink(child, grandchild);
            traverseChildren(grandchild);
          });
        }
      });
      return;
    }

    const nodeId = getNodeId(node);
    if (!expanded.has(nodeId)) {
      return;
    }

    node.children.forEach(child => {
      addNode(child);
      addLink(node, child);
      traverseChildren(child);
    });
  }

  function traverseChildren(node: D3HierarchyNode) {
    if (!node.children || node.children.length === 0) {
      return;
    }

    const nodeId = getNodeId(node);
    if (!expanded.has(nodeId)) {
      return;
    }

    node.children.forEach(child => {
      addNode(child);
      addLink(node, child);
      traverseChildren(child);
    });
  }

  traverse(root);

  visibleNodes.forEach(node => {
    const nodeId = getNodeId(node);
    node.isExpanded = expanded.has(nodeId);
    node.hasChildren = Boolean(node.children && node.children.length > 0);
  });

  return { visibleNodes, visibleLinks };
}