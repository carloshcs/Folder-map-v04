'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import ReactFlow, { Edge, Node, XYPosition } from 'reactflow';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Folder as FolderIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  type LucideIcon,
} from 'lucide-react';

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
  isExpanded?: boolean;
  onToggle?: () => void;
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

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.tiff'];
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.mpg',
  '.mpeg',
  '.wmv',
  '.flv',
  '.m4v',
];

const determineNodeIcon = (data: FoxNodeData): LucideIcon => {
  if (data.childrenCount > 0) {
    return FolderIcon;
  }

  const normalized = data.label.toLowerCase();

  if (IMAGE_EXTENSIONS.some(extension => normalized.endsWith(extension))) {
    return ImageIcon;
  }

  if (VIDEO_EXTENSIONS.some(extension => normalized.endsWith(extension))) {
    return VideoIcon;
  }

  return FileText;
};

const FoxThreeNode: React.FC<{ data: FoxNodeData; dragging: boolean }> = ({
  data,
  dragging,
}) => {
  const Icon = determineNodeIcon(data);
  const isExpandable = data.childrenCount > 0;

  return (
    <div
      className={`flex h-full w-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_12px_30px_rgba(111,125,255,0.12)] transition-transform duration-300 ${
        dragging ? 'scale-[1.02] shadow-[0_16px_40px_rgba(111,125,255,0.18)]' : 'group-hover:scale-[1.01]'
      }`}
      style={{
        boxShadow:
          '0 12px 24px rgba(111, 125, 255, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-base font-semibold text-slate-800">{data.label}</p>
        </div>
        {data.link ? (
          <a
            href={data.link}
            target="_blank"
            rel="noreferrer"
            onClick={event => event.stopPropagation()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Open ${data.label}`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : null}
      </div>

      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          data.onToggle?.();
        }}
        disabled={!isExpandable}
        className={`mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium transition ${
          isExpandable
            ? 'text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600'
            : 'cursor-not-allowed text-slate-300'
        }`}
      >
        {data.isExpanded ? (
          <ChevronUp className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden />
        )}
        {isExpandable ? (data.isExpanded ? 'Collapse' : 'Expand') : 'No items'}
      </button>
    </div>
  );
};

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

  const nodesWithControls = useMemo(
    () =>
      nodesToRender.map(node => {
        const typedNode = node as Node<FoxNodeData>;
        const { depth, childrenCount } = typedNode.data;
        const isExpanded = getIsNodeExpanded(node.id, depth, childrenCount);

        return {
          ...typedNode,
          data: {
            ...typedNode.data,
            isExpanded,
            onToggle: () => toggleNodeExpansionById(node.id, depth, childrenCount),
          },
        };
      }),
    [nodesToRender, getIsNodeExpanded, toggleNodeExpansionById],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const reactFlowRoot = container.querySelector('.react-flow');
    if (!reactFlowRoot) {
      return;
    }

    const removeTitleAttributes = () => {
      reactFlowRoot
        .querySelectorAll<HTMLElement>('[title]')
        .forEach(element => element.removeAttribute('title'));
    };

    removeTitleAttributes();

    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'attributes')) {
        removeTitleAttributes();
      }
    });

    observer.observe(reactFlowRoot, {
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
        nodes={nodesWithControls}
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
          typedNode.data.onToggle?.();
        }}
      />
    </div>
  );
};

export default FoxThreeMap;
