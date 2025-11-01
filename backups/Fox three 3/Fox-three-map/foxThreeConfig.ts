import { type FolderItem, type ServiceId } from '../../right-sidebar/data';

export interface FoxThreeMapProps {
  folders: FolderItem[];
  colorPaletteId?: string | null;
}

export interface FoxTreeNode {
  id: string;
  name: string;
  item?: FolderItem;
  children?: FoxTreeNode[];
  pathSegments: string[];
  serviceName?: string;
  serviceId?: ServiceId;
  logoSrc?: string;
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
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  accentColor?: string;
  parentId?: string | null;
  logoSrc?: string;
}

// Node size
export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 60;

// ⚙️ Uniform grid spacing (same for brothers, father→son, uncle→son)
export const HORIZONTAL_GAP = 200; // horizontal distance between generations
export const VERTICAL_GAP = 70;   // vertical distance between siblings / rows

// Snap grid size (when dragging)
export const SNAP_SIZE = 24;

// Default expansion depth
// Only show the reference root (Folder Fox) expanded initially so cloud services start collapsed
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
