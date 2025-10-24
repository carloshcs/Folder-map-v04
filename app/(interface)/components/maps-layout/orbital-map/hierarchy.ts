// hierarchy.ts - Fixed to only show direct children when expanding

import * as d3 from 'd3';
import { INTEGRATION_NAMES } from './constants';
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
  const addedLinks = new Set<string>(); // Track added links to prevent duplicates

  // Recursive function to traverse and collect visible nodes
  function traverse(node: D3HierarchyNode) {
    // Always add the current node
    visibleNodes.push(node);

    // Level 0 (Folder Fox): Always show its children (integrations)
    if (node.depth === 0 && node.children && node.children.length > 0) {
      node.children.forEach(child => {
        visibleNodes.push(child);
        
        const linkId = `${node.data.name}-${child.data.name}`;
        if (!addedLinks.has(linkId)) {
          visibleLinks.push({ source: node, target: child });
          addedLinks.add(linkId);
        }
        
        // Check if integration is expanded
        if (expanded.has(child.data.name) && child.children && child.children.length > 0) {
          child.children.forEach(grandchild => {
            visibleNodes.push(grandchild);
            
            const gcLinkId = `${child.data.name}-${grandchild.data.name}`;
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
    if (expanded.has(node.data.name) && node.children && node.children.length > 0) {
      node.children.forEach(child => {
        visibleNodes.push(child);
        
        const linkId = `${node.data.name}-${child.data.name}`;
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
    node.isExpanded = expanded.has(node.data.name);
    node.hasChildren = (node.children && node.children.length > 0) || false;
  });

  return { visibleNodes, visibleLinks };
}