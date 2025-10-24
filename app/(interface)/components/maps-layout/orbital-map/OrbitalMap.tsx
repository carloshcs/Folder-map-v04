//OrbitalMap
'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  ChevronDown,
  ExternalLink,
  EyeOff,
  FileText,
  Folder as FolderIcon,
  HardDrive,
} from 'lucide-react';

import { LOGO_MAP, MIN_HEIGHT, MIN_WIDTH } from './constants';
import { buildHierarchy, getVisibleNodesAndLinks } from './hierarchy';
import { renderNodes } from './rendering';
import { createManualPhysics } from './physics';
import { getNodeId } from './nodeUtils';
import { D3GroupSelection, D3HierarchyNode, NodePosition, OrbitalMapProps, FolderItem } from './types';
import {
  getPaletteColors,
  getReadableTextColor,
  shiftColor,
} from '@/app/(interface)/lib/utils/colors';

type HoveredNodeInfo = {
  id: string;
  name: string;
  depth: number;
  lineage: string[];
  position: { x: number; y: number };
  pathSegments: string[];
  serviceName?: string;
  serviceId?: string;
  link?: string;
  metrics?: {
    totalSize?: number;
    fileCount?: number;
    folderCount?: number;
  };
  createdDate?: string;
  modifiedDate?: string;
  activityScore?: number;
  typeLabel?: string;
  owner?: string;
  shared?: boolean;
  permissionsCount?: number;
  permissionLevel?: string;
  isServiceRoot?: boolean;
  canExpand: boolean;
  isExpanded: boolean;
};

type NodeVisualStyle = {
  fill: string;
  textColor: string;
};

const MAX_LIGHTENING = 0.6;
const LIGHTEN_STEP = 0.18;
const BASE_DARKEN = -0.2;
const HOVER_TOOLTIP_WIDTH = 300;
const DEFAULT_TOOLTIP_HEIGHT = 280;

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

export const OrbitalMap: React.FC<OrbitalMapProps> = ({ folders, colorPaletteId, onNodeVisibilityChange }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1100, height: 900 });
  
  // Start with nothing expanded (only Folder Fox + integrations visible)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  const gRef = useRef<D3GroupSelection | null>(null);
  const linkLayerRef = useRef<D3GroupSelection | null>(null);
  const nodeLayerRef = useRef<D3GroupSelection | null>(null);
  const physicsRef = useRef<any>(null);
  const nodePositionsRef = useRef<Map<string, NodePosition>>(new Map());
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(DEFAULT_TOOLTIP_HEIGHT);
  const isTooltipHoveredRef = useRef(false);
  const closeTooltipTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

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
      setHoveredNode(null);
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

    const hoverGlow = defs
      .append('filter')
      .attr('id', 'node-hover-glow')
      .attr('x', '-70%')
      .attr('y', '-70%')
      .attr('width', '240%')
      .attr('height', '240%');

    hoverGlow
      .append('feGaussianBlur')
      .attr('stdDeviation', 6)
      .attr('result', 'coloredBlur');

    const merge = hoverGlow.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g').attr('class', 'orbital-root');
    gRef.current = g;

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

  useEffect(() => {
    if (!svgRef.current || !gRef.current || !nodeLayerRef.current || !linkLayerRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = size;

    const root = buildHierarchy(folders);
    const nodeStyles = computeNodeStyles(root, colorPaletteId);
    const { visibleNodes, visibleLinks } = getVisibleNodesAndLinks(root, expanded);

    const maxDimension = Math.max(width, height);
    const viewPadding = maxDimension * 0.35;
    const viewWidth = width + viewPadding * 2;
    const viewHeight = height + viewPadding * 2;

    svg
      .attr('viewBox', [-viewWidth / 2, -viewHeight / 2, viewWidth, viewHeight])
      .attr('width', width)
      .attr('height', height)
      .style('background', 'none')
      .style('overflow', 'visible');

    const linkLayer = linkLayerRef.current!;
    const nodeLayer = nodeLayerRef.current!;

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
      .attr('opacity', 0.85);

    if (physicsRef.current) physicsRef.current.stop();

    let node: any;

    const physics = createManualPhysics(visibleNodes, () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      if (node) node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    }, nodePositionsRef.current);

    physicsRef.current = physics;

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
      if (isDraggingRef.current) return;
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
      const serviceId = item?.serviceId ?? nodeData.serviceId;
      const typeLabel =
        item?.type ??
        (d.depth === 0
          ? 'Workspace'
          : d.depth === 1
            ? 'Integration'
            : 'Folder');
      const owner = item?.owner ?? nodeData.owner;
      const shared = item?.shared ?? nodeData.shared;
      const permissionsCount = item?.permissionsCount ?? nodeData.permissionsCount;
      const permissionLevel = item?.permissionLevel ?? nodeData.permissionLevel;
      const isServiceRoot = d.depth === 1 && (d.parent?.data?.name === 'Folder Fox' || d.parent?.data?.id === 'folder-fox');

      setHoveredNode({
        id,
        name: d.data?.name ?? 'Node',
        depth: d.depth ?? 0,
        lineage,
        position,
        pathSegments: trimmedLineage,
        serviceName: trimmedLineage[0],
        serviceId,
        link,
        metrics,
        createdDate,
        modifiedDate,
        activityScore,
        typeLabel,
        owner,
        shared,
        permissionsCount,
        permissionLevel,
        isServiceRoot,
        canExpand: Boolean(d.hasChildren),
        isExpanded: Boolean(d.isExpanded),
      });
    };

    const handleNodeMove = (event: PointerEvent) => {
      if (isDraggingRef.current) return;
      const position = getRelativePosition(event);
      setHoveredNode(prev => (prev ? { ...prev, position } : prev));
    };

    const handleNodeLeave = () => {
      if (isTooltipHoveredRef.current) return;
      scheduleTooltipClose();
    };

    node = renderNodes(svg, nodeLayer, visibleNodes, {
      colorAssignments: nodeStyles,
      onNodeEnter: handleNodeEnter,
      onNodeMove: handleNodeMove,
      onNodeLeave: handleNodeLeave,
    }).style('pointer-events', 'all');

    node.call(
      d3
        .drag<SVGGElement, any>()
        .on('start', (event: any, d: any) => {
          isDraggingRef.current = true;
          clearTooltipTimeout();
          setTooltipHoverState(false);
          setHoveredNode(null);
          physics.dragHandlers.onDragStart(d);
        })
        .on('drag', (event: any, d: any) => {
          const svgEl = svgRef.current!;
          const t = d3.zoomTransform(svgEl);
          const [px, py] = t.invert(d3.pointer(event, svgEl));
          physics.dragHandlers.onDrag(d, px, py);
        })
        .on('end', (event: any, d: any) => {
          isDraggingRef.current = false;
          physics.dragHandlers.onDragEnd(d);
        }) as any,
    );

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

    visibleNodes.forEach(node => {
      const nodeId = getNodeId(node);
      nodePositionsRef.current.set(nodeId, {
        x: node.x!,
        y: node.y!,
        baseOrbitRadius: node.baseOrbitRadius!,
        calculatedRadius: node.calculatedRadius!,
        offsetAngle: node.offsetAngle!,
        orbitAngle: node.orbitAngle!,
      });
    });

    return () => physics.stop();
  }, [folders, size, expanded, colorPaletteId]);

  useLayoutEffect(() => {
    if (!hoveredNode) {
      setTooltipHeight(DEFAULT_TOOLTIP_HEIGHT);
      return;
    }

    if (!tooltipRef.current) {
      return;
    }

    const rect = tooltipRef.current.getBoundingClientRect();
    const nextHeight = Math.ceil(rect.height);
    if (Math.abs(nextHeight - tooltipHeight) > 2) {
      setTooltipHeight(nextHeight);
    }
  }, [hoveredNode?.id, tooltipHeight]);

  useEffect(() => {
    if (!hoveredNode) {
      return;
    }

    setHoveredNode(prev => {
      if (!prev) {
        return prev;
      }
      const isExpanded = expanded.has(prev.id);
      if (prev.isExpanded === isExpanded) {
        return prev;
      }
      return { ...prev, isExpanded };
    });
  }, [expanded, hoveredNode?.id]);

  useEffect(() => {
    const hoveredId = hoveredNode?.id;
    if (!nodeLayerRef.current || !linkLayerRef.current) return;

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
        return relatedIds.has(nodeId) ? 1 : 0.25;
      })
      .style('transform-origin', 'center')
      .attr('filter', (d: any) => (getNodeId(d) === hoveredId ? 'url(#node-hover-glow)' : 'url(#node-shadow)'));

    nodeSelection.each(function (d: any) {
      const circle = d3.select(this).select<SVGCircleElement>('circle.node-circle');
      if (circle.empty()) return;

      const isHighlighted = hoveredId ? getNodeId(d) === hoveredId : false;
      const defaultStroke = d.depth <= 1 ? '#d0d5dd' : '#333';
      const defaultStrokeWidth = d.depth <= 1 ? 2 : 1.2;
      const highlightStrokeWidth = d.depth <= 1 ? 3.2 : 2.4;

      circle
        .attr('stroke', isHighlighted ? '#4f46e5' : defaultStroke)
        .attr('stroke-width', isHighlighted ? highlightStrokeWidth : defaultStrokeWidth);
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
        if (!hoveredId) return 0.85;
        const sourceId = getNodeId(d.source);
        const targetId = getNodeId(d.target);
        return sourceId === hoveredId || targetId === hoveredId ? 1 : 0.35;
      });

    return () => {
      nodeSelection
        .style('opacity', 1)
        .attr('filter', 'url(#node-shadow)')
        .each(function (d: any) {
          const circle = d3.select(this).select<SVGCircleElement>('circle.node-circle');
          if (circle.empty()) return;
          const defaultStroke = d.depth <= 1 ? '#d0d5dd' : '#333';
          const defaultStrokeWidth = d.depth <= 1 ? 2 : 1.2;
          circle.attr('stroke', defaultStroke).attr('stroke-width', defaultStrokeWidth);
        });
      linkSelection.attr('stroke', '#b8bec9').attr('stroke-width', 1.4).attr('opacity', 0.85);
    };
  }, [hoveredNode?.id]);

  useEffect(() => {
    return () => {
      clearTooltipTimeout();
    };
  }, []);

  const hasMetrics = Boolean(
    hoveredNode && (
      typeof hoveredNode.metrics?.folderCount === 'number' ||
      typeof hoveredNode.metrics?.fileCount === 'number' ||
      typeof hoveredNode.metrics?.totalSize === 'number' ||
      typeof hoveredNode.activityScore === 'number'
    ),
  );
  const hasDates = Boolean(hoveredNode?.modifiedDate || hoveredNode?.createdDate);
  const stats = hoveredNode
    ? [
        {
          key: 'folders',
          label: 'Folders',
          value:
            typeof hoveredNode.metrics?.folderCount === 'number'
              ? numberFormatter.format(hoveredNode.metrics.folderCount)
              : '—',
          icon: FolderIcon,
        },
        {
          key: 'files',
          label: 'Files',
          value:
            typeof hoveredNode.metrics?.fileCount === 'number'
              ? numberFormatter.format(hoveredNode.metrics.fileCount)
              : '—',
          icon: FileText,
        },
        {
          key: 'storage',
          label: 'Storage',
          value:
            typeof hoveredNode.metrics?.totalSize === 'number'
              ? formatBytes(hoveredNode.metrics.totalSize)
              : '—',
          icon: HardDrive,
        },
        {
          key: 'activity',
          label: 'Activity',
          value:
            typeof hoveredNode.activityScore === 'number'
              ? numberFormatter.format(hoveredNode.activityScore)
              : '—',
          icon: Activity,
        },
      ]
    : [];
  const locationSegments = hoveredNode?.pathSegments ?? [];
  const serviceBadge = hoveredNode?.serviceName;
  const serviceLogo = serviceBadge ? LOGO_MAP[serviceBadge] : undefined;
  const sharingSummary = hoveredNode
    ? hoveredNode.shared
      ? hoveredNode.permissionsCount && hoveredNode.permissionsCount > 1
        ? `Shared with ${hoveredNode.permissionsCount - 1} others`
        : 'Shared with 1 person'
      : 'Private'
    : undefined;
  const permissionSummary = hoveredNode?.permissionLevel
    ? hoveredNode.permissionLevel.charAt(0).toUpperCase() + hoveredNode.permissionLevel.slice(1)
    : hoveredNode?.shared
      ? 'Edit'
      : 'Owner';
  const permissionDetail = hoveredNode?.permissionsCount
    ? `${hoveredNode.permissionsCount} ${hoveredNode.permissionsCount === 1 ? 'member' : 'members'}`
    : undefined;
  const canHideNode = Boolean(onNodeVisibilityChange && hoveredNode && hoveredNode.depth > 0);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        minWidth: `${MIN_WIDTH}px`,
        minHeight: `${MIN_HEIGHT}px`,
      }}
    >
      <svg ref={svgRef} className="w-full h-full" />
      {hoveredNode && (
        <div
          ref={tooltipRef}
          className="pointer-events-auto absolute rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 text-sm shadow-xl backdrop-blur transition-shadow dark:border-slate-700 dark:bg-slate-900/90"
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
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                  serviceLogo
                    ? 'border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80'
                    : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200'
                }`}
              >
                {serviceLogo ? (
                  <img src={serviceLogo} alt={serviceBadge ?? 'Service icon'} className="h-8 w-8 object-contain" />
                ) : (
                  <FolderIcon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">
                  {hoveredNode.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {hoveredNode.typeLabel && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
                      {hoveredNode.typeLabel}
                    </span>
                  )}
                  {serviceBadge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
                      {serviceLogo ? (
                        <img src={serviceLogo} alt={serviceBadge} className="h-3.5 w-3.5 object-contain" />
                      ) : null}
                      {serviceBadge}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {hoveredNode.canExpand && (
                <button
                  type="button"
                  title={hoveredNode.isExpanded ? 'Collapse in map' : 'Expand in map'}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/60 dark:hover:text-indigo-200"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleHoveredExpansion();
                  }}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${hoveredNode.isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
              {hoveredNode.link && (
                <a
                  href={hoveredNode.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/60 dark:hover:text-indigo-200"
                  onClick={event => {
                    event.stopPropagation();
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {locationSegments.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Location</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                {locationSegments.map((segment, index) => (
                  <React.Fragment key={`${segment}-${index}`}>
                    <button
                      type="button"
                      className="rounded-md border border-transparent bg-slate-100 px-2 py-0.5 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-indigo-500/60 dark:hover:bg-slate-800 dark:hover:text-indigo-200"
                    >
                      {segment}
                    </button>
                    {index < locationSegments.length - 1 && <span className="text-slate-400">/</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {hasMetrics && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Details</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {stats.map(stat => (
                  <div
                    key={stat.key}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/80 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <stat.icon className="mt-0.5 h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{stat.label}</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(hoveredNode?.owner || sharingSummary || permissionSummary) && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-slate-600 dark:text-slate-300">
              {hoveredNode?.owner && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Owner</p>
                  <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{hoveredNode.owner}</p>
                </div>
              )}
              {sharingSummary && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Sharing</p>
                  <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{sharingSummary}</p>
                </div>
              )}
              {permissionSummary && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Permissions</p>
                  <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                    {permissionSummary}
                    {permissionDetail ? (
                      <span className="ml-1 text-[10px] font-normal text-slate-500 dark:text-slate-400">• {permissionDetail}</span>
                    ) : null}
                  </p>
                </div>
              )}
            </div>
          )}

          {hasDates && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-slate-600 dark:text-slate-300">
              {hoveredNode.modifiedDate && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Modified</p>
                  <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{formatDate(hoveredNode.modifiedDate)}</p>
                </div>
              )}
              {hoveredNode.createdDate && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Created</p>
                  <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{formatDate(hoveredNode.createdDate)}</p>
                </div>
              )}
            </div>
          )}

          {canHideNode && (
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/60 dark:hover:bg-slate-800 dark:hover:text-indigo-200"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                if (onNodeVisibilityChange) {
                  onNodeVisibilityChange(hoveredNode.id, false);
                }
                clearTooltipTimeout();
                setHoveredNode(null);
              }}
            >
              <EyeOff className="h-4 w-4" />
              Hide from map
            </button>
          )}
        </div>
      )}
    </div>
  );
};