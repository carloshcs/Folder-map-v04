//OrbitalMap
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

import { MIN_HEIGHT, MIN_WIDTH } from './constants';
import { buildHierarchy, getVisibleNodesAndLinks } from './hierarchy';
import { renderNodes } from './rendering';
import { createManualPhysics } from './physics';
import { getNodeId } from './nodeUtils';
import { D3GroupSelection, NodePosition, OrbitalMapProps, SidebarPalette } from './types';

const DEFAULT_PALETTE: SidebarPalette = {
  primary: '#030213',
  primaryForeground: '#ffffff',
  accent: '#e7e7ef',
  accentForeground: '#030213',
  surface: '#f8f8f8',
  surfaceForeground: '#1a1a1a',
  border: '#d2d2d7',
};

function readSidebarPalette(): SidebarPalette {
  if (typeof window === 'undefined') return DEFAULT_PALETTE;

  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const getVar = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };

  return {
    primary: getVar('--color-sidebar-primary', DEFAULT_PALETTE.primary),
    primaryForeground: getVar(
      '--color-sidebar-primary-foreground',
      DEFAULT_PALETTE.primaryForeground,
    ),
    accent: getVar('--color-sidebar-accent', DEFAULT_PALETTE.accent),
    accentForeground: getVar(
      '--color-sidebar-accent-foreground',
      DEFAULT_PALETTE.accentForeground,
    ),
    surface: getVar('--color-sidebar', DEFAULT_PALETTE.surface),
    surfaceForeground: getVar(
      '--color-sidebar-foreground',
      DEFAULT_PALETTE.surfaceForeground,
    ),
    border: getVar('--color-sidebar-border', DEFAULT_PALETTE.border),
  };
}

export const OrbitalMap: React.FC<OrbitalMapProps> = ({ folders }) => {
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

    const palette = readSidebarPalette();

    const defs = svg.append('defs');

    const shadow = defs
      .append('filter')
      .attr('id', 'nodeShadow')
      .attr('x', '-25%')
      .attr('y', '-25%')
      .attr('width', '150%')
      .attr('height', '150%');

    shadow
      .append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 8)
      .attr('stdDeviation', 12)
      .attr('flood-color', palette.border)
      .attr('flood-opacity', 0.45);

    const folderGradient = defs
      .append('radialGradient')
      .attr('id', 'folderFoxGradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '65%');

    folderGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', palette.primaryForeground)
      .attr('stop-opacity', 0.9);

    folderGradient
      .append('stop')
      .attr('offset', '70%')
      .attr('stop-color', palette.primary)
      .attr('stop-opacity', 0.95);

    const integrationGradient = defs
      .append('radialGradient')
      .attr('id', 'integrationGradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '65%');

    integrationGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', palette.accentForeground)
      .attr('stop-opacity', 0.85);

    integrationGradient
      .append('stop')
      .attr('offset', '70%')
      .attr('stop-color', palette.accent)
      .attr('stop-opacity', 0.95);

    const defaultNodeGradient = defs
      .append('radialGradient')
      .attr('id', 'defaultNodeGradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '75%');

    defaultNodeGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', palette.surfaceForeground)
      .attr('stop-opacity', 0.12);

    defaultNodeGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', palette.surface)
      .attr('stop-opacity', 0.95);

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
    const palette = readSidebarPalette();
    const { width, height } = size;

    const root = buildHierarchy(folders);
    const { visibleNodes, visibleLinks } = getVisibleNodesAndLinks(root, expanded);

    const positions = visibleNodes.map(node => {
      const nodeId = getNodeId(node);
      const stored = nodePositionsRef.current.get(nodeId);
      return {
        x: stored?.x ?? node.x ?? 0,
        y: stored?.y ?? node.y ?? 0,
      };
    });

    const xValues = positions.map(p => p.x);
    const yValues = positions.map(p => p.y);
    const minX = Math.min(...xValues, 0);
    const maxX = Math.max(...xValues, 0);
    const minY = Math.min(...yValues, 0);
    const maxY = Math.max(...yValues, 0);

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const padding = Math.max(contentWidth, contentHeight) * 0.35 + 140;
    const viewWidth = Math.max(width * 0.85, contentWidth + padding);
    const viewHeight = Math.max(height * 0.85, contentHeight + padding);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    svg
      .attr('viewBox', [centerX - viewWidth / 2, centerY - viewHeight / 2, viewWidth, viewHeight])
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
            .attr('stroke', palette.border)
            .attr('stroke-opacity', 0.45)
            .attr('stroke-width', 1.6),
        update =>
          update
            .attr('stroke', palette.border)
            .attr('stroke-opacity', 0.45)
            .attr('stroke-width', 1.6),
        exit => exit.remove(),
      );

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

    node = renderNodes(svg, nodeLayer, visibleNodes, palette).style('pointer-events', 'all');

    node.call(
      d3
        .drag<SVGGElement, any>()
        .on('start', (event: any, d: any) => {
          physics.dragHandlers.onDragStart(d);
        })
        .on('drag', (event: any, d: any) => {
          const svgEl = svgRef.current!;
          const t = d3.zoomTransform(svgEl);
          const [px, py] = t.invert(d3.pointer(event, svgEl));
          physics.dragHandlers.onDrag(d, px, py);
        })
        .on('end', (event: any, d: any) => {
          physics.dragHandlers.onDragEnd(d);
        }) as any,
    );

    node.on('dblclick', (event: any, d: any) => {
      event.stopPropagation();
      const name = d.data?.name;
      if (!name) return;
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
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
  }, [folders, size, expanded]);

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
    </div>
  );
};