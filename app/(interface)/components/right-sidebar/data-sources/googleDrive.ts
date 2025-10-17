import driveDatabase from './drive-database.json';
import type { FolderItem } from '../data';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

type DriveNode = (typeof driveDatabase.nodes)[number];

type FolderMap = Map<string, FolderItem>;

const isFolderNode = (node: DriveNode): boolean => node.mimeType === FOLDER_MIME_TYPE;

const createFolderItem = (node: DriveNode): FolderItem => ({
  id: node.id,
  name: node.title,
  isOpen: false,
  isSelected: true,
  children: [],
  metrics: {
    totalSize: node.totalSize,
    fileCount: node.fileCount,
    folderCount: node.folderCount
  }
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

const buildFolderRelationships = (folderNodes: DriveNode[], folderMap: FolderMap): FolderItem[] => {
  const roots: FolderItem[] = [];

  folderNodes.forEach(node => {
    const folderItem = folderMap.get(node.id);
    if (!folderItem) return;

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

export const buildGoogleDriveTree = (): FolderItem[] => {
  const folderNodes = driveDatabase.nodes.filter(isFolderNode);
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