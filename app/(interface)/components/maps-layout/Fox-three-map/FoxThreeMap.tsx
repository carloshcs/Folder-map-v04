'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

import ReactFlow, { Background, Edge, Node } from 'reactflow';

import { FolderItem } from '../../right-sidebar/data';

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
}

const INTEGRATION_NAMES = new Set(['Google Drive', 'Dropbox', 'OneDrive', 'Notion']);
const NODE_WIDTH = 260;
const NODE_HEIGHT = 136;
const HORIZONTAL_GAP = 280;
const VERTICAL_GAP = 210;
const SNAP_SIZE = 24;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MARGIN = 16;

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();

const buildFoxTree = (folders: FolderItem[]): FoxTreeNode => {
  const mapChildren = (folder: FolderItem, lineage: string[]): FoxTreeNode => {
    const node: FoxTreeNode = {
      id: `${lineage.join('__')}__${sanitizeId(folder.id ?? folder.name)}`,
      name: folder.name,
      item: folder,
      pathSegments: [...lineage, folder.name],
      serviceName: lineage[1],
    };

    if (folder.children && folder.children.length > 0) {
      node.children = folder.children.map(child =>
        mapChildren(child, [...lineage, folder.name]),
      );
    }

    return node;
  };

  const integrationNodes = folders
    .filter(folder => INTEGRATION_NAMES.has(folder.name))
    .map(folder => mapChildren(folder, ['Fox']));

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
  isExpanded: boolean;
  onToggleExpanded: () => void;
  containerRect: DOMRect | null;
}> = ({ node, onHoverStart, onHoverEnd, isExpanded, onToggleExpanded, containerRect }) => {
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
                    onToggleExpanded();
                  }}
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                  {isExpanded ? (
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
                onToggleExpanded();
              }}
            >
              <span>Details</span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {isExpanded && (
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
  const [isTooltipExpanded, setIsTooltipExpanded] = useState(false);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const hideTimeoutRef = useRef<number>();

  const tree = useMemo(() => buildFoxTree(folders), [folders]);
  const layout = useMemo(() => createFlowLayout(tree), [tree]);

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
      setIsTooltipExpanded(false);
    }, 220);
  }, [clearHideTimeout]);

  useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  const handleNodeDrag = useCallback((id: string, position: { x: number; y: number }) => {
    setFlowNodes(nodes =>
      nodes.map(node => (node.id === id ? { ...node, position } : node)),
    );
  }, []);

  const handleNodeDragStop = useCallback((id: string, position: { x: number; y: number }) => {
    const snapped = { x: snapPosition(position.x), y: snapPosition(position.y) };
    setFlowNodes(nodes =>
      nodes.map(node => (node.id === id ? { ...node, position: snapped } : node)),
    );
  }, []);

  const handleNodeEnter = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, node: Node<FoxNodeData>) => {
      if (draggingId) return;
      clearHideTimeout();
      setIsTooltipExpanded(false);

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
      });
    },
    [clearHideTimeout, draggingId],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-[720px] min-w-[960px]">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={{
          'fox-folder': ({ data, dragging }) => (
            <FoxThreeNode data={data as FoxNodeData} dragging={dragging} />
          ),
        }}
        onNodeDragStart={id => {
          setDraggingId(id);
          setHoveredNode(null);
          clearHideTimeout();
        }}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={(id, position) => {
          setDraggingId(null);
          handleNodeDragStop(id, position);
        }}
        onNodeMouseEnter={(event, node) => handleNodeEnter(event, node as Node<FoxNodeData>)}
        onNodeMouseLeave={() => {
          if (draggingId) return;
          scheduleHideTooltip();
        }}
      >
        <Background />
      </ReactFlow>

      {hoveredNode && (
        <FoxTooltip
          node={hoveredNode}
          onHoverStart={clearHideTimeout}
          onHoverEnd={scheduleHideTooltip}
          isExpanded={isTooltipExpanded}
          onToggleExpanded={() => setIsTooltipExpanded(value => !value)}
          containerRect={containerRect}
        />
      )}
    </div>
  );
};

export default FoxThreeMap;
