//OrbitalMap
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

import { MIN_HEIGHT, MIN_WIDTH } from './constants';
import { buildHierarchy, getVisibleNodesAndLinks } from './hierarchy';
import { renderNodes } from './rendering';
import { createManualPhysics } from './physics';
import { getNodeId } from './nodeUtils';
import { D3GroupSelection, D3HierarchyNode, NodePosition, OrbitalMapProps, FolderItem } from './types';
import { getNodeRadius } from './geometry';
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
  screenRadius: number;
  baseRadius: number;
  nodePosition: { x: number; y: number };
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

const MAX_LIGHTENING = 0.85;
const LIGHTEN_STEP = 0.4;
const BASE_DARKEN = -0.25;
const HOVER_TOOLTIP_WIDTH = 320;
const DIMMED_FILL_LIGHTEN = 0.55;
const TOOLTIP_GAP = 16;

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

export const OrbitalMap: React.FC<OrbitalMapProps> = ({
  folders,
  colorPaletteId,
  onFolderSelectionChange,
}) => {
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
  const hoveredNodeIdRef = useRef<string | null>(null);
  const [isTooltipExpanded, setIsTooltipExpanded] = useState(false);
  const isTooltipHoveredRef = useRef(false);
  const closeTooltipTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  const closeTooltip = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const recalculateTooltipPosition = useCallback(() => {
    const hoveredId = hoveredNodeIdRef.current;
    if (!hoveredId || !containerRef.current || !svgRef.current || !gRef.current) {
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const svgElement = svgRef.current;
    const rootGroup = gRef.current;
    const groupNode = rootGroup.node();

    if (!svgElement || !groupNode) {
      return;
    }

    setHoveredNode(prev => {
      if (!prev || prev.id !== hoveredId) {
        return prev;
      }

      const currentZoom = zoomTransformRef.current?.k ?? 1;
      const storedPosition = nodePositionsRef.current.get(hoveredId);
      const nodePosition = storedPosition
        ? { x: storedPosition.x, y: storedPosition.y }
        : prev.nodePosition;
      const svgPoint = svgElement.createSVGPoint();
      svgPoint.x = nodePosition.x;
      svgPoint.y = nodePosition.y;

      const screenMatrix = groupNode.getScreenCTM();
      if (!screenMatrix) {
        return prev;
      }

      const screenPoint = svgPoint.matrixTransform(screenMatrix);
      const nextPosition = {
        x: screenPoint.x - containerRect.left,
        y: screenPoint.y - containerRect.top,
      };
      const screenRadius = prev.baseRadius * currentZoom;

      if (
        prev.position.x === nextPosition.x &&
        prev.position.y === nextPosition.y &&
        prev.screenRadius === screenRadius &&
        prev.nodePosition.x === nodePosition.x &&
        prev.nodePosition.y === nodePosition.y
      ) {
        return prev;
      }

      return {
        ...prev,
        position: nextPosition,
        screenRadius,
        nodePosition,
      };
    });
  }, [setHoveredNode]);

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
      .on('zoom', event => {
        zoomTransformRef.current = event.transform;
        g.attr('transform', event.transform);
        recalculateTooltipPosition();
      });

    svg.call(zoom as any);
    svg.on('dblclick.zoom', null);
  }, [recalculateTooltipPosition]);

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

    const getTooltipAnchorPosition = (event: PointerEvent) => {
      const container = containerRef.current;
      const containerRect = container?.getBoundingClientRect();
      const targetElement = event.currentTarget as Element | null;
      const circleElement = targetElement?.querySelector('circle.node-circle') as
        | SVGCircleElement
        | null;
      const circleRect = circleElement?.getBoundingClientRect();

      if (containerRect && circleRect) {
        const radius = circleRect.width / 2;
        return {
          x: circleRect.left - containerRect.left + radius,
          y: circleRect.top - containerRect.top + radius,
          radius,
        };
      }

      if (containerRect) {
        return {
          x: event.clientX - containerRect.left,
          y: event.clientY - containerRect.top,
          radius: 0,
        };
      }

      return {
        x: event.clientX,
        y: event.clientY,
        radius: 0,
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
      const anchor = getTooltipAnchorPosition(event);
      const currentZoom = zoomTransformRef.current?.k ?? 1;
      const baseRadius = getNodeRadius(d.depth ?? 0);
      const screenRadius = anchor.radius > 0 ? anchor.radius : baseRadius * currentZoom;
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
      setHoveredNode({
        id,
        name: d.data?.name ?? 'Node',
        depth: d.depth ?? 0,
        lineage,
        position: { x: anchor.x, y: anchor.y },
        screenRadius,
        baseRadius,
        nodePosition: { x: d.x ?? 0, y: d.y ?? 0 },
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
      hoveredNodeIdRef.current = id;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          recalculateTooltipPosition();
        });
      } else {
        setTimeout(() => {
          recalculateTooltipPosition();
        }, 0);
      }
    };

    const handleNodeLeave = () => {
      if (isTooltipHoveredRef.current) return;
      scheduleTooltipClose();
    };

    node = renderNodes(svg, nodeLayer, visibleNodes, {
      colorAssignments: nodeStyles,
      onNodeEnter: handleNodeEnter,
      onNodeLeave: handleNodeLeave,
    }).style('pointer-events', 'all');

    node.call(
      d3
        .drag<SVGGElement, any>()
        .on('start', (event: any, d: any) => {
          isDraggingRef.current = true;
          clearTooltipTimeout();
          setTooltipHoverState(false);
          closeTooltip();
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
  }, [closeTooltip, folders, size, expanded, colorPaletteId]);

  useEffect(() => {
    if (hoveredNode?.id) {
      hoveredNodeIdRef.current = hoveredNode.id;
      recalculateTooltipPosition();
    } else {
      hoveredNodeIdRef.current = null;
    }

    setIsTooltipExpanded(false);
  }, [hoveredNode?.id, recalculateTooltipPosition]);

  useEffect(() => {
    recalculateTooltipPosition();
  }, [size.width, size.height, recalculateTooltipPosition]);

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
      .style('opacity', 1)
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

      const dimmedFill =
        circle.attr('data-dimmed-fill') || shiftColor(baseFill, DIMMED_FILL_LIGHTEN);
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
          className="pointer-events-auto absolute w-full max-w-[320px] text-sm"
          style={{
            width: HOVER_TOOLTIP_WIDTH,
            left: hoveredNode.position.x,
            top: hoveredNode.position.y,
            transform: `translate(${hoveredNode.screenRadius + TOOLTIP_GAP}px, -50%)`,
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
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-sm transition-shadow dark:border-neutral-700 dark:bg-neutral-900/90">
            <div className="border-b border-neutral-200 bg-white/70 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {hoveredNode.lineage.length > 1 && (
                    <p className="mb-1 truncate text-[11px] text-slate-400 dark:text-neutral-500">
                      {hoveredNode.lineage.join(' › ')}
                    </p>
                  )}
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
        </div>
      )}
    </div>
  );
};