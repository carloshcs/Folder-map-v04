import { useCallback, useEffect, useState } from 'react';

import {
  FolderItem,
  SuppressedFolder,
  SERVICE_ORDER,
  createInitialFolders,
  getBaseFolders,
  loadGoogleDriveTree,
  loadDropboxTree,
  loadNotionTree,
  loadOneDriveTree,
  isServiceId
} from './data';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const updateChildrenSelection = (children: FolderItem[], isSelected: boolean): FolderItem[] => {
  return children.map(child => ({
    ...child,
    isSelected,
    children: child.children ? updateChildrenSelection(child.children, isSelected) : undefined
  }));
};

const findPathToFolder = (targetId: string, items: FolderItem[], path: string[] = []): string[] | null => {
  for (const item of items) {
    const currentPath = [...path, item.id];
    if (item.id === targetId) {
      return currentPath;
    }
    if (item.children) {
      const found = findPathToFolder(targetId, item.children, currentPath);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const updateFolderTree = (
  items: FolderItem[],
  pathToTarget: string[],
  targetId: string
): FolderItem[] => {
  return items.map(item => {
    const isInPath = pathToTarget.includes(item.id);
    const isTarget = item.id === targetId;

    if (isInPath || isTarget) {
      if (isTarget) {
        return {
          ...item,
          isSelected: true,
          children: item.children ? updateChildrenSelection(item.children, true) : undefined
        };
      }

      return {
        ...item,
        isSelected: true,
        children: item.children ? updateFolderTree(item.children, pathToTarget, targetId) : undefined
      };
    }

    return {
      ...item,
      isSelected: false,
      children: item.children ? updateChildrenSelection(item.children, false) : undefined
    };
  });
};

const findFolderWithPath = (
  items: FolderItem[],
  targetId: string,
  currentPath: string[] = [],
  currentNames: string[] = []
): { name: string; path: string } | null => {
  for (const item of items) {
    const newPath = [...currentPath, item.id];
    const newNames = [...currentNames, item.name];

    if (item.id === targetId) {
      let displayPath = '';
      if (newNames.length === 1) {
        displayPath = newNames[0];
      } else if (newNames.length === 2) {
        displayPath = newNames.join('/');
      } else {
        displayPath = `${newNames[0]}/../${newNames[newNames.length - 1]}`;
      }

      return { name: item.name, path: displayPath };
    }

    if (item.children) {
      const found = findFolderWithPath(item.children, targetId, newPath, newNames);
      if (found) {
        return found;
      }
    }
  }

  return null;
};

const removeFolderRecursive = (items: FolderItem[], folderId: string): FolderItem[] => {
  return items
    .filter(item => item.id !== folderId)
    .map(item => ({
      ...item,
      children: item.children ? removeFolderRecursive(item.children, folderId) : undefined
    }));
};

const findFolderInOriginal = (items: FolderItem[], targetId: string): FolderItem | null => {
  for (const item of items) {
    if (item.id === targetId) {
      return clone(item);
    }
    if (item.children) {
      const found = findFolderInOriginal(item.children, targetId);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const findParentOfFolder = (
  items: FolderItem[],
  targetId: string,
  parent: FolderItem | null = null
): FolderItem | null => {
  for (const item of items) {
    if (item.id === targetId) {
      return parent ? clone(parent) : null;
    }
    if (item.children) {
      const found = findParentOfFolder(item.children, targetId, item);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

export const useFolderManager = () => {
  const [folders, setFolders] = useState<FolderItem[]>(() => createInitialFolders());
  const [suppressedFolders, setSuppressedFolders] = useState<SuppressedFolder[]>([]);
  const [baseFolders, setBaseFolders] = useState<FolderItem[]>(() => getBaseFolders());

  useEffect(() => {
    let cancelled = false;

    const loaders: Array<[
      'googledrive' | 'dropbox' | 'notion' | 'onedrive',
      () => Promise<FolderItem[]>
    ]> = [
      ['googledrive', loadGoogleDriveTree],
      ['dropbox', loadDropboxTree],
      ['notion', loadNotionTree],
      ['onedrive', loadOneDriveTree]
    ];

    const applyTree = (serviceId: string, tree: FolderItem[]) => {
      setFolders(prev => {
        let hasChanges = false;

        const updated = prev.map(item => {
          if (item.id !== serviceId) {
            return item;
          }

          hasChanges = true;

          return {
            ...item,
            children: tree,
          };
        });

        return hasChanges ? updated : prev;
      });

      setBaseFolders(getBaseFolders());
    };

    loaders.forEach(([serviceId, loader]) => {
      loader()
        .then(tree => {
          if (cancelled) {
            return;
          }

          applyTree(serviceId, tree);
        })
        .catch(error => {
          console.error(`Failed to load ${serviceId} tree`, error);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    const toggleRecursive = (items: FolderItem[]): FolderItem[] => {
      return items.map(item => {
        if (item.id === folderId) {
          return { ...item, isOpen: !item.isOpen };
        }
        if (item.children) {
          return { ...item, children: toggleRecursive(item.children) };
        }
        return item;
      });
    };

    setFolders(prev => toggleRecursive(prev));
  }, []);

  const toggleFolderSelection = useCallback((folderId: string) => {
    const toggleRecursive = (items: FolderItem[]): FolderItem[] => {
      return items.map(item => {
        if (item.id === folderId) {
          const newSelected = !item.isSelected;
          return {
            ...item,
            isSelected: newSelected,
            children: item.children ? updateChildrenSelection(item.children, newSelected) : undefined
          };
        }
        if (item.children) {
          return { ...item, children: toggleRecursive(item.children) };
        }
        return item;
      });
    };

    setFolders(prev => toggleRecursive(prev));
  }, []);

  const showOnlyFolder = useCallback((folderId: string) => {
    setFolders(prev => {
      const pathToTarget = findPathToFolder(folderId, prev);
      if (!pathToTarget) {
        return prev;
      }
      return updateFolderTree(prev, pathToTarget, folderId);
    });
  }, []);

  const showEverything = useCallback(() => {
    setFolders(prev => {
      return prev.map(item => ({
        ...item,
        isSelected: true,
        children: item.children ? updateChildrenSelection(item.children, true) : undefined
      }));
    });
  }, []);

  const hideEverything = useCallback(() => {
    setFolders(prev => {
      return prev.map(item => ({
        ...item,
        isSelected: false,
        children: item.children ? updateChildrenSelection(item.children, false) : undefined
      }));
    });
  }, []);

  const suppressFolder = useCallback((folderId: string) => {
    setFolders(prev => {
      const folderInfo = findFolderWithPath(prev, folderId);
      if (!folderInfo) {
        return prev;
      }

      setSuppressedFolders(previous => [
        ...previous,
        {
          id: folderId,
          name: folderInfo.name,
          path: folderInfo.path
        }
      ]);

      return removeFolderRecursive(prev, folderId);
    });
  }, []);

  const restoreFolder = useCallback((folderId: string) => {
    setSuppressedFolders(prev => prev.filter(folder => folder.id !== folderId));
    const folderToRestore = findFolderInOriginal(baseFolders, folderId);
    if (!folderToRestore) {
      return;
    }

    setFolders(prev => {
      if (isServiceId(folderId)) {
        const newFolders = [...prev, folderToRestore];
        const getOrderIndex = (id: string) => (isServiceId(id) ? SERVICE_ORDER.indexOf(id) : Number.MAX_SAFE_INTEGER);
        return newFolders.sort((a, b) => getOrderIndex(a.id) - getOrderIndex(b.id));
      }

      const parentInOriginal = findParentOfFolder(baseFolders, folderId);
      if (!parentInOriginal) {
        return prev;
      }

      const addFolderToParent = (items: FolderItem[]): FolderItem[] => {
        return items.map(item => {
          if (item.id === parentInOriginal.id) {
            const children = item.children ? [...item.children, folderToRestore] : [folderToRestore];
            return {
              ...item,
              children
            };
          }
          if (item.children) {
            return {
              ...item,
              children: addFolderToParent(item.children)
            };
          }
          return item;
        });
      };

      return addFolderToParent(prev);
    });
  }, [baseFolders]);

  const restoreAllFolders = useCallback(() => {
    suppressedFolders.forEach(folder => {
      restoreFolder(folder.id);
    });
  }, [restoreFolder, suppressedFolders]);

  return {
    folders,
    suppressedFolders,
    toggleFolder,
    toggleFolderSelection,
    showOnlyFolder,
    showEverything,
    hideEverything,
    suppressFolder,
    restoreFolder,
    restoreAllFolders
  };
};
