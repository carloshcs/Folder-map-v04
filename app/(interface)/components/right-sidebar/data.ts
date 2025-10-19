export interface FolderMetrics {
  totalSize?: number;
  fileCount?: number;
  folderCount?: number;
}

export interface FolderItem {
  id: string;
  name: string;
  isOpen: boolean;
  isSelected: boolean;
  children?: FolderItem[];
  metrics?: FolderMetrics;
}

export interface SuppressedFolder {
  id: string;
  name: string;
  path: string;
}

export type ServiceId = 'notion' | 'onedrive' | 'dropbox' | 'googledrive';

export const SERVICE_ORDER: ServiceId[] = ['notion', 'onedrive', 'dropbox', 'googledrive'];

const BASE_FOLDERS: FolderItem[] = [
  {
    id: 'notion',
    name: 'Notion',
    isOpen: false,
    isSelected: true,
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    isOpen: false,
    isSelected: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    isOpen: false,
    isSelected: true,
  },
  {
    id: 'googledrive',
    name: 'Google Drive',
    isOpen: false,
    isSelected: true,
  }
];

const clone = <T,>(value: T): T => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

const serviceTreeCache: Partial<Record<ServiceId, FolderItem[]>> = {};
let baseFoldersCache: FolderItem[] | null = null;

type ServiceLoader = () => Promise<FolderItem[]>;

const fetchServiceData = async <T,>(serviceId: ServiceId): Promise<T> => {
  const response = await fetch(`/api/folder-data/${serviceId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch data for ${serviceId}`);
  }

  return response.json() as Promise<T>;
};

const serviceLoaders: Record<ServiceId, ServiceLoader> = {
  notion: async () => {
    const module = await import('./data-sources/notion');
    const data = await fetchServiceData<import('./data-sources/notion').NotionDatabase>('notion');
    return module.buildNotionTree(data);
  },
  onedrive: async () => {
    const module = await import('./data-sources/oneDrive');
    const data = await fetchServiceData<import('./data-sources/oneDrive').OneDriveDatabase>('onedrive');
    return module.buildOneDriveTree(data);
  },
  dropbox: async () => {
    const module = await import('./data-sources/dropbox');
    const data = await fetchServiceData<import('./data-sources/dropbox').DropboxDatabase>('dropbox');
    return module.buildDropboxTree(data);
  },
  googledrive: async () => {
    const module = await import('./data-sources/googleDrive');
    const data = await fetchServiceData<import('./data-sources/googleDrive').GoogleDriveDatabase>('googledrive');
    return module.buildGoogleDriveTree(data);
  }
};

const buildBaseFolders = (): FolderItem[] => {
  const folders = clone(BASE_FOLDERS);

  folders.forEach(folder => {
    const cachedTree = serviceTreeCache[folder.id as ServiceId];
    if (cachedTree && cachedTree.length > 0) {
      folder.children = clone(cachedTree);
    }
  });

  return folders;
};

const ensureBaseFoldersCache = (): FolderItem[] => {
  if (!baseFoldersCache) {
    baseFoldersCache = buildBaseFolders();
  }

  return baseFoldersCache;
};

const loadServiceTree = async (serviceId: ServiceId): Promise<FolderItem[]> => {
  if (serviceTreeCache[serviceId]) {
    return clone(serviceTreeCache[serviceId]!);
  }

  const loader = serviceLoaders[serviceId];
  const tree = clone(await loader());

  serviceTreeCache[serviceId] = tree;
  baseFoldersCache = buildBaseFolders();

  return clone(tree);
};

export const createInitialFolders = (): FolderItem[] => clone(ensureBaseFoldersCache());

export const getBaseFolders = (): FolderItem[] => ensureBaseFoldersCache();

export const loadGoogleDriveTree = async (): Promise<FolderItem[]> => loadServiceTree('googledrive');

export const loadDropboxTree = async (): Promise<FolderItem[]> => loadServiceTree('dropbox');

export const loadNotionTree = async (): Promise<FolderItem[]> => loadServiceTree('notion');

export const loadOneDriveTree = async (): Promise<FolderItem[]> => loadServiceTree('onedrive');

export const SERVICE_IDS = new Set<ServiceId>(SERVICE_ORDER);

export const isServiceId = (id: string): id is ServiceId => SERVICE_IDS.has(id as ServiceId);
