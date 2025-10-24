import * as d3 from 'd3';
import type { FolderItem as SidebarFolderItem } from '../../right-sidebar/data';

export type FolderItem = SidebarFolderItem;

export interface D3HierarchyNode {
  data: any;
  depth: number;
  parent?: D3HierarchyNode;
  children?: D3HierarchyNode[];
  x?: number;
  y?: number;
  targetX?: number;
  targetY?: number;
  orbitAngle?: number;
  offsetAngle?: number;
  baseOrbitRadius?: number;
  calculatedRadius?: number;
  expansionOffset?: number;
  isDragging?: boolean;
  isInOrbit?: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  parentNode?: D3HierarchyNode;
  isPrimary?: boolean;
  // Force simulation properties (for level 3+ nodes)
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

export interface D3Link {
  source: D3HierarchyNode;
  target: D3HierarchyNode;
}

export type D3GroupSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

export interface OrbitalMapProps {
  folders: FolderItem[];
  colorPaletteId?: string;
}

export interface NodePosition {
  x: number;
  y: number;
  baseOrbitRadius: number;
  calculatedRadius: number;
  offsetAngle: number;
  orbitAngle: number;
}