'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import { MIN_HEIGHT, MIN_WIDTH } from '../orbital-map/constants';
import { buildHierarchy } from '../orbital-map/hierarchy';
import { FolderItem } from '../orbital-map/types';
import { isServiceId, ServiceId } from '@/app/(interface)/components/right-sidebar/data';
import { IntegrationFilter, IntegrationService } from '@/app/(interface)/components/IntegrationFilter';
import { getNodeRadius } from '../orbital-map/geometry';
import { computeNodeStyles, DIMMED_FILL_LIGHTEN } from '../utils/styles';
import { getNodeId } from '../orbital-map/nodeUtils';
import { shiftColor } from '@/app/(interface)/lib/utils/colors';

const LEVEL_RADII: Record<number, number> = {
  1: 240,
  2: 480,
  3: 720,
};

const RADIAL_SPACING = 220;
const INFINITE_CANVAS_PADDING = 4800;

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
  size: number,
  textColor: string,
) => {
  const maxWidth = size * 0.9;
  let fontSize = Math.max(8, Math.min(16, size * 0.25));

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
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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

    if (!filteredFolders.length) {
      svg.selectAll('*').remove();
      svg
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [(-width) / 2, (-height) / 2, width, height].join(' '))
        .style('background', 'none')
        .style('overflow', 'visible');
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

    const styledRoot = d3.hierarchy({ name: '__radial-root__', children: [rootData] });
    const nodeStyles = computeNodeStyles(styledRoot as any, colorPaletteId);
    const nodeLabelCache = new Map<string, { text: string; color: string }>();

    const descendants = layoutRoot.descendants();
    const maxDepth = d3.max(descendants, node => node.depth) ?? 1;
    const maxRadius = getRadiusForDepth(maxDepth + 2);
    const viewExtent = Math.max(width, height, maxRadius * 2 + INFINITE_CANVAS_PADDING);

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [(-viewExtent) / 2, (-viewExtent) / 2, viewExtent, viewExtent].join(' '))
      .style('background', 'none')
      .style('overflow', 'visible');

    const treeLayout = d3.tree<any>();
    treeLayout
      .size([Math.PI * 2, Math.max(1, maxDepth)])
      .separation((a, b) => {
        const depth = Math.max(1, Math.min(a.depth, b.depth));
        const sameParent = a.parent === b.parent;
        return (sameParent ? 1.6 : 2.8) / depth;
      });

    const positionedRoot = treeLayout(layoutRoot) as d3.HierarchyPointNode<any>;

    positionedRoot.each(node => {
      node.y = getRadiusForDepth(node.depth);
    });

    const getNodeHalfSize = (node: d3.HierarchyPointNode<any>) => {
      const baseRadius = getNodeRadius(Math.min(node.depth, 3));
      return node.depth === 0 ? baseRadius * 1.12 : baseRadius;
    };

    const getNodeSize = (node: d3.HierarchyPointNode<any>) => getNodeHalfSize(node) * 2;

    const radialLink = d3
      .linkRadial<d3.HierarchyPointLink<any>, d3.HierarchyPointNode<any>>()
      .angle(d => d.x)
      .radius(d => d.y);

    svg.on('.zoom', null);

    const g = svg.append('g');

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, 2.4])
      .on('zoom', event => {
        zoomTransformRef.current = event.transform;
        g.attr('transform', event.transform.toString());
      });

    zoomBehaviorRef.current = zoomBehavior;

    svg.call(zoomBehavior as any);
    svg.on('dblclick.zoom', null);
    svg.call(zoomBehavior.transform, zoomTransformRef.current);

    const centerOnRoot = () => {
      if (!zoomBehaviorRef.current || !svgRef.current) {
        return;
      }
      const currentScale = zoomTransformRef.current?.k ?? 1;
      const targetTransform = d3.zoomIdentity.scale(currentScale);
      d3.select(svgRef.current)
        .transition()
        .duration(450)
        .call(zoomBehaviorRef.current.transform, targetTransform);
    };

    const linkSelection = g
      .append('g')
      .attr('class', 'radial-links')
      .attr('fill', 'none')
      .attr('stroke', '#CBD5E1')
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.6)
      .selectAll<SVGPathElement, d3.HierarchyPointLink<any>>('path')
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
      .append('rect')
      .attr('class', 'radial-node-rect')
      .attr('width', node => getNodeSize(node))
      .attr('height', node => getNodeSize(node))
      .attr('x', node => -getNodeHalfSize(node))
      .attr('y', node => -getNodeHalfSize(node))
      .attr('rx', node => Math.max(12, getNodeHalfSize(node) * 0.35))
      .attr('ry', node => Math.max(12, getNodeHalfSize(node) * 0.35))
      .each(function (node) {
        const rect = d3.select(this);
        const folderItem: FolderItem | undefined = node.data?.item;
        const resolved = folderItem
          ? resolveServiceId(folderItem, fallbackServiceId)
          : fallbackServiceId;
        const details = resolved ? SERVICE_DETAILS[resolved] : undefined;
        const style = nodeStyles.get(getNodeId(node as any));

        let fill = '#E2E8F0';
        if (node.depth === 0) {
          fill = details?.fill ?? rootServiceDetails?.fill ?? '#ffffff';
        } else if (style?.fill) {
          fill = style.fill;
        } else if (details?.fill) {
          fill = details.fill;
        }

        const stroke =
          node.depth === 0
            ? details?.stroke ?? rootServiceDetails?.stroke ?? '#0F172A'
            : details?.stroke ?? '#1F2937';

        rect
          .attr('fill', fill)
          .attr('stroke', stroke)
          .attr('stroke-width', node.depth === 0 ? 3.5 : 1.8)
          .attr('opacity', node.data?.item?.isSelected === false ? 0.3 : 1)
          .attr('data-base-fill', fill)
          .attr('data-dimmed-fill', null);
      });

    nodeGroups
      .append('image')
      .filter(node => node.depth === 0)
      .attr('class', 'radial-node-logo')
      .attr('href', () => rootServiceDetails?.logo ?? '')
      .attr('width', node => getNodeHalfSize(node) * 1.4)
      .attr('height', node => getNodeHalfSize(node) * 1.4)
      .attr('x', node => -getNodeHalfSize(node) * 0.7)
      .attr('y', node => -getNodeHalfSize(node) * 0.7)
      .style('pointer-events', 'none');

    nodeGroups
      .filter(node => node.depth === 0)
      .append('text')
      .attr('class', 'radial-node-root-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')
      .attr('dy', node => getNodeHalfSize(node) + 20)
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
        const size = getNodeSize(node);
        ensureLabelFits(selection, node.data?.name ?? 'Folder', size, textColor);

        const identifier = getNodeIdentifier(node);
        if (identifier) {
          nodeLabelCache.set(identifier, {
            text: selection.text(),
            color: textColor,
          });
        }

        selection.remove();
      });

    const renderToggleIcon = (isExpanded: boolean) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
        <path d="${isExpanded ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}" />
      </svg>`;

    const renderExternalLinkIcon = () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </svg>`;

    const controlContainers = nodeGroups
      .filter(node => node.depth > 0)
      .append('foreignObject')
      .attr('class', 'radial-node-controls')
      .attr('x', node => -getNodeHalfSize(node))
      .attr('y', node => -getNodeHalfSize(node))
      .attr('width', node => getNodeSize(node))
      .attr('height', node => getNodeSize(node))
      .style('overflow', 'visible');

    controlContainers.each(function (node) {
      const container = d3.select(this);
      const nodeId = getNodeIdentifier(node);
      const hasChildren = Array.isArray(node.data?.children) && node.data.children.length > 0;
      const folderItem: FolderItem | undefined = node.data?.item;
      const link = folderItem?.link ?? folderItem?.path ?? null;

      if (!hasChildren && !link) {
        container.remove();
        return;
      }

      const labelDetails = nodeId ? nodeLabelCache.get(nodeId) : undefined;
      const labelText = labelDetails?.text ?? node.data?.name ?? 'Folder';
      const labelColor = labelDetails?.color ?? '#0F172A';

      const wrapper = container
        .append('xhtml:div')
        .attr('class', 'pointer-events-none relative h-full w-full');

      const card = wrapper
        .append('xhtml:div')
        .attr(
          'class',
          'pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-2xl',
        );

      const header = card
        .append('xhtml:div')
        .attr(
          'class',
          'pointer-events-auto flex items-center justify-end gap-1 border-b border-slate-200/70 bg-slate-100/80 px-2 py-1.5 text-slate-500 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300',
        );

      const controlsRow = header.append('xhtml:div').attr('class', 'flex items-center gap-1');

      if (hasChildren && nodeId) {
        const isExpanded = expandedNodes.has(nodeId);
        controlsRow
          .append('xhtml:button')
          .attr('type', 'button')
          .attr('data-control', 'toggle')
          .attr(
            'class',
            'inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-300 hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700/70 dark:hover:text-slate-100',
          )
          .attr('aria-label', `${isExpanded ? 'Collapse' : 'Expand'} ${node.data?.name ?? 'folder'}`)
          .html(renderToggleIcon(isExpanded))
          .on('click', event => {
            event.preventDefault();
            event.stopPropagation();
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
      }

      if (link) {
        controlsRow
          .append('xhtml:a')
          .attr('data-control', 'link')
          .attr('href', link)
          .attr('target', '_blank')
          .attr('rel', 'noreferrer')
          .attr(
            'class',
            'inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-300 hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700/70 dark:hover:text-slate-100',
          )
          .attr('aria-label', `Open ${node.data?.name ?? 'folder'}`)
          .html(renderExternalLinkIcon())
          .on('click', event => {
            event.stopPropagation();
          });
      }

      card
        .append('xhtml:div')
        .attr(
          'class',
          'pointer-events-none flex flex-1 items-center justify-center px-3 py-3 text-center text-[13px] font-medium leading-snug text-slate-700 dark:text-slate-100',
        )
        .append('xhtml:span')
        .attr('class', 'radial-node-name block truncate')
        .style('color', labelColor)
        .attr('title', labelText)
        .text(labelText);
    });

    const nodeById = new Map<string, d3.HierarchyPointNode<any>>();
    nodes.forEach(node => {
      const identifier = getNodeIdentifier(node);
      if (identifier) {
        nodeById.set(identifier, node);
      }
    });

    const highlightNodes = (hoveredId: string | null) => {
      const relatedIds = new Set<string>();

      if (hoveredId) {
        const hoveredNode = nodeById.get(hoveredId);
        if (hoveredNode) {
          const hoveredIdentifier = getNodeIdentifier(hoveredNode);
          if (hoveredIdentifier) {
            relatedIds.add(hoveredIdentifier);
          }
          const parentIdentifier = hoveredNode.parent
            ? getNodeIdentifier(hoveredNode.parent)
            : null;
          if (parentIdentifier) {
            relatedIds.add(parentIdentifier);
          }
          hoveredNode.children?.forEach(child => {
            const childIdentifier = getNodeIdentifier(child as any);
            if (childIdentifier) {
              relatedIds.add(childIdentifier);
            }
          });
        }
      }

      nodeGroups.each(function (node) {
        const selection = d3.select(this);
        const rect = selection.select<SVGRectElement>('rect.radial-node-rect');
        if (rect.empty()) {
          return;
        }
        const baseFill = rect.attr('data-base-fill');
        if (!baseFill) {
          return;
        }
        const nodeIdentifier = getNodeIdentifier(node);
        const label = selection.select<SVGTextElement>('text');
        const htmlLabel = selection
          .select<SVGForeignObjectElement>('foreignObject.radial-node-controls')
          .select<HTMLElement>('.radial-node-name');

        if (!hoveredId || (nodeIdentifier && relatedIds.has(nodeIdentifier))) {
          rect.attr('fill', baseFill);
          if (!label.empty()) {
            label.style('opacity', 1);
          }
          if (!htmlLabel.empty()) {
            htmlLabel.style('opacity', 1);
          }
          return;
        }

        const dimmedFill = rect.attr('data-dimmed-fill') || shiftColor(baseFill, DIMMED_FILL_LIGHTEN);
        rect.attr('fill', dimmedFill).attr('data-dimmed-fill', dimmedFill);
        if (!label.empty()) {
          label.style('opacity', 0.75);
        }
        if (!htmlLabel.empty()) {
          htmlLabel.style('opacity', 0.75);
        }
      });

      linkSelection
        .attr('stroke', d => {
          if (!hoveredId) {
            return '#CBD5E1';
          }
          const sourceId = getNodeIdentifier(d.source as any);
          const targetId = getNodeIdentifier(d.target as any);
          return sourceId === hoveredId || targetId === hoveredId ? '#6366F1' : '#CBD5E1';
        })
        .attr('stroke-width', d => {
          if (!hoveredId) {
            return 1.2;
          }
          const sourceId = getNodeIdentifier(d.source as any);
          const targetId = getNodeIdentifier(d.target as any);
          return sourceId === hoveredId || targetId === hoveredId ? 2.3 : 1.05;
        })
        .attr('opacity', d => {
          if (!hoveredId) {
            return 0.75;
          }
          const sourceId = getNodeIdentifier(d.source as any);
          const targetId = getNodeIdentifier(d.target as any);
          return sourceId === hoveredId || targetId === hoveredId ? 0.95 : 0.45;
        });
    };

    highlightNodes(null);

    nodeGroups
      .on('click', (event, node) => {
        if (event.detail > 1) {
          return;
        }
        if (node.depth === 0) {
          event.preventDefault();
          event.stopPropagation();
          centerOnRoot();
          return;
        }
        if (!node?.data?.id || !node.data?.item) {
          return;
        }
        const isSelected = node.data.item.isSelected !== false;
        onFolderSelectionChange?.(node.data.id, !isSelected);
      })
      .on('mouseenter', (_, node) => {
        const identifier = getNodeIdentifier(node);
        highlightNodes(identifier);
      })
      .on('mouseleave', () => {
        highlightNodes(null);
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

    svg.on('mouseleave', () => {
      highlightNodes(null);
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
      className="relative h-full w-full"
      style={{ minWidth: `${MIN_WIDTH}px`, minHeight: `${MIN_HEIGHT}px` }}
    >
      <IntegrationFilter
        services={availableServices}
        activeServiceId={activeServiceId}
        onServiceSelect={serviceId => setActiveServiceId(serviceId)}
        mountToBody={false}
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
