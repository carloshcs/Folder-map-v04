import oneDriveData from '../../../../(database)/onedrive-data.json';
import type { FolderItem } from '../data';

type OneDriveNode = (typeof oneDriveData.nodes)[number];

type FolderMap = Map<string, FolderItem>;

const FOLDER_KIND = 'folder';

const isFolderNode = (node: OneDriveNode): boolean => node.kind === FOLDER_KIND || node.mimeType === 'application/vnd.google-apps.folder';

const createFolderItem = (node: OneDriveNode): FolderItem => ({
  id: node.id,
  name: node.title,
  isOpen: false,
  isSelected: true,
  children: [],
  metrics: {
    totalSize: node.totalSize,
    fileCount: node.fileCount,
    folderCount: node.folderCount,
  },
});

const sortFolders = (items: FolderItem[]) => {
  items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  items.forEach(item => {
    if (item.children && item.children.length > 0) {
      sortFolders(item.children);
    }
  });
};

const pruneEmptyChildren = (items: FolderItem[]) => {
  items.forEach(item => {
    if (item.children) {
      if (item.children.length === 0) {
        item.children = undefined;
      } else {
        pruneEmptyChildren(item.children);
      }
    }
  });
};

const buildFolderRelationships = (folderNodes: OneDriveNode[], folderMap: FolderMap): FolderItem[] => {
  const roots: FolderItem[] = [];

  folderNodes.forEach(node => {
    const folderItem = folderMap.get(node.id);
    if (!folderItem) {
      return;
    }

    if (node.parent_id && folderMap.has(node.parent_id)) {
      const parent = folderMap.get(node.parent_id);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(folderItem);
      }
    } else {
      folderItem.isOpen = true;
      roots.push(folderItem);
    }
  });

  return roots;
};

export const buildOneDriveTree = (): FolderItem[] => {
  const folderNodes = oneDriveData.nodes.filter(isFolderNode);
  const folderMap: FolderMap = new Map();

  folderNodes.forEach(node => {
    if (!folderMap.has(node.id)) {
      folderMap.set(node.id, createFolderItem(node));
    }
  });

  const roots = buildFolderRelationships(folderNodes, folderMap);

  sortFolders(roots);
  pruneEmptyChildren(roots);

  return roots;
};
