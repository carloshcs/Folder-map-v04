'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import ReactFlow, { Edge, Node, XYPosition } from 'reactflow';

import { FolderItem, ServiceId, isServiceId } from '../../right-sidebar/data';
import { IntegrationFilter, IntegrationService } from '@/app/(interface)/components/IntegrationFilter';

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

const INTEGRATION_NAMES = new Set(['Google Drive', 'Dropbox', 'OneDrive', 'Notion']);
const NODE_WIDTH = 260;
const NODE_HEIGHT = 136;
const HORIZONTAL_GAP = 280;
const VERTICAL_GAP = 210;
const SNAP_SIZE = 24;
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

export const FoxThreeMap: React.FC<FoxThreeMapProps> = ({ folders }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [flowNodes, setFlowNodes] = useState<Array<Node<FoxNodeData>>>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [expandedState, setExpandedState] = useState<Map<string, boolean>>(new Map());
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(null);

  const tree = useMemo(() => buildFoxTree(folders), [folders]);
  const availableServices = useMemo<IntegrationService[]>(() => {
    const services: IntegrationService[] = [];

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

  const handleServiceSelect = useCallback((serviceId: ServiceId | null) => {
    setActiveServiceId(current => {
      if (serviceId === null) {
        return null;
      }

      if (current === serviceId) {
        return null;
      }

      return serviceId;
    });
  }, []);

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

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const removeNodeTitles = () => {
      container
        .querySelectorAll<HTMLDivElement>('.react-flow__node[title]')
        .forEach(node => node.removeAttribute('title'));
    };

    removeNodeTitles();

    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'attributes')) {
        removeNodeTitles();
      }
    });

    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title'],
    });

    return () => observer.disconnect();
  }, [nodesToRender]);

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
    <div ref={containerRef} className="fox-three-map relative h-full w-full pt-28">
      <IntegrationFilter
        services={availableServices}
        activeServiceId={activeServiceId}
        onServiceSelect={handleServiceSelect}
        allowClear
      />
      <ReactFlow
        nodes={nodesToRender}
        edges={edgesToRender}
        nodeTypes={{
          'fox-folder': ({ data, dragging }) => (
            <FoxThreeNode data={data as FoxNodeData} dragging={dragging} />
          ),
        }}
        className="bg-transparent"
        style={{ background: 'transparent', overflow: 'visible' }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        selectionOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        onNodeDrag={(_, node) => handleNodeDrag(node.id, node.position)}
        onNodeDragStop={(_, node) => {
          handleNodeDragStop(node.id, node.position);
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
    </div>
  );
};

export default FoxThreeMap;
