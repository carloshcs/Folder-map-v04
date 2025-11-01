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
}

// Node size
export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 60;

// Snap grid size (when dragging)
export const SNAP_SIZE = 24;

// Uniform grid spacing (same for brothers, father-son, uncle-son)
export const HORIZONTAL_GAP = 200; // horizontal distance between generations
// Derive vertical gap from node height and align to the snap grid.
// This keeps default layout spacing equal to push/pull distance during drag.
export const VERTICAL_GAP = Math.ceil((NODE_HEIGHT + 10) / SNAP_SIZE) * SNAP_SIZE; // ~70 -> 72

// During drag, keep the same spacing buffer used in the static layout so
// branches snap back into the default vertical rhythm instead of drifting.
export const DRAG_VERTICAL_GAP = VERTICAL_GAP;

// Smoothness: limit how much neighbors move per drag tick.
// Keep aligned with grid for visual stability.
export const DRAG_SMOOTH_MAX_STEP = SNAP_SIZE; // max 1 grid unit per update

// Default expansion depth
// Only show the reference root (Folder Fox (0,0)) expanded initially so cloud services start collapsed
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
