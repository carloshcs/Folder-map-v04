// hierarchy.ts - Fixed to only show direct children when expanding

import * as d3 from 'd3';
import { INTEGRATION_NAMES } from './constants';
import { D3HierarchyNode, FolderItem } from './types';
import { getNodeId } from './nodeUtils';

function mapFolderToHierarchy(folder: FolderItem): any | null {
  if (!folder.isSelected) {
    return null;
  }

  const children = (folder.children ?? [])
    .map(mapFolderToHierarchy)
    .filter((child): child is NonNullable<ReturnType<typeof mapFolderToHierarchy>> => Boolean(child));

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
    type: folder.type,
    owner: folder.owner,
    shared: folder.shared,
    permissionsCount: folder.permissionsCount,
    permissionLevel: folder.permissionLevel,
    item: folder,
    children: children.length ? children : undefined,
  };
}

export function buildHierarchy(folders: FolderItem[]) {
  const folderFox = {
    name: 'Folder Fox',
    id: 'folder-fox',
    children: folders
      .filter(f => INTEGRATION_NAMES.includes(f.name))
      .map(mapFolderToHierarchy)
      .filter((child): child is NonNullable<ReturnType<typeof mapFolderToHierarchy>> => Boolean(child)),
  };
  return d3.hierarchy(folderFox) as unknown as D3HierarchyNode;
}

export function getVisibleNodesAndLinks(root: any, expanded: Set<string>) {
  const visibleNodes: D3HierarchyNode[] = [];
  const visibleLinks: any[] = [];
  const addedLinks = new Set<string>(); // Track added links to prevent duplicates

  // Recursive function to traverse and collect visible nodes
  function traverse(node: D3HierarchyNode) {
    // Always add the current node
    visibleNodes.push(node);

    // Level 0 (Folder Fox): Always show its children (integrations)
    if (node.depth === 0 && node.children && node.children.length > 0) {
      node.children.forEach(child => {
        visibleNodes.push(child);
        
        const linkId = `${getNodeId(node)}-${getNodeId(child)}`;
        if (!addedLinks.has(linkId)) {
          visibleLinks.push({ source: node, target: child });
          addedLinks.add(linkId);
        }

        // Check if integration is expanded
        const childId = getNodeId(child);
        if (expanded.has(childId) && child.children && child.children.length > 0) {
          child.children.forEach(grandchild => {
            visibleNodes.push(grandchild);

            const gcLinkId = `${childId}-${getNodeId(grandchild)}`;
            if (!addedLinks.has(gcLinkId)) {
              visibleLinks.push({ source: child, target: grandchild });
              addedLinks.add(gcLinkId);
            }

            // Continue recursively for deeper levels
            traverseChildren(grandchild);
          });
        }
      });
      return;
    }
  }

  // Helper function for deeper traversal
  function traverseChildren(node: D3HierarchyNode) {
    const nodeId = getNodeId(node);
    if (expanded.has(nodeId) && node.children && node.children.length > 0) {
      node.children.forEach(child => {
        visibleNodes.push(child);

        const linkId = `${nodeId}-${getNodeId(child)}`;
        if (!addedLinks.has(linkId)) {
          visibleLinks.push({ source: node, target: child });
          addedLinks.add(linkId);
        }
        
        // Recursively check if THIS child is also expanded
        traverseChildren(child);
      });
    }
  }

  // Start traversal from root
  traverse(root);

  // Set expanded and hasChildren flags
  visibleNodes.forEach(node => {
    node.isExpanded = expanded.has(getNodeId(node));
    node.hasChildren = (node.children && node.children.length > 0) || false;
  });

  return { visibleNodes, visibleLinks };
}