import { type FolderItem, type ServiceId } from '../../right-sidebar/data';

export interface FoxThreeMapProps {
  folders: FolderItem[];
}

export interface FoxTreeNode {
  id: string;
  name: string;
  item?: FolderItem;
  children?: FoxTreeNode[];
  pathSegments: string[];
  serviceName?: string;
  serviceId?: ServiceId;
}

export interface FoxNodeData {
  label: string;
  depth: number;
  metrics?: FolderItem['metrics'];
  link?: string;
  createdDate?: string;
  modifiedDate?: string;
  activityScore?: number;
  pathSegments: string[];
  serviceName?: string;
  childrenCount: number;
  serviceId?: ServiceId;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 112;
export const HORIZONTAL_GAP = 280;
export const VERTICAL_GAP = 210;
export const SNAP_SIZE = 24;
export const DEFAULT_MAX_DEPTH = 3;

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.tiff'];
export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.mpg',
  '.mpeg',
  '.wmv',
  '.flv',
  '.m4v',
];
