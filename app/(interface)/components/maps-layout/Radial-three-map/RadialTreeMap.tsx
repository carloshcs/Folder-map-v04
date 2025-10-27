'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import { MIN_HEIGHT, MIN_WIDTH } from '../orbital-map/constants';
import { buildHierarchy } from '../orbital-map/hierarchy';
import { FolderItem } from '../orbital-map/types';
import { isServiceId, ServiceId } from '@/app/(interface)/components/right-sidebar/data';
import { IntegrationFilter, IntegrationService } from '@/app/(interface)/components/IntegrationFilter';

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

export const RadialTreeMap: React.FC<RadialTreeMapProps> = ({
  folders,
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
    const layoutRoot = hierarchyRoot.copy();
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
        const angle = (node.x * 180) / Math.PI - 90;
        return `rotate(${angle}) translate(${node.y},0)`;
      });

    nodeGroups
      .append('circle')
      .attr('r', node => (node.depth === 0 ? 20 : 10))
      .attr('fill', node => {
        if (node.depth === 0) {
          return '#0F172A';
        }
        const folderItem: FolderItem | undefined = node.data?.item;
        const resolved = folderItem ? resolveServiceId(folderItem, activeServiceId ?? undefined) : undefined;
        const details = resolved ? SERVICE_DETAILS[resolved] : undefined;
        return details?.fill ?? '#E2E8F0';
      })
      .attr('stroke', node => {
        if (node.depth === 0) {
          return '#1E293B';
        }
        const folderItem: FolderItem | undefined = node.data?.item;
        const resolved = folderItem ? resolveServiceId(folderItem, activeServiceId ?? undefined) : undefined;
        const details = resolved ? SERVICE_DETAILS[resolved] : undefined;
        return details?.stroke ?? '#94A3B8';
      })
      .attr('stroke-width', node => (node.depth === 0 ? 3 : 1.6))
      .attr('opacity', node => (node.data?.item?.isSelected === false ? 0.3 : 0.95))
      .on('click', (_event, node) => {
        if (!node?.data?.id || !node.data?.item) {
          return;
        }
        const isSelected = node.data.item.isSelected !== false;
        onFolderSelectionChange?.(node.data.id, !isSelected);
      })
      .append('title')
      .text(node => node.data?.name ?? 'Folder');

    nodeGroups
      .append('text')
      .attr('dy', '0.32em')
      .attr('x', node => (node.x < Math.PI ? 14 : -14))
      .attr('text-anchor', node => (node.x < Math.PI ? 'start' : 'end'))
      .attr('transform', node => (node.x >= Math.PI ? 'rotate(180)' : null))
      .attr('fill', '#0F172A')
      .attr('font-size', 12)
      .attr('font-weight', node => (node.depth === 1 ? '600' : '400'))
      .attr('opacity', node => (node.data?.item?.isSelected === false ? 0.35 : 0.9))
      .text(node => node.data?.name ?? 'Folder');
  }, [filteredFolders, size, onFolderSelectionChange, activeServiceId]);

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
