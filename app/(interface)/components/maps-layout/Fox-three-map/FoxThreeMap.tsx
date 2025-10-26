'use client';

import Image from 'next/image';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

import ReactFlow, { Edge, Node, XYPosition } from 'reactflow';

import { FolderItem, ServiceId, isServiceId } from '../../right-sidebar/data';

interface FoxThreeMapProps {
  folders: FolderItem[];
}

interface FoxTreeNode {
  id: string;
  name: string;
  item?: FolderItem;
  children?: FoxTreeNode[];
  pathSegments: string[];
  serviceName?: string;
  serviceId?: ServiceId;
}

interface FoxNodeData {
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
}

interface HoveredNodeInfo {
  id: string;
  name: string;
  position: { x: number; y: number };
  pathSegments: string[];
  metrics?: FolderItem['metrics'];
  link?: string;
  createdDate?: string;
  modifiedDate?: string;
  activityScore?: number;
  serviceName?: string;
  childrenCount: number;
  depth: number;
  serviceId?: ServiceId;
}

const INTEGRATION_NAMES = new Set(['Google Drive', 'Dropbox', 'OneDrive', 'Notion']);
const NODE_WIDTH = 260;
const NODE_HEIGHT = 136;
const HORIZONTAL_GAP = 280;
const VERTICAL_GAP = 210;
const SNAP_SIZE = 24;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MARGIN = 16;
const DEFAULT_MAX_DEPTH = 3;

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

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();

const resolveServiceId = (folder: FolderItem, fallback?: ServiceId): ServiceId | undefined => {
  if (folder.serviceId && isServiceId(folder.serviceId)) {
    return folder.serviceId;
  }

  if (isServiceId(folder.id)) {
    return folder.id;
  }

  return fallback;
};

const buildFoxTree = (folders: FolderItem[]): FoxTreeNode => {
  const mapChildren = (
    folder: FolderItem,
    lineage: string[],
    serviceId: ServiceId | undefined,
  ): FoxTreeNode => {
    const resolvedServiceId = resolveServiceId(folder, serviceId);
    const node: FoxTreeNode = {
      id: `${lineage.join('__')}__${sanitizeId(folder.id ?? folder.name)}`,
      name: folder.name,
      item: folder,
      pathSegments: [...lineage, folder.name],
      serviceName: lineage[1],
      serviceId: resolvedServiceId,
    };

    if (folder.children && folder.children.length > 0) {
      node.children = folder.children.map(child =>
        mapChildren(child, [...lineage, folder.name], resolvedServiceId),
      );
    }

    return node;
  };

  const integrationNodes = folders
    .filter(folder => INTEGRATION_NAMES.has(folder.name))
    .map(folder => mapChildren(folder, ['Fox'], resolveServiceId(folder)))
    .filter(node => (node.children?.length ?? 0) > 0);

  return {
    id: 'fox-root',
    name: 'Fox',
    pathSegments: ['Fox'],
    children: integrationNodes,
  };
};

const createFlowLayout = (tree: FoxTreeNode) => {
  const hierarchy = d3.hierarchy(tree, node => node.children ?? []);
  const layout = d3
    .tree<FoxTreeNode>()
    .nodeSize([HORIZONTAL_GAP, VERTICAL_GAP])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.4));

  const root = layout(hierarchy);
  const xValues = root.descendants().map(node => node.x);
  const minX = Math.min(...xValues);
  const offsetX = Math.abs(minX) + 80;

  const nodes: Array<Node<FoxNodeData>> = root.descendants().map(node => {
    const dataNode = node.data;
    const item = dataNode.item;

    return {
      id: dataNode.id,
      type: 'fox-folder',
      position: {
        x: node.x + offsetX,
        y: node.depth * VERTICAL_GAP + 32,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: {
        label: dataNode.name,
        depth: node.depth,
        metrics: item?.metrics,
        link: item?.link,
        createdDate: item?.createdDate,
        modifiedDate: item?.modifiedDate,
        activityScore: item?.activityScore,
        pathSegments: dataNode.pathSegments,
        serviceName: dataNode.serviceName ?? (node.depth === 1 ? dataNode.name : undefined),
        childrenCount: dataNode.children?.length ?? 0,
        serviceId: dataNode.serviceId,
      },
    };
  });

  const edges: Edge[] = root.links().map(link => ({
    id: `${link.source.data.id}__${link.target.data.id}`,
    source: link.source.data.id,
    target: link.target.data.id,
    animated: true,
  }));

  return { nodes, edges };
};

const snapPosition = (value: number) => Math.round(value / SNAP_SIZE) * SNAP_SIZE;

const formatPath = (segments: string[]) =>
  segments.length <= 1 ? 'Root' : segments.join(' / ');

const formatSize = (value?: number) => {
  if (!value || Number.isNaN(value)) return '--';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const FoxThreeNode: React.FC<{ data: FoxNodeData; dragging: boolean }> = ({
  data,
  dragging,
}) => (
  <div
    className={`flex h-full w-full flex-col rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_12px_30px_rgba(111,125,255,0.12)] transition-transform duration-300 ${
      dragging ? 'scale-[1.02] shadow-[0_16px_40px_rgba(111,125,255,0.18)]' : 'group-hover:scale-[1.01]'
    }`}
    style={{
      boxShadow:
        '0 12px 24px rgba(111, 125, 255, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(12px)',
    }}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-300">
          {data.depth === 0 ? 'Root Space' : data.serviceName ?? 'Folder'}
        </p>
        <p className="mt-1 text-lg font-semibold text-slate-800">{data.label}</p>
      </div>
      <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-600">
        {data.childrenCount} {data.childrenCount === 1 ? 'child' : 'items'}
      </span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500">
      <div>
        <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-400">Files</p>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {data.metrics?.fileCount ?? '--'}
        </p>
      </div>
      <div>
        <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-400">Folders</p>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {data.metrics?.folderCount ?? '--'}
        </p>
      </div>
      <div>
        <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-400">Size</p>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {formatSize(data.metrics?.totalSize)}
        </p>
      </div>
    </div>
  </div>
);

const FoxTooltip: React.FC<{
  node: HoveredNodeInfo;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isDetailsExpanded: boolean;
  onToggleDetails: () => void;
  isNodeExpanded: boolean;
  onToggleNodeExpansion: () => void;
  containerRect: DOMRect | null;
}> = ({
  node,
  onHoverStart,
  onHoverEnd,
  isDetailsExpanded,
  onToggleDetails,
  isNodeExpanded,
  onToggleNodeExpansion,
  containerRect,
}) => {
  const containerWidth = containerRect?.width ?? 0;
  const left = Math.min(
    Math.max(node.position.x - TOOLTIP_WIDTH / 2, TOOLTIP_MARGIN),
    Math.max(TOOLTIP_MARGIN, containerWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN),
  );
  const top = Math.max(node.position.y - TOOLTIP_MARGIN, TOOLTIP_MARGIN);
  const location = formatPath(node.pathSegments);
  const showDetails = Boolean(node.metrics || node.activityScore || node.createdDate || node.modifiedDate);

  return (
    <div
      className="pointer-events-auto absolute z-50 w-full max-w-[320px] text-sm"
      style={{ left, top, width: TOOLTIP_WIDTH }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-sm">
        <div className="border-b border-neutral-200 bg-white/70 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg leading-none">📁</span>
                <p className="truncate text-base font-semibold text-slate-900">{node.name}</p>
              </div>
              {node.serviceName && (
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                  {node.serviceName}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {node.link && (
                <a
                  href={node.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {node.childrenCount > 0 && (
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleNodeExpansion();
                  }}
                >
                  {isNodeExpanded ? 'Collapse' : 'Expand'}
                  {isNodeExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-200 px-5 py-3 text-xs leading-relaxed text-slate-600">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Location</p>
          <p className="mt-1 break-words text-sm text-slate-700">{location}</p>
        </div>

        {showDetails && (
          <div className="px-5 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl bg-slate-100/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onToggleDetails();
              }}
            >
              <span>Details</span>
              {isDetailsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {isDetailsExpanded && (
              <div className="mt-3 space-y-3 rounded-2xl border border-neutral-200/70 bg-white/90 px-4 py-4 text-[12px] text-slate-600">
                {node.metrics && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Files</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {node.metrics.fileCount ?? '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Folders</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {node.metrics.folderCount ?? '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Size</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {formatSize(node.metrics.totalSize)}
                      </p>
                    </div>
                  </div>
                )}
                {(node.createdDate || node.modifiedDate) && (
                  <div className="flex flex-col gap-2">
                    {node.createdDate && (
                      <p>
                        <span className="font-semibold text-slate-500">Created:</span> {node.createdDate}
                      </p>
                    )}
                    {node.modifiedDate && (
                      <p>
                        <span className="font-semibold text-slate-500">Updated:</span> {node.modifiedDate}
                      </p>
                    )}
                  </div>
                )}
                {typeof node.activityScore === 'number' && (
                  <p>
                    <span className="font-semibold text-slate-500">Activity Score:</span> {node.activityScore}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const FoxThreeMap: React.FC<FoxThreeMapProps> = ({ folders }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [flowNodes, setFlowNodes] = useState<Array<Node<FoxNodeData>>>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [expandedState, setExpandedState] = useState<Map<string, boolean>>(new Map());
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(null);
  const hideTimeoutRef = useRef<number>();

  const tree = useMemo(() => buildFoxTree(folders), [folders]);
  const availableServices = useMemo(() => {
    const services: Array<{ id: ServiceId; name: string; logo: string; accent: string; hover: string; border: string }> = [];

    tree.children?.forEach(child => {
      if (!child.serviceId) {
        return;
      }

      if ((child.children?.length ?? 0) === 0) {
        return;
      }

      const details = SERVICE_DETAILS[child.serviceId];
      services.push({ id: child.serviceId, ...details });
    });

    return services;
  }, [tree]);

  useEffect(() => {
    if (activeServiceId && !availableServices.some(service => service.id === activeServiceId)) {
      setActiveServiceId(null);
    }
  }, [activeServiceId, availableServices]);

  const filteredTree = useMemo(() => {
    if (!activeServiceId) {
      return tree;
    }

    return {
      ...tree,
      children: tree.children?.filter(child => child.serviceId === activeServiceId) ?? [],
    };
  }, [tree, activeServiceId]);

  const layout = useMemo(() => createFlowLayout(filteredTree), [filteredTree]);

  useEffect(() => {
    setFlowEdges(layout.edges);
    setFlowNodes(prevNodes => {
      if (prevNodes.length === 0) {
        return layout.nodes;
      }
      const previousById = new Map(prevNodes.map(node => [node.id, node]));
      return layout.nodes.map(node => {
        const previous = previousById.get(node.id);
        return previous ? { ...node, position: previous.position } : node;
      });
    });
  }, [layout]);

  useEffect(() => {
    setExpandedState(prevState => {
      const nextState = new Map(prevState);
      const encountered = new Set<string>();

      const traverse = (node: FoxTreeNode, depth: number) => {
        if (node.children && node.children.length > 0) {
          const defaultExpanded = depth < DEFAULT_MAX_DEPTH;
          if (!nextState.has(node.id)) {
            nextState.set(node.id, defaultExpanded);
          }
          encountered.add(node.id);
          node.children.forEach(child => traverse(child, depth + 1));
        }
      };

      traverse(filteredTree, 0);

      Array.from(nextState.keys()).forEach(key => {
        if (!encountered.has(key)) {
          nextState.delete(key);
        }
      });

      return nextState;
    });
  }, [filteredTree]);

  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    const observer = new ResizeObserver(updateRect);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, []);

  const scheduleHideTooltip = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setHoveredNode(null);
      setIsDetailsExpanded(false);
    }, 220);
  }, [clearHideTimeout]);

  useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  const handleNodeDrag = useCallback((id: string, position?: XYPosition | null) => {
    if (!position) {
      return;
    }

    setFlowNodes(nodes =>
      nodes.map(node => (node.id === id ? { ...node, position } : node)),
    );
  }, []);

  const handleNodeDragStop = useCallback((id: string, position?: XYPosition | null) => {
    if (!position) {
      return;
    }

    const snapped = { x: snapPosition(position.x), y: snapPosition(position.y) };
    setFlowNodes(nodes =>
      nodes.map(node => (node.id === id ? { ...node, position: snapped } : node)),
    );
  }, []);

  const handleNodeEnter = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, node: Node<FoxNodeData>) => {
      if (draggingId) return;
      clearHideTimeout();
      setIsDetailsExpanded(false);

      const container = containerRef.current;
      const nodeRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const containerBounds = container?.getBoundingClientRect();
      const x = containerBounds
        ? nodeRect.left - containerBounds.left + nodeRect.width / 2
        : nodeRect.left + nodeRect.width / 2;
      const y = containerBounds ? nodeRect.top - containerBounds.top : nodeRect.top;

      const data = node.data;
      setHoveredNode({
        id: node.id,
        name: data.label,
        position: { x, y },
        pathSegments: data.pathSegments,
        metrics: data.metrics,
        link: data.link,
        createdDate: data.createdDate,
        modifiedDate: data.modifiedDate,
        activityScore: data.activityScore,
        serviceName: data.serviceName,
        childrenCount: data.childrenCount,
        depth: data.depth,
        serviceId: data.serviceId,
      });
    },
    [clearHideTimeout, draggingId],
  );

  const visibleNodeIds = useMemo(() => {
    const visible = new Set<string>();

    const traverse = (node: FoxTreeNode, depth: number) => {
      visible.add(node.id);

      if (!node.children || node.children.length === 0) {
        return;
      }

      const explicit = expandedState.get(node.id);
      const isExpanded = explicit !== undefined ? explicit : depth < DEFAULT_MAX_DEPTH;

      if (!isExpanded) {
        return;
      }

      node.children.forEach(child => traverse(child, depth + 1));
    };

    traverse(filteredTree, 0);

    return visible;
  }, [filteredTree, expandedState]);

  const nodesToRender = useMemo(
    () => flowNodes.filter(node => visibleNodeIds.has(node.id)),
    [flowNodes, visibleNodeIds],
  );

  const edgesToRender = useMemo(
    () => flowEdges.filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [flowEdges, visibleNodeIds],
  );

  const toggleNodeExpansionById = useCallback(
    (nodeId: string, depth: number, childrenCount: number) => {
      if (childrenCount <= 0) {
        return;
      }

      setExpandedState(prev => {
        const next = new Map(prev);
        const current = next.has(nodeId)
          ? next.get(nodeId)!
          : depth < DEFAULT_MAX_DEPTH;
        next.set(nodeId, !current);
        return next;
      });
    },
    [],
  );

  const getIsNodeExpanded = useCallback(
    (nodeId: string, depth: number, childrenCount: number) => {
      if (childrenCount <= 0) {
        return false;
      }

      const value = expandedState.get(nodeId);
      if (value !== undefined) {
        return value;
      }

      return depth < DEFAULT_MAX_DEPTH;
    },
    [expandedState],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-[720px] min-w-[960px] pt-16">
      {availableServices.length > 0 && (
        <div className="pointer-events-auto absolute left-0 top-0 z-20 flex flex-wrap gap-2 px-6 py-4">
          {availableServices.map(service => {
            const isActive = activeServiceId === service.id;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() =>
                  setActiveServiceId(current => (current === service.id ? null : service.id))
                }
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-slate-700 transition ${
                  isActive
                    ? 'bg-white/90 shadow-[0_12px_24px_rgba(15,23,42,0.12)] border-indigo-300'
                    : `${service.accent} ${service.hover} ${service.border}`
                }`}
              >
                <span className="relative h-6 w-6 overflow-hidden rounded-full bg-white/80">
                  <Image src={service.logo} alt={`${service.name} logo`} fill sizes="24px" />
                </span>
                <span>{service.name}</span>
              </button>
            );
          })}
        </div>
      )}
      <ReactFlow
        nodes={nodesToRender}
        edges={edgesToRender}
        nodeTypes={{
          'fox-folder': ({ data, dragging }) => (
            <FoxThreeNode data={data as FoxNodeData} dragging={dragging} />
          ),
        }}
        className="bg-transparent"
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        selectionOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        onNodeDragStart={(_, node) => {
          setDraggingId(node.id);
          setHoveredNode(null);
          clearHideTimeout();
        }}
        onNodeDrag={(_, node) => handleNodeDrag(node.id, node.position)}
        onNodeDragStop={(_, node) => {
          setDraggingId(null);
          handleNodeDragStop(node.id, node.position);
        }}
        onNodeMouseEnter={(event, node) => handleNodeEnter(event, node as Node<FoxNodeData>)}
        onNodeMouseLeave={() => {
          if (draggingId) return;
          scheduleHideTooltip();
        }}
        onNodeDoubleClick={(_, node) => {
          const typedNode = node as Node<FoxNodeData>;
          toggleNodeExpansionById(
            typedNode.id,
            typedNode.data.depth,
            typedNode.data.childrenCount,
          );
        }}
      />

      {hoveredNode && (
        <FoxTooltip
          node={hoveredNode}
          onHoverStart={clearHideTimeout}
          onHoverEnd={scheduleHideTooltip}
          isDetailsExpanded={isDetailsExpanded}
          onToggleDetails={() => setIsDetailsExpanded(value => !value)}
          isNodeExpanded={getIsNodeExpanded(
            hoveredNode.id,
            hoveredNode.depth,
            hoveredNode.childrenCount,
          )}
          onToggleNodeExpansion={() =>
            toggleNodeExpansionById(
              hoveredNode.id,
              hoveredNode.depth,
              hoveredNode.childrenCount,
            )
          }
          containerRect={containerRect}
        />
      )}
    </div>
  );
};

export default FoxThreeMap;
