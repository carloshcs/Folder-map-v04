import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

interface FolderItem {
  name: string;
  children?: FolderItem[];
}

interface HierarchyNode {
  name: string;
  children?: HierarchyNode[];
  metrics?: {
    totalSize: number;
    fileCount: number;
    folderCount: number;
  };
}

interface HierarchyTreeMapProps {
  folders: FolderItem[];
}

const MIN_WIDTH = 960;
const MIN_HEIGHT = 720;
const MARGIN = { top: 48, right: 200, bottom: 48, left: 240 };

const LOGO_MAP: Record<string, string> = {
  'Folder Fox': '/assets/folder-fox.png',
  'Google Drive': '/assets/google-drive-logo.png',
  'Dropbox': '/assets/dropbox-logo.png',
  'OneDrive': '/assets/onedrive-logo.png',
  'Notion': '/assets/notion-logo.png',
};

const INTEGRATION_NAMES = ['Google Drive', 'Dropbox', 'OneDrive', 'Notion'];

// Build hierarchy tree starting from Folder Fox
const buildHierarchyTree = (folders: FolderItem[]): HierarchyNode => {
  const mapFolder = (folder: FolderItem): HierarchyNode => {
    return {
      name: folder.name,
      children: folder.children?.map(mapFolder),
      metrics: {
        totalSize: Math.random() * 10000,
        fileCount: Math.floor(Math.random() * 100),
        folderCount: folder.children?.length || 0
      }
    };
  };
  
  // Create Folder Fox as root with integrations as children
  return {
    name: 'Folder Fox',
    children: folders
      .filter(f => INTEGRATION_NAMES.includes(f.name))
      .map(mapFolder),
    metrics: {
      totalSize: 0,
      fileCount: 0,
      folderCount: 0
    }
  };
};

export const HierarchyTreeMap: React.FC<HierarchyTreeMapProps> = ({ folders }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ width: MIN_WIDTH, height: MIN_HEIGHT });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const hierarchyData = useMemo(() => buildHierarchyTree(folders), [folders]);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({
          width: Math.max(MIN_WIDTH, width),
          height: Math.max(MIN_HEIGHT, height),
        });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = size.width;
    const height = size.height;

    const root = d3.hierarchy<HierarchyNode>(hierarchyData, node => node.children ?? []);

    // Filter visible nodes based on expanded state
    const allNodes = root.descendants();
    const visibleNodes = allNodes.filter((d: any) => {
      if (d.depth === 0) return true; // Always show Folder Fox
      if (d.depth === 1) return true; // Always show integrations
      
      // For depth >= 2, only show if parent is expanded
      const parent = d.parent;
      if (!parent) return false;
      return expanded.has(parent.data.name);
    });

    const allLinks = root.links();
    const visibleLinks = allLinks.filter((link: any) =>
      visibleNodes.includes(link.source) && visibleNodes.includes(link.target)
    );

    // Enhanced tree layout with better separation to prevent overlapping
    const treeLayout = d3.tree<HierarchyNode>()
      .size([height - MARGIN.top - MARGIN.bottom, width - MARGIN.left - MARGIN.right])
      .separation((a, b) => {
        // Increase separation between different integration branches
        if (a.parent !== b.parent) {
          if (a.depth === 1 || b.depth === 1) return 4.0; // More space between integrations
          return 2.5;
        }
        // Same parent - increase spacing for all levels
        if (a.depth === 1) return 3.5; // More space between integration children
        if (a.depth === 2) return 2.0;
        return 1.5;
      });

    // Create a temporary tree with only visible nodes
    const visibleRoot = d3.hierarchy<HierarchyNode>(hierarchyData, node => {
      if (!node.children) return [];
      return node.children.filter(child => {
        const parentNode = allNodes.find(n => n.data === node);
        if (!parentNode) return true;
        if (parentNode.depth === 0) return true;
        return expanded.has(node.name);
      });
    });

    const treeRoot = treeLayout(visibleRoot);

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Add zoom and pan behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .filter((event: any) => {
        if (event.type === 'wheel') return true;
        if (event.type === 'mousedown' && event.button === 0) return true;
        if (event.type === 'touchstart' || event.type === 'touchmove' || event.type === 'touchend') {
          return true;
        }
        return false;
      })
      .on('zoom', (event) => {
        const newTransform = event.transform;
        g.attr('transform', `translate(${MARGIN.left + newTransform.x},${MARGIN.top + newTransform.y}) scale(${newTransform.k})`);
        setTransform({ x: newTransform.x, y: newTransform.y, k: newTransform.k });
      });

    svg.call(zoom as any);
    svg.on('dblclick.zoom', null);

    const linkGenerator = d3.linkHorizontal<d3.HierarchyPointLink<HierarchyNode>, d3.HierarchyPointNode<HierarchyNode>>()
      .x(d => d.y)
      .y(d => d.x);

    // Draw links with dark mode support
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', 'var(--link-color)')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .selectAll('path')
      .data(visibleLinks)
      .join('path')
      .attr('d', linkGenerator as any);

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(treeRoot.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .style('cursor', (d: any) => {
        const originalNode = root.descendants().find((n: any) => 
          n.data.name === d.data.name && n.depth === d.depth
        );
        return (originalNode?.children && originalNode.children.length > 0) ? 'pointer' : 'default';
      });

    // Node circles with logos
    const nodeRadius = (d: any) => {
      if (d.depth === 0) return 35; // Folder Fox
      if (d.depth === 1) return 28; // Integrations
      return 8; // Other nodes
    };

    nodeGroup.append('circle')
      .attr('r', nodeRadius)
      .attr('fill', 'var(--node-bg)')
      .attr('stroke', d => {
        if (d.depth === 0) return '#ff6b35'; // Orange for Folder Fox
        if (d.depth === 1) return '#4285f4'; // Blue for integrations
        return 'var(--node-border)';
      })
      .attr('stroke-width', d => (d.depth <= 1 ? 3 : 1.5));

    // Add logos for Folder Fox and integrations
    nodeGroup.filter((d: any) => d.depth <= 1 && LOGO_MAP[d.data.name])
      .append('image')
      .attr('href', (d: any) => LOGO_MAP[d.data.name])
      .attr('x', (d: any) => {
        const size = nodeRadius(d) * 1.6;
        return -size / 2;
      })
      .attr('y', (d: any) => {
        const size = nodeRadius(d) * 1.6;
        return -size / 2;
      })
      .attr('width', (d: any) => nodeRadius(d) * 1.6)
      .attr('height', (d: any) => nodeRadius(d) * 1.6)
      .style('pointer-events', 'none');

    // Add expansion indicator (+ or -) for nodes with children
    nodeGroup.filter((d: any) => {
      const originalNode = root.descendants().find((n: any) => 
        n.data.name === d.data.name && n.depth === d.depth
      );
      return originalNode?.children && originalNode.children.length > 0;
    })
    .append('text')
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('font-size', (d: any) => d.depth <= 1 ? '18px' : '14px')
    .attr('font-weight', 'bold')
    .attr('fill', 'var(--expansion-indicator)')
    .style('pointer-events', 'none')
    .text((d: any) => expanded.has(d.data.name) ? '−' : '+');

    // Node labels with dark mode support
    nodeGroup.append('text')
      .attr('dy', '0.32em')
      .attr('x', d => (d.children || (d.data.children && d.data.children.length > 0) ? -48 : 48))
      .attr('text-anchor', d => (d.children || (d.data.children && d.data.children.length > 0) ? 'end' : 'start'))
      .attr('font-size', d => (d.depth <= 1 ? '14px' : '12px'))
      .attr('font-weight', d => (d.depth <= 1 ? 600 : 500))
      .attr('fill', 'var(--text-color)')
      .text(d => d.data.name)
      .style('pointer-events', 'none')
      .clone(true).lower()
      .attr('stroke', 'var(--text-outline)')
      .attr('stroke-width', 3)
      .style('pointer-events', 'none');

    nodeGroup.append('title')
      .text(d => {
        const metrics = d.data.metrics;
        if (metrics) {
          return `${d.data.name}\n${metrics.fileCount.toLocaleString()} files • ${metrics.folderCount.toLocaleString()} folders\n${(metrics.totalSize / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`;
        }
        return d.data.name;
      });

    // Double-click to expand/collapse
    nodeGroup.on('dblclick', (event: any, d: any) => {
      event.stopPropagation();
      const name = d.data?.name;
      if (!name) return;

      const originalNode = root.descendants().find((n: any) => 
        n.data.name === d.data.name && n.depth === d.depth
      );
      
      if (!originalNode?.children || originalNode.children.length === 0) return;

      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    });

  }, [hierarchyData, size, expanded]);

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(750).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
    setTransform({ x: 0, y: 0, k: 1 });
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full bg-white dark:bg-neutral-950"
      style={{
        '--link-color': 'rgb(209 213 219)',
        '--node-bg': '#ffffff',
        '--node-border': 'rgb(71 85 105)',
        '--text-color': 'rgb(31 41 55)',
        '--text-outline': '#ffffff',
        '--expansion-indicator': 'rgb(51 51 51)',
      } as React.CSSProperties}
    >
      <style jsx>{`
        @media (prefers-color-scheme: dark) {
          div {
            --link-color: rgb(64 64 64);
            --node-bg: rgb(23 23 23);
            --node-border: rgb(163 163 163);
            --text-color: rgb(229 231 235);
            --text-outline: rgb(23 23 23);
            --expansion-indicator: rgb(163 163 163);
          }
        }
      `}</style>
      
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" role="img" aria-label="Hierarchical folder tree" />
      
      {/* Title */}
      <div className="absolute top-4 left-4 bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-lg shadow-lg">
        <div className="text-lg font-bold">Folder Fox Explorer</div>
        <div className="text-xs opacity-90">Hierarchy Tree View</div>
      </div>

      {/* Zoom Indicator */}
      <div className="absolute top-4 right-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 border border-gray-200 dark:border-neutral-700">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Zoom: {Math.round(transform.k * 100)}%
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        className="absolute bottom-4 right-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 border border-gray-200 dark:border-neutral-700 hover:bg-orange-50 dark:hover:bg-neutral-800 hover:border-orange-400 dark:hover:border-orange-500 transition-all"
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">↻ Reset View</span>
      </button>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 border border-gray-200 dark:border-neutral-700 max-w-sm">
        <div className="text-xs space-y-1">
          <div className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Controls:</div>
          <div className="text-gray-600 dark:text-gray-400">🖱️ <strong>Left-click + Drag</strong> to pan</div>
          <div className="text-gray-600 dark:text-gray-400">🖱️ <strong>Scroll</strong> to zoom</div>
          <div className="text-gray-600 dark:text-gray-400">🖱️ <strong>Double-click</strong> nodes with + to expand folders</div>
        </div>
      </div>
    </div>
  );
};

// Demo component
export default function App() {
  const sampleFolders: FolderItem[] = [
    {
      name: 'Google Drive',
      children: [
        {
          name: 'Projects',
          children: [
            { name: 'Project A', children: [{ name: 'Documents' }, { name: 'Images' }] },
            { name: 'Project B', children: [{ name: 'Code' }, { name: 'Tests' }] },
            { name: 'Project C', children: [{ name: 'Assets' }, { name: 'Resources' }] },
            { name: 'Project D' }
          ]
        },
        {
          name: 'Personal',
          children: [
            { name: 'Photos', children: [{ name: '2024' }, { name: '2023' }] },
            { name: 'Documents' },
            { name: 'Videos' }
          ]
        },
        {
          name: 'Work',
          children: [
            { name: 'Reports' },
            { name: 'Meetings' }
          ]
        }
      ]
    },
    {
      name: 'Dropbox',
      children: [
        { 
          name: 'Work', 
          children: [
            { name: 'Reports' }, 
            { name: 'Presentations' },
            { name: 'Contracts' }
          ] 
        },
        { name: 'Backup', children: [{ name: 'Old Files' }] },
        { name: 'Shared' }
      ]
    },
    {
      name: 'OneDrive',
      children: [
        { 
          name: 'Documents', 
          children: [
            { name: 'Office' }, 
            { name: 'PDFs' },
            { name: 'Spreadsheets' }
          ] 
        },
        { name: 'Pictures', children: [{ name: 'Camera Roll' }] },
        { name: 'Desktop' }
      ]
    },
    {
      name: 'Notion',
      children: [
        { 
          name: 'Notes', 
          children: [
            { name: 'Work' }, 
            { name: 'Personal' },
            { name: 'Ideas' }
          ] 
        },
        { name: 'Projects', children: [{ name: 'Active' }, { name: 'Archive' }] },
        { name: 'Database' }
      ]
    }
  ];

  return (
    <div className="w-full h-screen p-4 bg-gray-50 dark:bg-neutral-950">
      <div className="w-full h-full border-2 border-gray-300 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-950">
        <HierarchyTreeMap folders={sampleFolders} />
      </div>
    </div>
  );
}