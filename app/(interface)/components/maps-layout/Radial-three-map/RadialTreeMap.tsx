'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

import { MIN_HEIGHT, MIN_WIDTH } from '../orbital-map/constants';
import { buildHierarchy, getVisibleNodesAndLinks } from '../orbital-map/hierarchy';
import { renderNodes } from '../orbital-map/rendering';
import { getNodeId } from '../orbital-map/nodeUtils';
import {
  D3GroupSelection,
  D3HierarchyNode,
  FolderItem,
} from '../orbital-map/types';
import {
  getPaletteColors,
  getReadableTextColor,
  shiftColor,
} from '@/app/(interface)/lib/utils/colors';
import {
  isServiceId,
  ServiceId,
} from '@/app/(interface)/components/right-sidebar/data';
import { IntegrationFilter, IntegrationService } from '@/components/IntegrationFilter';

const LEVEL_RADII: Record<number, number> = {
  1: 240,
  2: 430,
  3: 760,
};

const RADIAL_SPACING = 170;
const FULL_CIRCLE_START_ANGLE = -Math.PI / 2;
const VIEWBOX_PADDING = 260;

const SERVICE_ORDER = ['Google Drive', 'Dropbox', 'Notion', 'OneDrive'] as const;
const SERVICE_BASE_ANGLES: Record<string, number> = SERVICE_ORDER.reduce(
  (acc, service, index) => {
    const step = (2 * Math.PI) / SERVICE_ORDER.length;
    acc[service] = FULL_CIRCLE_START_ANGLE + step * index;
    return acc;
  },
  {} as Record<string, number>,
);
const SERVICE_SPREAD = Math.PI / 2.4;
const SUBTREE_RANGE_DECAY = 0.68;
const MIN_CHILD_SPREAD = Math.PI / 36;
const CHILD_RANGE_SHRINK = 0.65;
const SINGLE_CHILD_SPREAD = Math.PI / 24;

const MAX_LIGHTENING = 0.85;
const LIGHTEN_STEP = 0.4;
const BASE_DARKEN = -0.25;
const HOVER_TOOLTIP_WIDTH = 320;
const HOVER_TOOLTIP_COMPACT_HEIGHT = 220;
const HOVER_TOOLTIP_EXPANDED_HEIGHT = 420;
const TOOLTIP_LOCK_DISTANCE = 24;

const numberFormatter = new Intl.NumberFormat('en-US');

const formatBytes = (size?: number) => {
  if (typeof size !== 'number') return null;
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 100 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
};

const formatDate = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
};

const SERVICE_DETAILS: Record<
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

const resolveServiceId = (
  folder: FolderItem,
  fallback?: ServiceId,
): ServiceId | undefined => {
  if (folder.serviceId && isServiceId(folder.serviceId)) {
    return folder.serviceId;
  }

  if (isServiceId(folder.id)) {
    return folder.id;
  }

  return fallback;
};

type HoveredNodeInfo = {
  id: string;
  name: string;
  depth: number;
  lineage: string[];
  position: { x: number; y: number };
  pathSegments: string[];
  serviceName?: string;
  link?: string;
  metrics?: {
    totalSize?: number;
    fileCount?: number;
    folderCount?: number;
  };
  createdDate?: string;
  modifiedDate?: string;
  activityScore?: number;
  canExpand: boolean;
  isExpanded: boolean;
  isSelected?: boolean;
};

type NodeVisualStyle = {
  fill: string;
  textColor: string;
};

const computeNodeStyles = (root: D3HierarchyNode, paletteId?: string | null) => {
  const palette = getPaletteColors(paletteId);
  if (!palette.length) {
    return new Map<string, NodeVisualStyle>();
  }

  let paletteIndex = 0;
  const styles = new Map<string, NodeVisualStyle>();

  const assign = (node: D3HierarchyNode, branchColor?: string) => {
    const nodeId = getNodeId(node);

    if (node.depth === 2) {
      const basePaletteColor = palette[paletteIndex % palette.length];
      paletteIndex += 1;
      const fill = shiftColor(basePaletteColor, BASE_DARKEN);
      styles.set(nodeId, {
        fill,
        textColor: getReadableTextColor(fill),
      });
      node.children?.forEach(child => assign(child, basePaletteColor));
    } else if (node.depth > 2) {
      const basePaletteColor = branchColor ?? palette[Math.max(paletteIndex - 1, 0) % palette.length];
      const relativeDepth = node.depth - 2;
      const amount = Math.min(MAX_LIGHTENING, BASE_DARKEN + relativeDepth * LIGHTEN_STEP);
      const fill = shiftColor(basePaletteColor, amount);
      styles.set(nodeId, {
        fill,
        textColor: getReadableTextColor(fill),
      });
      node.children?.forEach(child => assign(child, basePaletteColor));
    } else {
      node.children?.forEach(child => assign(child, branchColor));
    }
  };

  assign(root);

  return styles;
};

const applyRadialLayout = (
  root: D3HierarchyNode,
  visibleNodes: D3HierarchyNode[],
) => {
  const visibleIds = new Set(visibleNodes.map(node => getNodeId(node)));
  const metadata = new Map<
    D3HierarchyNode,
    { angle: number; radius: number; rangeStart: number; rangeEnd: number }
  >();

  const setPosition = (
    node: D3HierarchyNode,
    angle: number,
    radius: number,
    rangeStart?: number,
    rangeEnd?: number,
  ) => {
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
    const start = rangeStart ?? angle;
    const end = rangeEnd ?? angle;
    metadata.set(node, { angle, radius, rangeStart: start, rangeEnd: end });
  };

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  setPosition(
    root,
    -Math.PI / 2,
    0,
    FULL_CIRCLE_START_ANGLE,
    FULL_CIRCLE_START_ANGLE + Math.PI * 2,
  );

  const layoutChildren = (parent: D3HierarchyNode) => {
    const parentMeta = metadata.get(parent);
    if (!parentMeta) return;

    const children = (parent.children ?? []).filter(child =>
      visibleIds.has(getNodeId(child)),
    );

    if (!children.length) return;

    const childCount = children.length;

    if (parent.depth === 0) {
      const sorted = [...children].sort((a, b) => {
        const aName = a.data?.name ?? '';
        const bName = b.data?.name ?? '';
        const aIndex = SERVICE_ORDER.indexOf(aName as (typeof SERVICE_ORDER)[number]);
        const bIndex = SERVICE_ORDER.indexOf(bName as (typeof SERVICE_ORDER)[number]);
        const normalizedA = aIndex === -1 ? SERVICE_ORDER.length : aIndex;
        const normalizedB = bIndex === -1 ? SERVICE_ORDER.length : bIndex;
        if (normalizedA === normalizedB) {
          return aName.localeCompare(bName);
        }
        return normalizedA - normalizedB;
      });

      const fallbackStep = (2 * Math.PI) / sorted.length;
      let fallbackIndex = 0;

      sorted.forEach(child => {
        const serviceName = child.data?.name ?? '';
        const baseAngle =
          SERVICE_BASE_ANGLES[serviceName] ??
          FULL_CIRCLE_START_ANGLE + fallbackStep * (fallbackIndex++);
        const rangeStart = baseAngle - SERVICE_SPREAD / 2;
        const rangeEnd = baseAngle + SERVICE_SPREAD / 2;
        setPosition(child, baseAngle, LEVEL_RADII[1], rangeStart, rangeEnd);
        layoutChildren(child);
      });
      return;
    }

    let childRadius = parentMeta.radius;
    if (parent.depth === 1) {
      childRadius = LEVEL_RADII[2];
    } else if (parent.depth === 2) {
      childRadius = LEVEL_RADII[3];
    } else {
      childRadius = parentMeta.radius + RADIAL_SPACING;
    }

    const availableStart = parentMeta.rangeStart;
    const availableEnd = parentMeta.rangeEnd;
    const availableSpan = Math.max(availableEnd - availableStart, MIN_CHILD_SPREAD);
    let span = availableSpan;
    if (parent.depth >= 2) {
      span = Math.max(availableSpan * SUBTREE_RANGE_DECAY, MIN_CHILD_SPREAD);
    }

    if (childCount === 1) {
      const mid = parentMeta.angle;
      const halfSpan = Math.max(span / 2, SINGLE_CHILD_SPREAD / 2);
      const rawStart = clamp(mid - halfSpan, availableStart, availableEnd);
      const rawEnd = clamp(mid + halfSpan, availableStart, availableEnd);
      const rangeStart = Math.min(rawStart, rawEnd);
      const rangeEnd = Math.max(rawStart, rawEnd);
      setPosition(children[0], mid, childRadius, rangeStart, rangeEnd);
      layoutChildren(children[0]);
      return;
    }

    let startAngle = clamp(parentMeta.angle - span / 2, availableStart, availableEnd - MIN_CHILD_SPREAD);
    let endAngle = clamp(parentMeta.angle + span / 2, startAngle + MIN_CHILD_SPREAD, availableEnd);
    let actualSpan = endAngle - startAngle;

    if (actualSpan < MIN_CHILD_SPREAD) {
      const mid = parentMeta.angle;
      startAngle = mid - MIN_CHILD_SPREAD / 2;
      endAngle = mid + MIN_CHILD_SPREAD / 2;
      actualSpan = MIN_CHILD_SPREAD;
    }

    const step = actualSpan / (childCount - 1);
    const rangeSegment = Math.max(step * CHILD_RANGE_SHRINK, MIN_CHILD_SPREAD * 0.5);

    children.forEach((child, index) => {
      const angle = startAngle + step * index;
      const half = rangeSegment / 2;
      const rawStart = clamp(angle - half, availableStart, availableEnd);
      const rawEnd = clamp(angle + half, availableStart, availableEnd);
      const rangeStart = Math.min(rawStart, rawEnd);
      const rangeEnd = Math.max(rawStart, rawEnd);
      setPosition(child, angle, childRadius, rangeStart, rangeEnd);
      layoutChildren(child);
    });
  };

  layoutChildren(root);
};

export interface RadialTreeMapProps {
  folders: FolderItem[];
  colorPaletteId?: string | null;
  onFolderSelectionChange?: (folderId: string, isSelected: boolean) => void;
}

export const RadialTreeMap: React.FC<RadialTreeMapProps> = ({
  folders,
  colorPaletteId,
  onFolderSelectionChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gRef = useRef<D3GroupSelection | null>(null);
  const ringLayerRef = useRef<D3GroupSelection | null>(null);
  const linkLayerRef = useRef<D3GroupSelection | null>(null);
  const nodeLayerRef = useRef<D3GroupSelection | null>(null);

  const [size, setSize] = useState({ width: 1100, height: 900 });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null);
  const [isTooltipExpanded, setIsTooltipExpanded] = useState(false);
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(() => {
    for (const folder of folders) {
      const resolved = resolveServiceId(folder);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  });

  const isTooltipHoveredRef = useRef(false);
  const closeTooltipTimeoutRef = useRef<number | null>(null);
  const tooltipInitialPositionRef = useRef<{ x: number; y: number } | null>(null);
  const isTooltipPositionLockedRef = useRef(false);

  const resetTooltipPositionLock = useCallback(() => {
    tooltipInitialPositionRef.current = null;
    isTooltipPositionLockedRef.current = false;
  }, []);

  const closeTooltip = useCallback(() => {
    resetTooltipPositionLock();
    setHoveredNode(null);
  }, [resetTooltipPositionLock]);

  const setTooltipHoverState = (value: boolean) => {
    isTooltipHoveredRef.current = value;
  };

  const clearTooltipTimeout = () => {
    if (closeTooltipTimeoutRef.current !== null) {
      window.clearTimeout(closeTooltipTimeoutRef.current);
      closeTooltipTimeoutRef.current = null;
    }
  };

  const scheduleTooltipClose = () => {
    clearTooltipTimeout();
    closeTooltipTimeoutRef.current = window.setTimeout(() => {
      closeTooltip();
    }, 180);
  };

  const toggleHoveredExpansion = () => {
    if (!hoveredNode?.id) return;
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(hoveredNode.id)) {
        next.delete(hoveredNode.id);
      } else {
        next.add(hoveredNode.id);
      }
      return next;
    });

    setHoveredNode(prev => (prev ? { ...prev, isExpanded: !prev.isExpanded } : prev));
  };

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const nextWidth = Math.max(MIN_WIDTH, width);
        const nextHeight = Math.max(MIN_HEIGHT, height);

        setSize(prev => {
          if (prev.width === nextWidth && prev.height === nextHeight) {
            return prev;
          }

          return { width: nextWidth, height: nextHeight };
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const filter = defs
      .append('filter')
      .attr('id', 'node-shadow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    (filter as any)
      .append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 3)
      .attr('stdDeviation', 4)
      .attr('flood-color', '#101828')
      .attr('flood-opacity', 0.28);

    const g = svg.append('g').attr('class', 'radial-tree-root');
    gRef.current = g;

    ringLayerRef.current = g.append('g').attr('class', 'ring-layer');
    linkLayerRef.current = g.append('g').attr('class', 'link-layer');
    nodeLayerRef.current = g.append('g').attr('class', 'node-layer');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3])
      .filter(event => {
        if (event.type === 'wheel') return true;
        if (event.type === 'touchstart' || event.type === 'touchmove' || event.type === 'touchend') {
          return true;
        }
        return false;
      })
      .on('zoom', event => g.attr('transform', event.transform));

    svg.call(zoom as any);
    svg.on('dblclick.zoom', null);
  }, []);

  const availableServices = useMemo<IntegrationService[]>(() => {
    const services: IntegrationService[] = [];
    const seen = new Set<ServiceId>();

    folders.forEach(folder => {
      const resolved = resolveServiceId(folder);
      if (!resolved || seen.has(resolved)) {
        return;
      }

      if (!folder.children || folder.children.length === 0) {
        return;
      }

      const details = SERVICE_DETAILS[resolved];
      if (!details) {
        return;
      }

      seen.add(resolved);
      services.push({ id: resolved, ...details });
    });

    return services;
  }, [folders]);

  useEffect(() => {
    if (availableServices.length === 0) {
      if (activeServiceId !== null) {
        setActiveServiceId(null);
      }
      return;
    }

    if (!activeServiceId || !availableServices.some(service => service.id === activeServiceId)) {
      setActiveServiceId(availableServices[0].id);
    }
  }, [activeServiceId, availableServices]);

  useEffect(() => {
    setExpanded(new Set());
    closeTooltip();
  }, [activeServiceId, closeTooltip]);

  const filteredFolders = useMemo(() => {
    if (!activeServiceId) {
      return folders;
    }

    return folders.filter(folder => resolveServiceId(folder) === activeServiceId);
  }, [folders, activeServiceId]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current || !nodeLayerRef.current || !linkLayerRef.current || !ringLayerRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const { width, height } = size;

    const root = buildHierarchy(filteredFolders);
    const nodeStyles = computeNodeStyles(root, colorPaletteId);
    const { visibleNodes, visibleLinks } = getVisibleNodesAndLinks(root, expanded);

    applyRadialLayout(root, visibleNodes);

    const maxRadius =
      d3.max(visibleNodes, node => Math.hypot(node.x ?? 0, node.y ?? 0)) ?? LEVEL_RADII[3];

    const viewWidth = width + VIEWBOX_PADDING * 2;
    const viewHeight = height + VIEWBOX_PADDING * 2;
    const maxExtent = Math.max(viewWidth, viewHeight, maxRadius * 2 + VIEWBOX_PADDING * 2);

    svg
      .attr('viewBox', [-maxExtent / 2, -maxExtent / 2, maxExtent, maxExtent])
      .attr('width', width)
      .attr('height', height)
      .style('background', 'none')
      .style('overflow', 'visible');

    const ringLayer = ringLayerRef.current;
    const linkLayer = linkLayerRef.current;
    const nodeLayer = nodeLayerRef.current;

    const ringRadii = (() => {
      const radiusByDepth = new Map<number, number>();
      visibleNodes.forEach(node => {
        if (typeof node.depth !== 'number' || node.depth === 0) return;
        const radius = Math.hypot(node.x ?? 0, node.y ?? 0);
        const existing = radiusByDepth.get(node.depth);
        if (existing === undefined || radius > existing) {
          radiusByDepth.set(node.depth, radius);
        }
      });
      return Array.from(radiusByDepth.values()).sort((a, b) => a - b);
    })();

    ringLayer
      .selectAll('circle.orbit-ring')
      .data(ringRadii)
      .join(
        enter =>
          enter
            .append('circle')
            .attr('class', 'orbit-ring')
            .attr('stroke', '#d0d0d0')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '5,5')
            .attr('fill', 'none')
            .attr('opacity', (_d, index) => 0.35 - index * 0.04),
        update => update,
        exit => exit.remove(),
      )
      .attr('r', d => d);

    const link = linkLayer
      .selectAll<SVGLineElement, any>('line')
      .data(visibleLinks, (d: any) => {
        const sourceId = getNodeId(d.source);
        const targetId = getNodeId(d.target);
        return `${sourceId}-${targetId}`;
      })
      .join(
        enter =>
          enter
            .append('line')
            .attr('stroke', '#b8bec9')
            .attr('stroke-width', 1.4)
            .attr('opacity', 0.85),
        update => update,
        exit => exit.remove(),
      )
      .attr('stroke', '#b8bec9')
      .attr('stroke-width', 1.4)
      .attr('opacity', 0.85)
      .attr('x1', (d: any) => d.source.x ?? 0)
      .attr('y1', (d: any) => d.source.y ?? 0)
      .attr('x2', (d: any) => d.target.x ?? 0)
      .attr('y2', (d: any) => d.target.y ?? 0);

    const getLineageNames = (node: any) => {
      const lineage: string[] = [];
      let current = node as any;
      while (current) {
        const name = current.data?.name ?? 'Node';
        lineage.push(name);
        current = current.parent || null;
      }
      return lineage.reverse();
    };

    const getRelativePosition = (event: PointerEvent) => {
      if (!containerRef.current) return { x: event.clientX, y: event.clientY };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handleNodeEnter = (event: PointerEvent, d: any) => {
      clearTooltipTimeout();
      setTooltipHoverState(false);

      const id = getNodeId(d);
      const lineage = getLineageNames(d);
      const trimmedLineage = lineage.filter(
        (name, index) => !(index === 0 && name === 'Folder Fox'),
      );
      const position = getRelativePosition(event);
      const nodeData = d.data ?? {};
      const item = (nodeData.item as FolderItem | undefined) ?? undefined;

      const link = item?.link ?? nodeData.link;
      const metrics = item?.metrics ?? nodeData.metrics;
      const createdDate = item?.createdDate ?? nodeData.createdDate;
      const modifiedDate = item?.modifiedDate ?? nodeData.modifiedDate;
      const activityScore = item?.activityScore ?? nodeData.activityScore;
      const isSelected =
        typeof item?.isSelected === 'boolean'
          ? item.isSelected
          : typeof nodeData.isSelected === 'boolean'
            ? nodeData.isSelected
            : undefined;

      setIsTooltipExpanded(false);
      resetTooltipPositionLock();
      tooltipInitialPositionRef.current = position;
      setHoveredNode({
        id,
        name: d.data?.name ?? 'Node',
        depth: d.depth ?? 0,
        lineage,
        position,
        pathSegments: trimmedLineage,
        serviceName: trimmedLineage[0],
        link,
        metrics,
        createdDate,
        modifiedDate,
        activityScore,
        canExpand: Boolean(d.hasChildren),
        isExpanded: Boolean(d.isExpanded),
        isSelected,
      });
    };

    const handleNodeMove = (event: PointerEvent) => {
      if (isTooltipPositionLockedRef.current) return;
      const position = getRelativePosition(event);
      const initialPosition = tooltipInitialPositionRef.current ?? position;
      if (!tooltipInitialPositionRef.current) {
        tooltipInitialPositionRef.current = position;
      }
      const distance = Math.hypot(position.x - initialPosition.x, position.y - initialPosition.y);
      if (distance > TOOLTIP_LOCK_DISTANCE) {
        isTooltipPositionLockedRef.current = true;
        return;
      }
      setHoveredNode(prev => (prev ? { ...prev, position } : prev));
    };

    const handleNodeLeave = () => {
      if (isTooltipHoveredRef.current) return;
      scheduleTooltipClose();
    };

    const node = renderNodes(svg, nodeLayer, visibleNodes, {
      colorAssignments: nodeStyles,
      onNodeEnter: handleNodeEnter,
      onNodeMove: handleNodeMove,
      onNodeLeave: handleNodeLeave,
    })
      .style('pointer-events', 'all')
      .attr('transform', (d: any) => `translate(${d.x ?? 0},${d.y ?? 0})`);

    node.on('dblclick', (event: any, d: any) => {
      event.stopPropagation();
      const nodeId = getNodeId(d);
      if (!nodeId) return;
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
    });
  }, [closeTooltip, colorPaletteId, expanded, filteredFolders, resetTooltipPositionLock, size]);

  useEffect(() => {
    setIsTooltipExpanded(false);
  }, [hoveredNode?.id]);

  useEffect(() => {
    if (!nodeLayerRef.current || !linkLayerRef.current) return;

    const hoveredId = hoveredNode?.id;
    const nodeSelection = nodeLayerRef.current.selectAll<SVGGElement, any>('g.node');
    const linkSelection = linkLayerRef.current.selectAll<SVGLineElement, any>('line');

    const relatedIds = new Set<string>();

    if (hoveredId) {
      nodeSelection.each(function (d: any) {
        const nodeId = getNodeId(d);
        if (nodeId === hoveredId) {
          relatedIds.add(nodeId);
          if (d.parent) {
            relatedIds.add(getNodeId(d.parent));
          }
          if (d.children) {
            d.children.forEach((child: any) => relatedIds.add(getNodeId(child)));
          }
        }
      });
    }

    nodeSelection
      .style('opacity', (d: any) => {
        if (!hoveredId) return 1;
        const nodeId = getNodeId(d);
        return relatedIds.has(nodeId) ? 1 : 0.6;
      })
      .style('transform-origin', 'center')
      .attr('filter', 'url(#node-shadow)');

    nodeSelection.each(function (d: any) {
      const selection = d3.select(this);
      const circle = selection.select<SVGCircleElement>('circle.node-circle');
      if (circle.empty()) return;

      const baseFill = circle.attr('data-base-fill');
      if (!baseFill) return;

      const nodeId = getNodeId(d);
      const label = selection.select<SVGTextElement>('text.node-label');

      if (!hoveredId || relatedIds.has(nodeId)) {
        circle.attr('fill', baseFill);
        if (!label.empty()) {
          label.style('opacity', 1);
        }
        return;
      }

      const dimmedFill = circle.attr('data-dimmed-fill') || shiftColor(baseFill, 0.45);
      circle.attr('fill', dimmedFill).attr('data-dimmed-fill', dimmedFill);
      if (!label.empty()) {
        label.style('opacity', 0.85);
      }
    });

    linkSelection
      .attr('stroke', (d: any) => {
        if (!hoveredId) return '#b8bec9';
        const sourceId = getNodeId(d.source);
        const targetId = getNodeId(d.target);
        return sourceId === hoveredId || targetId === hoveredId ? '#6b7bff' : '#c5cad3';
      })
      .attr('stroke-width', (d: any) => {
        if (!hoveredId) return 1.4;
        const sourceId = getNodeId(d.source);
        const targetId = getNodeId(d.target);
        return sourceId === hoveredId || targetId === hoveredId ? 2.4 : 1;
      })
      .attr('opacity', (d: any) => {
        if (!hoveredId) return 0.95;
        const sourceId = getNodeId(d.source);
        const targetId = getNodeId(d.target);
        return sourceId === hoveredId || targetId === hoveredId ? 1 : 0.55;
      });

    return () => {
      nodeSelection
        .style('opacity', 1)
        .each(function (d: any) {
          const selection = d3.select(this);
          const circle = selection.select<SVGCircleElement>('circle.node-circle');
          if (circle.empty()) return;
          const baseFill = circle.attr('data-base-fill');
          if (baseFill) {
            circle.attr('fill', baseFill);
          }
          const label = selection.select<SVGTextElement>('text.node-label');
          if (!label.empty()) {
            label.style('opacity', 1);
          }
        });
      linkSelection.attr('stroke', '#b8bec9').attr('stroke-width', 1.4).attr('opacity', 0.95);
    };
  }, [hoveredNode?.id]);

  useEffect(() => {
    return () => {
      clearTooltipTimeout();
    };
  }, []);

  const hasMetrics =
    typeof hoveredNode?.metrics?.folderCount === 'number' ||
    typeof hoveredNode?.metrics?.fileCount === 'number' ||
    typeof hoveredNode?.metrics?.totalSize === 'number' ||
    typeof hoveredNode?.activityScore === 'number';
  const hasDates = Boolean(hoveredNode?.modifiedDate || hoveredNode?.createdDate);
  const hasExtraInfo = hasMetrics || hasDates;
  const showExtraInfo = hasExtraInfo && isTooltipExpanded;
  const tooltipHeight = hasExtraInfo && isTooltipExpanded
    ? HOVER_TOOLTIP_EXPANDED_HEIGHT
    : HOVER_TOOLTIP_COMPACT_HEIGHT;
  const locationPath =
    hoveredNode?.pathSegments && hoveredNode.pathSegments.length > 0
      ? hoveredNode.pathSegments.join(' / ')
      : '';
  const hasLocation = Boolean(locationPath);
  const canHideFromTooltip = Boolean(
    onFolderSelectionChange &&
      hoveredNode &&
      hoveredNode.id !== 'folder-fox' &&
      hoveredNode.depth > 0,
  );
  const hideButtonDisabled = hoveredNode?.isSelected === false;
  const hideButtonLabel = hideButtonDisabled ? 'Hidden' : 'Hide';

  const handleHideFromTooltip = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!hoveredNode?.id || !canHideFromTooltip || hideButtonDisabled) {
      return;
    }

    onFolderSelectionChange?.(hoveredNode.id, false);
    closeTooltip();
  };

  return (
    <div
      ref={containerRef}
      className="relative pt-28"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        minWidth: `${MIN_WIDTH}px`,
        minHeight: `${MIN_HEIGHT}px`,
      }}
    >
      <IntegrationFilter
        services={availableServices}
        activeServiceId={activeServiceId}
        onServiceSelect={serviceId => {
          if (serviceId !== null) {
            setActiveServiceId(serviceId);
          }
        }}
      />
      <svg ref={svgRef} className="w-full h-full" />
      {hoveredNode && (
        <div
          className="pointer-events-auto absolute w-full max-w-[320px] overflow-hidden rounded-3xl border border-neutral-200 bg-white/95 text-sm shadow-2xl backdrop-blur-sm transition-shadow dark:border-neutral-700 dark:bg-neutral-900/90"
          style={{
            left: Math.min(
              Math.max(0, hoveredNode.position.x + 18),
              Math.max(0, size.width - HOVER_TOOLTIP_WIDTH),
            ),
            top: Math.min(
              Math.max(0, hoveredNode.position.y + 18),
              Math.max(0, size.height - tooltipHeight),
            ),
            width: HOVER_TOOLTIP_WIDTH,
          }}
          onMouseEnter={() => {
            setTooltipHoverState(true);
            clearTooltipTimeout();
          }}
          onMouseLeave={() => {
            setTooltipHoverState(false);
            scheduleTooltipClose();
          }}
        >
          <div className="border-b border-neutral-200 bg-white/70 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-lg leading-none">
                    📁
                  </span>
                  <p className="truncate text-base font-semibold text-slate-900 dark:text-neutral-100">
                    {hoveredNode.name}
                  </p>
                </div>
                {hoveredNode.serviceName && (
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                    {hoveredNode.serviceName}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hoveredNode.canExpand && (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleHoveredExpansion();
                    }}
                  >
                    {hoveredNode.isExpanded ? 'Collapse' : 'Expand'}
                    {hoveredNode.isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                {hoveredNode.link && (
                  <a
                    href={hoveredNode.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
                    onClick={event => {
                      event.stopPropagation();
                    }}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {hasLocation && (
            <div className="border-b border-neutral-200 px-5 py-3 text-xs leading-relaxed text-slate-600 dark:border-neutral-800 dark:text-neutral-300">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                Location
              </p>
              <p className="mt-1 break-words text-sm text-slate-700 dark:text-neutral-100">{locationPath}</p>
            </div>
          )}

          {hasExtraInfo && (
            <div className="px-5 py-3">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl bg-slate-100/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-neutral-800/60 dark:text-neutral-200 dark:hover:bg-neutral-800"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsTooltipExpanded(prev => !prev);
                }}
              >
                <span>Details</span>
                {isTooltipExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showExtraInfo && (
                <div className="mt-3 space-y-4 rounded-2xl border border-neutral-200/70 bg-white/90 px-4 py-4 text-[12px] shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900/60">
                  {hasMetrics && (
                    <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-neutral-200 sm:grid-cols-2">
                      {typeof hoveredNode.metrics?.folderCount === 'number' && (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                          <span className="font-medium text-slate-500 dark:text-neutral-200">Folders</span>
                          <span className="font-semibold text-slate-900 dark:text-neutral-50">
                            {numberFormatter.format(hoveredNode.metrics?.folderCount ?? 0)}
                          </span>
                        </div>
                      )}
                      {typeof hoveredNode.metrics?.fileCount === 'number' && (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                          <span className="font-medium text-slate-500 dark:text-neutral-200">Files</span>
                          <span className="font-semibold text-slate-900 dark:text-neutral-50">
                            {numberFormatter.format(hoveredNode.metrics?.fileCount ?? 0)}
                          </span>
                        </div>
                      )}
                      {typeof hoveredNode.metrics?.totalSize === 'number' && (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                          <span className="font-medium text-slate-500 dark:text-neutral-200">Storage</span>
                          <span className="font-semibold text-slate-900 dark:text-neutral-50">
                            {formatBytes(hoveredNode.metrics?.totalSize ?? undefined)}
                          </span>
                        </div>
                      )}
                      {typeof hoveredNode.activityScore === 'number' && (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                          <span className="font-medium text-slate-500 dark:text-neutral-200">Activity</span>
                          <span className="font-semibold text-slate-900 dark:text-neutral-50">
                            {numberFormatter.format(hoveredNode.activityScore)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {hasDates && (
                    <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-neutral-200 sm:grid-cols-2">
                      {hoveredNode.modifiedDate && (
                        <div className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                            Modified
                          </p>
                          <p className="mt-1 font-semibold text-slate-900 dark:text-neutral-100">
                            {formatDate(hoveredNode.modifiedDate)}
                          </p>
                        </div>
                      )}
                      {hoveredNode.createdDate && (
                        <div className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                            Created
                          </p>
                          <p className="mt-1 font-semibold text-slate-900 dark:text-neutral-100">
                            {formatDate(hoveredNode.createdDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {canHideFromTooltip && (
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-100 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-400"
                      onClick={handleHideFromTooltip}
                      disabled={hideButtonDisabled}
                    >
                      {hideButtonLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
