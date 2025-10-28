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

// Node size
export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 60;

// ⚙️ Uniform grid spacing (same for brothers, father→son, uncle→son)
export const HORIZONTAL_GAP = 200; // horizontal distance between generations
export const VERTICAL_GAP = 130;   // vertical distance between siblings / rows

// Snap grid size (when dragging)
export const SNAP_SIZE = 24;

// Default expansion depth (only the root is expanded automatically)
export const DEFAULT_MAX_DEPTH = 1;

// Supported file types for icons
export const IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.bmp',
  '.tiff',
];

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
