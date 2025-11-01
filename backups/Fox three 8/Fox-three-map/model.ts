import { type FolderItem, type ServiceId, isServiceId } from '../../right-sidebar/data';
import { type FoxTreeNode } from './config';

export const INTEGRATION_NAMES = new Set(['Google Drive', 'Dropbox', 'OneDrive', 'Notion']);

const ROOT_LABEL = 'Folder Fox';
const ROOT_LOGO = '/assets/folder-fox.png';

export const SERVICE_DETAILS: Record<
  ServiceId,
  { name: string; logo: string; accent: string; hover: string; border: string }
> = {
  notion: {
    name: 'Notion',
    logo: '/assets/notion-logo.png',
    accent: 'bg-slate-100',
    hover: 'hover:bg-slate-200/80',
    border: 'border-slate-200',
  },
  onedrive: {
    name: 'OneDrive',
    logo: '/assets/onedrive-logo.png',
    accent: 'bg-sky-100',
    hover: 'hover:bg-sky-100/90',
    border: 'border-sky-200',
  },
  dropbox: {
    name: 'Dropbox',
    logo: '/assets/dropbox-logo.png',
    accent: 'bg-blue-100',
    hover: 'hover:bg-blue-100/90',
    border: 'border-blue-200',
  },
  googledrive: {
    name: 'Google Drive',
    logo: '/assets/google-drive-logo.png',
    accent: 'bg-amber-100',
    hover: 'hover:bg-amber-100/90',
    border: 'border-amber-200',
  },
};

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();

export const resolveServiceId = (folder: FolderItem, fallback?: ServiceId): ServiceId | undefined => {
  if (folder.serviceId && isServiceId(folder.serviceId)) {
    return folder.serviceId;
  }

  if (isServiceId(folder.id)) {
    return folder.id;
  }

  return fallback;
};

export const buildFoxTree = (folders: FolderItem[]): FoxTreeNode => {
  const mapChildren = (
    folder: FolderItem,
    lineage: string[],
    serviceId: ServiceId | undefined,
  ): FoxTreeNode => {
    const resolvedServiceId = resolveServiceId(folder, serviceId);
    const node: FoxTreeNode = {
      id: `${lineage.join('__')}__${sanitizeId(folder.id ?? folder.name)}`,
      name: folder.name,
      item: folder,
      pathSegments: [...lineage, folder.name],
      serviceName: lineage[1],
      serviceId: resolvedServiceId,
    };

    const isRootChild = lineage.length === 1;
    if (isRootChild && resolvedServiceId) {
      const details = SERVICE_DETAILS[resolvedServiceId];
      if (details) {
        node.logoSrc = details.logo;
      }
    }

    if (folder.children && folder.children.length > 0) {
      node.children = folder.children.map(child =>
        mapChildren(child, [...lineage, folder.name], resolvedServiceId),
      );
    }

    return node;
  };

  const integrationNodes = folders
    .filter(folder => INTEGRATION_NAMES.has(folder.name))
    .map(folder =>
      mapChildren(folder, [ROOT_LABEL], resolveServiceId(folder)),
    )
    .filter(node => (node.children?.length ?? 0) > 0);

  return {
    id: 'fox-root',
    name: ROOT_LABEL,
    pathSegments: [ROOT_LABEL],
    logoSrc: ROOT_LOGO,
    children: integrationNodes,
  };
};
