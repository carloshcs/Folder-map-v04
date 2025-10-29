//OrbitalMap
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

import { MIN_HEIGHT, MIN_WIDTH } from './constants';
import { buildHierarchy, getVisibleNodesAndLinks } from './hierarchy';
import { renderNodes } from './rendering';
import { createManualPhysics } from './physics';
import { getNodeId } from './nodeUtils';
import {
  D3GroupSelection,
  D3HierarchyNode,
  HoveredNodeInfo,
  NodePosition,
  OrbitalMapProps,
  FolderItem,
} from './types';
import { getNodeRadius } from './geometry';
import { computeNodeStyles, DIMMED_FILL_LIGHTEN } from '../utils/styles';
import { shiftColor } from '@/app/(interface)/lib/utils/colors';
import { OrbitalTooltip } from './OrbitalTooltip';
import { getTooltipAnchorForNode } from './tooltipPositioning';
import type { TooltipAnchor } from './tooltipPositioning';

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
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const isTooltipHoveredRef = useRef(false);
  const closeTooltipTimeoutRef = useRef<number | null>(null);
  const tooltipFadeTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  const closeTooltip = useCallback(() => {
    if (tooltipFadeTimeoutRef.current !== null) {
      window.clearTimeout(tooltipFadeTimeoutRef.current);
      tooltipFadeTimeoutRef.current = null;
    }

    setIsTooltipVisible(false);

    tooltipFadeTimeoutRef.current = window.setTimeout(() => {
      setHoveredNode(null);
      tooltipFadeTimeoutRef.current = null;
    }, 240);
  }, []);

  const canvasToScreen = useCallback(
    (point: { x: number; y: number }) => {
      const svgElement = svgRef.current;
      const transform = zoomTransformRef.current ?? d3.zoomIdentity;

      if (!svgElement) {
        return { x: point.x, y: point.y };
      }

      const svgPoint = svgElement.createSVGPoint();
      const [tx, ty] = transform.apply([point.x, point.y]);
      svgPoint.x = tx;
      svgPoint.y = ty;

      const ctm = svgElement.getScreenCTM();
      if (!ctm) {
        return { x: tx, y: ty };
      }

      const screenPoint = svgPoint.matrixTransform(ctm);
      return { x: screenPoint.x, y: screenPoint.y };
    },
    [],
  );

  const screenToCanvas = useCallback(
    (point: { x: number; y: number }) => {
      const svgElement = svgRef.current;
      const transform = zoomTransformRef.current ?? d3.zoomIdentity;

      if (!svgElement) {
        return { x: point.x, y: point.y };
      }

      const ctm = svgElement.getScreenCTM();
      if (!ctm) {
        return { x: point.x, y: point.y };
      }

      const svgPoint = svgElement.createSVGPoint();
      svgPoint.x = point.x;
      svgPoint.y = point.y;

      const localPoint = svgPoint.matrixTransform(ctm.inverse());
      const [cx, cy] = transform.invert([localPoint.x, localPoint.y]);
      return { x: cx, y: cy };
    },
    [],
  );

  const computeTooltipAnchor = useCallback(
    (nodeId: string, depth: number): TooltipAnchor | null => {
      const transform = zoomTransformRef.current ?? d3.zoomIdentity;

      return getTooltipAnchorForNode({
        nodeId,
        depth,
        nodePositions: nodePositionsRef.current,
        zoomScale: transform.k,
        canvasToScreen,
      });
    },
    [canvasToScreen],
  );

  const getEventBasedAnchor = (event: PointerEvent): TooltipAnchor | null => {
    const transform = zoomTransformRef.current ?? d3.zoomIdentity;

    const targetElement = event.currentTarget as Element | null;
    const circleElement = targetElement?.querySelector('circle.node-circle') as
      | SVGCircleElement
      | null;
    const circleRect = circleElement?.getBoundingClientRect() ?? null;

    if (circleRect) {
      const radius = circleRect.width / 2;
      return {
        position: {
          x: circleRect.left + radius,
          y: circleRect.top,
        },
        screenRadius: radius,
        baseRadius: radius / transform.k,
      };
    }

    const screenPosition = { x: event.clientX, y: event.clientY };
    void screenToCanvas(screenPosition);

    return {
      position: {
        x: screenPosition.x,
        y: screenPosition.y,
      },
      screenRadius: 0,
      baseRadius: 0,
    };
  };

  const recalculateTooltipPosition = useCallback(() => {
    const hoveredId = hoveredNodeIdRef.current;

    if (!hoveredId) {
      return;
    }

    setHoveredNode(prev => {
      if (!prev || prev.id !== hoveredId) {
        return prev;
      }

      const anchor = computeTooltipAnchor(prev.id, prev.depth);

      if (!anchor) {
        return prev;
      }

      if (
        prev.position.x === anchor.position.x &&
        prev.position.y === anchor.position.y &&
        prev.screenRadius === anchor.screenRadius &&
        prev.baseRadius === anchor.baseRadius
      ) {
        return prev;
      }

      return {
        ...prev,
        position: anchor.position,
        screenRadius: anchor.screenRadius,
        baseRadius: anchor.baseRadius,
      };
    });
  }, [computeTooltipAnchor]);

  const setTooltipHoverState = (value: boolean) => {
    isTooltipHoveredRef.current = value;
  };

  const clearTooltipTimeout = () => {
    if (closeTooltipTimeoutRef.current !== null) {
      window.clearTimeout(closeTooltipTimeoutRef.current);
      closeTooltipTimeoutRef.current = null;
    }
    if (tooltipFadeTimeoutRef.current !== null) {
      window.clearTimeout(tooltipFadeTimeoutRef.current);
      tooltipFadeTimeoutRef.current = null;
    }
  };

  const scheduleTooltipClose = () => {
    clearTooltipTimeout();
    closeTooltipTimeoutRef.current = window.setTimeout(() => {
      closeTooltip();
    }, 160);
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
    const nodeStyles = computeNodeStyles(root, colorPaletteId, {
      resetIndexAtDepth: 1,
    });
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

    const handleNodeEnter = (event: PointerEvent, d: any) => {
      if (isDraggingRef.current) return;
      clearTooltipTimeout();
      setTooltipHoverState(false);

      const id = getNodeId(d);
      const lineage = getLineageNames(d);
      const trimmedLineage = lineage.filter(
        (name, index) => !(index === 0 && name === 'Folder Fox'),
      );
      const anchor = computeTooltipAnchor(id, d.depth ?? 0) ?? getEventBasedAnchor(event);
      if (!anchor) return;

      const currentZoom = zoomTransformRef.current?.k ?? 1;
      const fallbackBaseRadius = getNodeRadius(d.depth ?? 0);
      const baseRadius = anchor.baseRadius || fallbackBaseRadius;
      const screenRadius = anchor.screenRadius || baseRadius * currentZoom;
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
      setIsTooltipVisible(true);
      setHoveredNode({
        id,
        name: d.data?.name ?? 'Node',
        depth: d.depth ?? 0,
        lineage,
        position: anchor.position,
        screenRadius,
        baseRadius,
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
      paletteId: colorPaletteId ?? null,
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

    if (hoveredNode?.id) {
      setIsTooltipVisible(true);
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
      let hoveredDatum: any = null;

      nodeSelection.each(function (d: any) {
        if (!hoveredDatum && getNodeId(d) === hoveredId) {
          hoveredDatum = d;
        }
      });

      if (hoveredDatum) {
        const collectAncestors = (node: any | null) => {
          let current = node;
          while (current) {
            relatedIds.add(getNodeId(current));
            current = current.parent ?? null;
          }
        };

        const collectImmediateChildren = (node: any | null) => {
          if (!node?.children) return;
          node.children.forEach((child: any) => {
            relatedIds.add(getNodeId(child));
          });
        };

        relatedIds.add(hoveredId);
        collectAncestors(hoveredDatum.parent ?? null);
        collectImmediateChildren(hoveredDatum);
      }
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
        return relatedIds.has(sourceId) && relatedIds.has(targetId) ? '#6b7bff' : '#c5cad3';
      })
      .attr('stroke-width', (d: any) => {
        if (!hoveredId) return 1.4;
        const sourceId = getNodeId(d.source);
        const targetId = getNodeId(d.target);
        return relatedIds.has(sourceId) && relatedIds.has(targetId) ? 2.4 : 1;
      })
      .attr('opacity', (d: any) => {
        if (!hoveredId) return 0.95;
        const sourceId = getNodeId(d.source);
        const targetId = getNodeId(d.target);
        return relatedIds.has(sourceId) && relatedIds.has(targetId) ? 1 : 0.55;
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
      if (tooltipFadeTimeoutRef.current !== null) {
        window.clearTimeout(tooltipFadeTimeoutRef.current);
        tooltipFadeTimeoutRef.current = null;
      }
    };
  }, []);

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
        <OrbitalTooltip
          hoveredNode={hoveredNode}
          isDetailsExpanded={isTooltipExpanded}
          onToggleDetails={() => setIsTooltipExpanded(prev => !prev)}
          onToggleExpand={hoveredNode.canExpand ? toggleHoveredExpansion : undefined}
          onHide={canHideFromTooltip ? handleHideFromTooltip : undefined}
          hideButtonDisabled={hideButtonDisabled}
          hideButtonLabel={hideButtonLabel}
          isVisible={isTooltipVisible}
          onPointerEnter={() => {
            setTooltipHoverState(true);
            clearTooltipTimeout();
          }}
          onPointerLeave={() => {
            setTooltipHoverState(false);
            scheduleTooltipClose();
          }}
        />
      )}
    </div>
  );
};