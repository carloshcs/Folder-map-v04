import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

type TreeNode = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
};

type PlatformPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface BaseTreeMapProps {
  platformName: string;
  accentColor: string;
  position: PlatformPosition;
  fetchData: () => Promise<TreeNode>;
  className?: string;
}

interface HierarchyTreeMapProps {
  notionLoader: () => Promise<TreeNode>;
  driveLoader: () => Promise<TreeNode>;
  oneDriveLoader: () => Promise<TreeNode>;
  dropboxLoader: () => Promise<TreeNode>;
  className?: string;
}

interface PlatformTreeMapProps {
  fetchData: () => Promise<TreeNode>;
  className?: string;
}

type D3Node = d3.HierarchyPointNode<TreeNode>;
type D3Link = d3.HierarchyPointLink<TreeNode>;

const POSITION_CLASSES: Record<PlatformPosition, string> = {
  'top-left': 'top-0 left-0 w-1/2 h-1/2',
  'top-right': 'top-0 right-0 w-1/2 h-1/2',
  'bottom-left': 'bottom-0 left-0 w-1/2 h-1/2',
  'bottom-right': 'bottom-0 right-0 w-1/2 h-1/2',
};

const FONT_FAMILY = 'Inter, Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const MIN_SIZE = 320;
const MARGIN = { top: 36, right: 56, bottom: 36, left: 56 };
const LINK_COLOR = '#d4d4d8';
const FOLDER_STROKE = '#a1a1aa';
const FILE_FILL = '#94a3b8';
const BACKGROUND_FILL = 'transparent';

const createTreeHierarchy = (root: TreeNode, collapsed: Set<string>) =>
  d3.hierarchy<TreeNode>(root, node => (collapsed.has(node.id) ? null : node.children ?? []));

const useResizeObserver = (ref: React.RefObject<HTMLDivElement>) => {
  const [size, setSize] = useState({ width: MIN_SIZE, height: MIN_SIZE });

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({
        width: Math.max(MIN_SIZE, width),
        height: Math.max(MIN_SIZE, height),
      });
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};

const initializeSvg = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
  svg.selectAll('*').remove();
  svg
    .attr('role', 'img')
    .attr('aria-hidden', 'false')
    .attr('focusable', 'false')
    .style('background', BACKGROUND_FILL)
    .style('cursor', 'grab');

  const rootGroup = svg.append('g').attr('class', 'zoom-root');
  rootGroup.append('g').attr('class', 'links');
  rootGroup.append('g').attr('class', 'nodes');
  return rootGroup;
};

const applyZoom = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  rootGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  scaleRef: React.MutableRefObject<number>,
) => {
  const zoomBehaviour = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.6, 3.5])
    .on('start', () => svg.style('cursor', 'grabbing'))
    .on('end', () => svg.style('cursor', 'grab'))
    .on('zoom', event => {
      scaleRef.current = event.transform.k;
      rootGroup.attr('transform', event.transform.toString());
      const k = event.transform.k;
      rootGroup
        .selectAll<SVGTextElement, D3Node>('text.node-label')
        .attr('opacity', function () {
          const el = d3.select(this);
          return el.classed('force-visible') || k > 1.1 ? 0.9 : 0;
        });
    });

  svg.call(zoomBehaviour as any);
  return zoomBehaviour;
};

const renderTree = (
  rootGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  hierarchyRoot: d3.HierarchyNode<TreeNode>,
  size: { width: number; height: number },
  accentColor: string,
  scaleRef: React.MutableRefObject<number>,
) => {
  const width = Math.max(size.width, MIN_SIZE);
  const height = Math.max(size.height, MIN_SIZE);

  const treeLayout = d3
    .tree<TreeNode>()
    .size([height - MARGIN.top - MARGIN.bottom, width - MARGIN.left - MARGIN.right])
    .separation((a, b) => (a.parent === b.parent ? 1.6 : 2));

  const treeRoot = treeLayout(hierarchyRoot);
  treeRoot.each(node => {
    node.x += MARGIN.top;
    node.y += MARGIN.left;
  });

  const nodes = treeRoot.descendants();
  const links = treeRoot.links();

  const linkGenerator = d3
    .linkHorizontal<D3Link, D3Node>()
    .x(d => d.y)
    .y(d => d.x);

  const transition = d3.transition('tree-transition').duration(420).ease(d3.easeCubicInOut);

  const linkLayer = rootGroup.select<SVGGElement>('g.links');
  const linkSelection = linkLayer.selectAll<SVGPathElement, D3Link>('path').data(links, d => d.target.data.id);

  linkSelection
    .join(
      enter =>
        enter
          .append('path')
          .attr('class', 'tree-link')
          .attr('fill', 'none')
          .attr('stroke', LINK_COLOR)
          .attr('stroke-width', 1)
          .attr('stroke-opacity', 0)
          .attr('d', d => {
            const sourceY = d.source ? d.source.y : d.target.y;
            const sourceX = d.source ? d.source.x : d.target.x;
            const placeholder = { source: { x: sourceX, y: sourceY }, target: { x: sourceX, y: sourceY } } as D3Link;
            return linkGenerator(placeholder) ?? '';
          })
          .call(enterPath =>
            enterPath
              .transition(transition)
              .attr('stroke-opacity', 0.6)
              .attr('d', linkGenerator as any),
          ),
      update =>
        update
          .transition(transition)
          .attr('stroke-opacity', 0.6)
          .attr('d', linkGenerator as any),
      exit =>
        exit
          .transition(transition)
          .attr('stroke-opacity', 0)
          .remove(),
    );

  const nodeLayer = rootGroup.select<SVGGElement>('g.nodes');
  const nodeSelection = nodeLayer.selectAll<SVGGElement, D3Node>('g.node').data(nodes, d => d.data.id);

  const nodeEnter = nodeSelection
    .enter()
    .append('g')
    .attr('class', 'node')
    .classed('node', true)
    .classed('collapsed', d => !d.children && !!d.data.children?.length)
    .attr('transform', d => {
      const parent = d.parent ?? d;
      return `translate(${parent.y},${parent.x})`;
    })
    .style('cursor', d => (d.data.children && d.data.children.length > 0 ? 'pointer' : 'default'));

  nodeEnter
    .append('circle')
    .attr('r', 0)
    .attr('fill', d => (d.data.type === 'file' ? FILE_FILL : '#f8fafc'))
    .attr('stroke', d => (d.data.type === 'file' ? 'transparent' : accentColor || FOLDER_STROKE))
    .attr('stroke-width', d => (d.data.type === 'file' ? 0 : 1.4))
    .call(enterCircle =>
      enterCircle
        .transition(transition)
        .attr('r', d => (d.data.type === 'file' ? 3 : 7)),
    );

  nodeEnter
    .append('text')
    .attr('class', 'node-label')
    .attr('font-family', FONT_FAMILY)
    .attr('font-size', 11)
    .attr('font-weight', 400)
    .attr('fill', '#111827')
    .attr('opacity', 0)
    .attr('dy', '0.32em')
    .attr('x', d => (d.children ? -12 : 12))
    .attr('text-anchor', d => (d.children ? 'end' : 'start'))
    .text(d => d.data.name);

  const nodeMerge = nodeEnter.merge(nodeSelection as any);

  nodeMerge
    .classed('collapsed', d => !d.children && !!d.data.children?.length)
    .style('cursor', d => (d.data.children && d.data.children.length > 0 ? 'pointer' : 'default'))
    .transition(transition)
    .attr('transform', d => `translate(${d.y},${d.x})`);

  nodeMerge
    .select<SVGCircleElement>('circle')
    .transition(transition)
    .attr('fill', d => (d.data.type === 'file' ? FILE_FILL : '#f8fafc'))
    .attr('stroke', d => (d.data.type === 'file' ? 'transparent' : accentColor || FOLDER_STROKE))
    .attr('stroke-width', d => (d.data.type === 'file' ? 0 : 1.4))
    .attr('r', d => (d.data.type === 'file' ? 3 : 7));

  nodeMerge
    .select<SVGTextElement>('text.node-label')
    .attr('x', d => (d.children ? -12 : 12))
    .attr('text-anchor', d => (d.children ? 'end' : 'start'))
    .text(d => d.data.name)
    .attr('opacity', function () {
      const el = d3.select(this);
      return el.classed('force-visible') || scaleRef.current > 1.1 ? 0.9 : 0;
    });

  nodeMerge
    .on('dblclick', (event, datum) => {
      if (!datum.data.children || datum.data.children.length === 0) return;
      event.stopPropagation();
      const nodeEvent = new CustomEvent('tree:toggle-node', {
        detail: { id: datum.data.id },
        bubbles: true,
      });
      event.currentTarget?.dispatchEvent(nodeEvent);
    })
    .on('contextmenu', (event, datum) => {
      if (!datum.data.children || datum.data.children.length === 0) return;
      event.preventDefault();
      const nodeEvent = new CustomEvent('tree:toggle-node', {
        detail: { id: datum.data.id },
        bubbles: true,
      });
      event.currentTarget?.dispatchEvent(nodeEvent);
    })
    .on('mouseenter', function () {
      d3.select(this)
        .select<SVGTextElement>('text.node-label')
        .classed('force-visible', true)
        .attr('opacity', 1);
    })
    .on('mouseleave', function () {
      d3.select(this)
        .select<SVGTextElement>('text.node-label')
        .classed('force-visible', false)
        .attr('opacity', scaleRef.current > 1.1 ? 0.9 : 0);
    });

  nodeSelection
    .exit()
    .transition(transition)
    .attr('opacity', 0)
    .remove();
};

const TreeMap: React.FC<BaseTreeMapProps> = ({
  platformName,
  accentColor,
  position,
  fetchData,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [data, setData] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scaleRef = useRef(1);
  const size = useResizeObserver(containerRef);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchData()
      .then(result => {
        if (cancelled) return;
        setData(result);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load tree');
        setData(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const rootGroup = initializeSvg(svg);
    applyZoom(svg, rootGroup, scaleRef);

    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.attr('viewBox', `0 0 ${Math.max(size.width, MIN_SIZE)} ${Math.max(size.height, MIN_SIZE)}`);

    const rootGroup = svg.select<SVGGElement>('g.zoom-root');
    if (rootGroup.empty()) return;

    const hierarchyRoot = createTreeHierarchy(data, collapsed);
    renderTree(rootGroup, hierarchyRoot, size, accentColor, scaleRef);
  }, [data, collapsed, size, accentColor]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;

    const toggleHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (!detail?.id) return;
      setCollapsed(prev => {
        const next = new Set(prev);
        if (next.has(detail.id)) {
          next.delete(detail.id);
        } else {
          next.add(detail.id);
        }
        return next;
      });
    };

    svgElement.addEventListener('tree:toggle-node', toggleHandler as EventListener);
    return () => {
      svgElement.removeEventListener('tree:toggle-node', toggleHandler as EventListener);
    };
  }, []);

  const positionClasses = POSITION_CLASSES[position];

  return (
    <div
      ref={containerRef}
      className={`absolute ${positionClasses} p-6 ${className ?? ''}`.trim()}
      style={{ pointerEvents: 'auto' }}
    >
      <div className="w-full h-full relative">
        <svg ref={svgRef} className="w-full h-full" aria-label={`${platformName} folder tree`} />
        <div className="absolute top-4 left-4 text-xs font-medium tracking-wide uppercase text-slate-500">
          {platformName}
        </div>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Loading…
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-rose-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

const createPlatformTreeMap = (
  platformName: string,
  position: PlatformPosition,
  accentColor: string,
) => {
  const Component: React.FC<PlatformTreeMapProps> = ({ fetchData, className }) => (
    <TreeMap
      platformName={platformName}
      position={position}
      accentColor={accentColor}
      fetchData={fetchData}
      className={className}
    />
  );
  Component.displayName = `${platformName.replace(/\s+/g, '')}TreeMap`;
  return Component;
};

export const NotionTreeMap = createPlatformTreeMap('Notion', 'top-left', '#6366f1');
export const DriveTreeMap = createPlatformTreeMap('Google Drive', 'top-right', '#1a73e8');
export const OneDriveTreeMap = createPlatformTreeMap('OneDrive', 'bottom-left', '#0a68e8');
export const DropboxTreeMap = createPlatformTreeMap('Dropbox', 'bottom-right', '#1e40af');

export const HierarchyTreeMap: React.FC<HierarchyTreeMapProps> = ({
  notionLoader,
  driveLoader,
  oneDriveLoader,
  dropboxLoader,
  className,
}) => {
  return (
    <div className={`absolute inset-0 pointer-events-auto ${className ?? ''}`.trim()}>
      <div className="relative w-full h-full">
        <NotionTreeMap fetchData={notionLoader} />
        <DriveTreeMap fetchData={driveLoader} />
        <OneDriveTreeMap fetchData={oneDriveLoader} />
        <DropboxTreeMap fetchData={dropboxLoader} />
      </div>
    </div>
  );
};

export type { TreeNode, PlatformTreeMapProps };

