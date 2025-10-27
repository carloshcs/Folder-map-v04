'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import { MIN_HEIGHT, MIN_WIDTH } from '../orbital-map/constants';
import { buildHierarchy } from '../orbital-map/hierarchy';
import { FolderItem } from '../orbital-map/types';
import { isServiceId, ServiceId } from '@/app/(interface)/components/right-sidebar/data';
import { IntegrationFilter, IntegrationService } from '@/app/(interface)/components/IntegrationFilter';
import { getNodeRadius } from '../orbital-map/geometry';
import { computeNodeStyles } from '../utils/styles';
import { getNodeId } from '../orbital-map/nodeUtils';

const LEVEL_RADII: Record<number, number> = {
  1: 220,
  2: 420,
  3: 640,
};

const RADIAL_SPACING = 180;
const VIEWBOX_PADDING = 260;

const PREDEFINED_LEVELS = Object.keys(LEVEL_RADII).map(level => Number(level));
const MAX_PREDEFINED_DEPTH = PREDEFINED_LEVELS.length
  ? Math.max(...PREDEFINED_LEVELS)
  : 0;
const MAX_PREDEFINED_RADIUS = MAX_PREDEFINED_DEPTH ? LEVEL_RADII[MAX_PREDEFINED_DEPTH] : 0;

const getRadiusForDepth = (depth: number) => {
  if (depth <= 0) return 0;
  if (LEVEL_RADII[depth]) return LEVEL_RADII[depth];
  if (!MAX_PREDEFINED_DEPTH) {
    return depth * RADIAL_SPACING;
  }
  return MAX_PREDEFINED_RADIUS + (depth - MAX_PREDEFINED_DEPTH) * RADIAL_SPACING;
};

const ensureLabelFits = (
  text: d3.Selection<SVGTextElement, unknown, null, undefined>,
  content: string,
  radius: number,
  textColor: string,
) => {
  const maxWidth = radius * 1.7;
  let fontSize = Math.max(8, Math.min(16, radius * 0.5));

  text
    .attr('fill', textColor)
    .attr('font-weight', '600')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('pointer-events', 'none')
    .attr('font-size', fontSize)
    .text(content);

  const node = text.node();
  if (!node) return;

  let textLength = node.getComputedTextLength();

  while (textLength > maxWidth && fontSize > 8) {
    fontSize -= 1;
    text.attr('font-size', fontSize);
    textLength = node.getComputedTextLength();
  }

  if (textLength <= maxWidth) {
    return;
  }

  let truncated = content;
  while (truncated.length > 1 && textLength > maxWidth) {
    truncated = truncated.slice(0, -1);
    text.text(`${truncated.trimEnd()}…`);
    textLength = node.getComputedTextLength();
  }
};

const SERVICE_DETAILS: Record<
  ServiceId,
  {
    name: string;
    logo: string;
    accent: string;
    hover: string;
    border: string;
    fill: string;
    stroke: string;
  }
> = {
  notion: {
    name: 'Notion',
    logo: '/assets/notion-logo.png',
    accent: 'bg-slate-100',
    hover: 'hover:bg-slate-200/80',
    border: 'border-slate-200',
    fill: '#CBD5F5',
    stroke: '#1F2937',
  },
  onedrive: {
    name: 'OneDrive',
    logo: '/assets/onedrive-logo.png',
    accent: 'bg-sky-100',
    hover: 'hover:bg-sky-100/90',
    border: 'border-sky-200',
    fill: '#BFDBFE',
    stroke: '#1D4ED8',
  },
  dropbox: {
    name: 'Dropbox',
    logo: '/assets/dropbox-logo.png',
    accent: 'bg-blue-100',
    hover: 'hover:bg-blue-100/90',
    border: 'border-blue-200',
    fill: '#C7D2FE',
    stroke: '#2563EB',
  },
  googledrive: {
    name: 'Google Drive',
    logo: '/assets/google-drive-logo.png',
    accent: 'bg-amber-100',
    hover: 'hover:bg-amber-100/90',
    border: 'border-amber-200',
    fill: '#FDE68A',
    stroke: '#CA8A04',
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

export interface RadialTreeMapProps {
  folders: FolderItem[];
  colorPaletteId?: string | null;
  onFolderSelectionChange?: (folderId: string, isSelected: boolean) => void;
}

const getDataIdentifier = (data: any): string | null => {
  if (!data) {
    return null;
  }

  return (
    data?.item?.id ??
    data?.id ??
    data?.path ??
    data?.name ??
    null
  );
};

const getNodeIdentifier = (node: d3.HierarchyNode<any>): string | null => {
  if (!node) {
    return null;
  }

  return getDataIdentifier(node.data);
};

export const RadialTreeMap: React.FC<RadialTreeMapProps> = ({
  folders,
  colorPaletteId,
  onFolderSelectionChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [size, setSize] = useState({ width: MIN_WIDTH, height: MIN_HEIGHT });
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(() => {
    for (const folder of folders) {
      const resolved = resolveServiceId(folder);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  });

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const element = containerRef.current;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(MIN_WIDTH, rect.width);
      const height = Math.max(MIN_HEIGHT, rect.height);
      setSize({ width, height });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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
      services.push({
        id: resolved,
        name: details.name,
        logo: details.logo,
        accent: details.accent,
        hover: details.hover,
        border: details.border,
      });
    });

    return services;
  }, [folders]);

  useEffect(() => {
    if (availableServices.length === 0) {
      setActiveServiceId(null);
      return;
    }

    if (activeServiceId && availableServices.some(service => service.id === activeServiceId)) {
      return;
    }

    setActiveServiceId(availableServices[0]?.id ?? null);
  }, [availableServices, activeServiceId]);

  const filteredFolders = useMemo(() => {
    if (!activeServiceId) {
      return folders;
    }

    return folders.filter(folder => resolveServiceId(folder) === activeServiceId);
  }, [folders, activeServiceId]);

  useEffect(() => {
    setExpandedNodes(new Set());
  }, [activeServiceId]);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = size;
    const viewExtent = Math.max(width, height, getRadiusForDepth(6) * 2 + VIEWBOX_PADDING);

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [(-viewExtent) / 2, (-viewExtent) / 2, viewExtent, viewExtent].join(' '))
      .style('background', 'none');

    if (!filteredFolders.length) {
      return;
    }

    const hierarchyRoot = buildHierarchy(filteredFolders) as unknown as d3.HierarchyNode<any>;
    const integrationNode = hierarchyRoot.children?.[0];

    if (!integrationNode) {
      return;
    }

    const rootData = integrationNode.data;
    const rootFolderItem: FolderItem | undefined = rootData?.item;
    const resolvedRootService = rootFolderItem
      ? resolveServiceId(rootFolderItem, activeServiceId ?? undefined)
      : activeServiceId;
    const fallbackServiceId = resolvedRootService ?? activeServiceId ?? undefined;
    const rootServiceDetails = resolvedRootService ? SERVICE_DETAILS[resolvedRootService] : undefined;

    const fullRoot = d3.hierarchy(rootData);

    const layoutRoot = d3.hierarchy(rootData);
    layoutRoot.eachBefore(node => {
      const nodeId = getNodeIdentifier(node);
      if (!nodeId) {
        return;
      }

      const isRootNode = node.depth === 0;
      const hasChildren = Array.isArray(node.data?.children) && node.data.children.length > 0;

      if (!hasChildren) {
        return;
      }

      const shouldExpand = expandedNodes.has(nodeId);

      if (!isRootNode) {
        const parentId = node.parent ? getNodeIdentifier(node.parent) : null;
        if (parentId && !expandedNodes.has(parentId)) {
          node.children = undefined;
          return;
        }
      }

      if (!shouldExpand) {
        node.children = undefined;
      }
    });

    const nodeStyles = computeNodeStyles(fullRoot as any, colorPaletteId);

    const descendants = layoutRoot.descendants();
    const maxDepth = d3.max(descendants, node => node.depth) ?? 1;

    const treeLayout = d3.tree<any>();
    treeLayout.size([Math.PI * 2, Math.max(1, maxDepth)]);
    treeLayout.separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth));

    const positionedRoot = treeLayout(layoutRoot) as d3.HierarchyPointNode<any>;

    positionedRoot.each(node => {
      node.y = getRadiusForDepth(node.depth);
    });

    const radialLink = d3
      .linkRadial<d3.HierarchyPointLink<any>, d3.HierarchyPointNode<any>>()
      .angle(d => d.x)
      .radius(d => d.y);

    const g = svg.append('g');

    g.append('g')
      .attr('class', 'radial-links')
      .attr('fill', 'none')
      .attr('stroke', '#CBD5E1')
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.6)
      .selectAll('path')
      .data(positionedRoot.links())
      .join('path')
      .attr('d', d => radialLink(d as any) ?? '')
      .attr('stroke-linecap', 'round');

    const nodes = positionedRoot.descendants();

    const nodeGroups = g
      .append('g')
      .attr('class', 'radial-nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', node => {
        const angle = node.x - Math.PI / 2;
        const x = node.y * Math.cos(angle);
        const y = node.y * Math.sin(angle);
        return `translate(${x},${y})`;
      })
      .style('cursor', 'pointer');

    nodeGroups.append('title').text(node => node.data?.name ?? 'Folder');

    nodeGroups
      .append('circle')
      .attr('class', 'radial-node-circle')
      .attr('r', node => getNodeRadius(Math.min(node.depth, 3)))
      .attr('fill', node => {
        if (node.depth === 0) {
          return '#FFFFFF';
        }
        const style = nodeStyles.get(getNodeId(node as any));
        const folderItem: FolderItem | undefined = node.data?.item;
        const resolved = folderItem
          ? resolveServiceId(folderItem, fallbackServiceId)
          : fallbackServiceId;
        const details = resolved ? SERVICE_DETAILS[resolved] : undefined;
        return style?.fill ?? details?.fill ?? '#E2E8F0';
      })
      .attr('stroke', node => {
        const folderItem: FolderItem | undefined = node.data?.item;
        const resolved = folderItem
          ? resolveServiceId(folderItem, fallbackServiceId)
          : fallbackServiceId;
        const details = resolved ? SERVICE_DETAILS[resolved] : undefined;
        if (node.depth === 0) {
          return details?.stroke ?? rootServiceDetails?.stroke ?? '#0F172A';
        }
        return details?.stroke ?? '#1F2937';
      })
      .attr('stroke-width', node => (node.depth === 0 ? 3 : 1.6))
      .attr('opacity', node => (node.data?.item?.isSelected === false ? 0.3 : 1));

    nodeGroups
      .append('image')
      .filter(node => node.depth === 0)
      .attr('class', 'radial-node-logo')
      .attr('href', () => rootServiceDetails?.logo ?? '')
      .attr('width', node => getNodeRadius(Math.min(node.depth, 3)) * 1.3)
      .attr('height', node => getNodeRadius(Math.min(node.depth, 3)) * 1.3)
      .attr('x', node => -getNodeRadius(Math.min(node.depth, 3)) * 0.65)
      .attr('y', node => -getNodeRadius(Math.min(node.depth, 3)) * 0.65)
      .style('pointer-events', 'none');

    nodeGroups
      .filter(node => node.depth === 0)
      .append('text')
      .attr('class', 'radial-node-root-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')
      .attr('dy', getNodeRadius(0) + 12)
      .attr('fill', rootServiceDetails?.stroke ?? '#0F172A')
      .attr('font-weight', '600')
      .attr('font-size', 14)
      .attr('pointer-events', 'none')
      .text(node => node.data?.name ?? '');

    nodeGroups
      .filter(node => node.depth > 0)
      .append('text')
      .each(function (node) {
        const selection = d3.select(this);
        const style = nodeStyles.get(getNodeId(node as any));
        const folderItem: FolderItem | undefined = node.data?.item;
        const resolved = folderItem
          ? resolveServiceId(folderItem, fallbackServiceId)
          : fallbackServiceId;
        const details = resolved ? SERVICE_DETAILS[resolved] : undefined;
        const textColor = style?.textColor ?? details?.stroke ?? '#0F172A';
        const radius = getNodeRadius(Math.min(node.depth, 3));
        ensureLabelFits(selection, node.data?.name ?? 'Folder', radius, textColor);
      });

    nodeGroups
      .on('click', (event, node) => {
        if (event.detail > 1) {
          return;
        }
        if (!node?.data?.id || !node.data?.item) {
          return;
        }
        const isSelected = node.data.item.isSelected !== false;
        onFolderSelectionChange?.(node.data.id, !isSelected);
      })
      .on('dblclick', (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        const nodeId = getNodeIdentifier(node);
        const hasChildData = Array.isArray(node.data?.children) && node.data.children.length > 0;
        if (!nodeId || !hasChildData) {
          return;
        }
        setExpandedNodes(prev => {
          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return next;
        });
      });
  }, [
    filteredFolders,
    size,
    onFolderSelectionChange,
    activeServiceId,
    colorPaletteId,
    expandedNodes,
  ]);

  const showEmptyState = filteredFolders.length === 0;

  return (
    <div
      ref={containerRef}
      className="relative pt-28"
      style={{ minWidth: `${MIN_WIDTH}px`, minHeight: `${MIN_HEIGHT}px` }}
    >
      <IntegrationFilter
        services={availableServices}
        activeServiceId={activeServiceId}
        onServiceSelect={serviceId => setActiveServiceId(serviceId)}
      />
      <svg ref={svgRef} className="w-full h-full" />
      {showEmptyState && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
          No folders available for the selected integration.
        </div>
      )}
    </div>
  );
};
