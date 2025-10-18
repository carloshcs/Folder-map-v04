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

interface RadialTreeMapProps {
  folders: FolderItem[];
}

const MIN_SIZE = 1400;
const MARGIN = 250;

const LOGO_MAP: Record<string, string> = {
  'Folder Fox': '/assets/folder-fox.png',
  'Google Drive': '/assets/google-drive-logo.png',
  'Dropbox': '/assets/dropbox-logo.png',
  'OneDrive': '/assets/onedrive-logo.png',
};

const INTEGRATION_NAMES = ['Google Drive', 'Dropbox', 'OneDrive'];

// Build hierarchy tree starting from Folder Fox
const buildHierarchyTree = (folders: FolderItem[]): HierarchyNode => {
  const mapFolder = (folder: FolderItem): HierarchyNode => {
    return {
      name: folder.name,
      children: folder.children?.map(mapFolder),
      metrics: {
        totalSize: 0,
        fileCount: 0,
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

export const RadialTreeMap: React.FC<RadialTreeMapProps> = ({ folders }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [diameter, setDiameter] = useState(MIN_SIZE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rotation, setRotation] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const lastAngleRef = useRef(0);

  const hierarchyData = useMemo(() => buildHierarchyTree(folders), [folders]);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const size = Math.min(width, height);
        setDiameter(Math.max(MIN_SIZE, size));
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = diameter / 2 - MARGIN;

    const root = d3.hierarchy<HierarchyNode>(hierarchyData, node => node.children ?? []);

    // Filter visible nodes based on expanded state
    // Show root (Folder Fox) and first level (integrations) always
    // For deeper levels, only show if parent is expanded
    const allNodes = root.descendants();
    const visibleNodes = allNodes.filter((d: any) => {
      if (d.depth === 0) return true; // Always show Folder Fox
      if (d.depth === 1) return true; // Always show integrations (Drive, Dropbox, OneDrive)
      
      // For depth >= 2, only show if parent is expanded
      const parent = d.parent;
      if (!parent) return false;
      return expanded.has(parent.data.name);
    });

    const allLinks = root.links();
    const visibleLinks = allLinks.filter((link: any) =>
      visibleNodes.includes(link.source) && visibleNodes.includes(link.target)
    );

    // Calculate max depth for color gradient
    const maxDepth = d3.max(visibleNodes, (d: any) => d.depth) || 1;

    // Tree layout with better separation
    const treeLayout = d3.tree<HierarchyNode>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => {
        if (a.parent === b.parent) {
          if (a.depth === 1) return 10;
          if (a.depth === 2) return 8;
          if (a.depth === 3) return 7;
          return 6;
        } else {
          if (a.depth === 1 || b.depth === 1) return 12;
          if (a.depth === 2 || b.depth === 2) return 10;
          if (a.depth === 3 || b.depth === 3) return 9;
          return 8;
        }
      });

    treeLayout(root);

    // Adjust radial distances for better spacing
    root.descendants().forEach((d: any) => {
      if (d.depth > 0) {
        const levelMultiplier = 6.0;
        d.y = d.depth * (radius / (maxDepth + 1)) * levelMultiplier;
      }
    });

    const viewPadding = diameter * 1.5;
    const viewExtent = diameter + viewPadding * 2;

    const g = svg
      .attr('width', diameter)
      .attr('height', diameter)
      .attr('viewBox', `${-viewExtent / 2} ${-viewExtent / 2} ${viewExtent} ${viewExtent}`)
      .style('overflow', 'visible')
      .append('g')
      .attr('transform', `rotate(${rotation})`);

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .filter((event: any) => {
        if (event.type === 'mousedown' && event.button === 2) return false;
        if (event.shiftKey) return false;
        return true;
      })
      .on('zoom', (event) => {
        const transform = event.transform;
        g.attr('transform', `${transform} rotate(${rotation})`);
      });

    svg.call(zoom as any);
    svg.on('dblclick.zoom', null);

    // Draw orbital rings for first 3 levels
    const orbitRings = g.append('g').attr('class', 'orbit-rings');
    const orbitRadii: number[] = [];
    for (let depth = 1; depth <= Math.min(3, maxDepth); depth++) {
      const levelMultiplier = 6.0;
      const orbitRadius = depth * (radius / (maxDepth + 1)) * levelMultiplier;
      orbitRadii.push(orbitRadius);
    }

    orbitRadii.forEach((r, index) => {
      orbitRings.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#d0d0d0')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5')
        .attr('opacity', 0.4 - (index * 0.1));
    });

    // Color gradient function
    const getNodeColor = (depth: number) => {
      if (depth === 0 || depth === 1) return '#fff'; // White for Folder Fox and integrations
      const colorScale = d3.scaleSequential()
        .domain([2, maxDepth])
        .interpolator(d3.interpolateRgb('#2c5aa0', '#ffd966'));
      return colorScale(depth);
    };

    // Draw links - use straight lines for depth 1 to center
    const linkGroup = g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 6); // 1.5 * 4

    visibleLinks.forEach((link: any) => {
      if (link.source.depth === 0 && link.target.depth === 1) {
        // Straight lines from Folder Fox to integrations
        linkGroup.append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', () => {
            const angle = link.target.x - Math.PI / 2;
            return Math.cos(angle) * link.target.y;
          })
          .attr('y2', () => {
            const angle = link.target.x - Math.PI / 2;
            return Math.sin(angle) * link.target.y;
          });
      } else {
        // Curved lines for other connections
        const linkGenerator = d3.linkRadial<any, any>()
          .angle(d => d.x)
          .radius(d => d.y);
        
        linkGroup.append('path')
          .attr('d', linkGenerator(link));
      }
    });

    // Draw nodes
    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(visibleNodes)
      .join('g')
      .attr('transform', (d: any) => {
        const angle = d.x - Math.PI / 2;
        const x = Math.cos(angle) * d.y;
        const y = Math.sin(angle) * d.y;
        return `translate(${x},${y})`;
      });

    const nodeRadius = 32; // 8 * 4 = 32
    const rootRadius = 140; // 35 * 4 = 140 (Folder Fox)
    const integrationRadius = 112; // 28 * 4 = 112 (Drive, Dropbox, OneDrive)

    nodeGroup.append('circle')
      .attr('r', (d: any) => {
        if (d.depth === 0) return rootRadius;
        if (d.depth === 1) return integrationRadius;
        return nodeRadius;
      })
      .attr('fill', (d: any) => getNodeColor(d.depth))
      .attr('stroke', (d: any) => {
        if (d.depth === 0) return '#ff6b35'; // Orange for Folder Fox
        if (d.depth === 1) return '#4285f4'; // Blue for integrations
        return '#333';
      })
      .attr('stroke-width', (d: any) => (d.depth <= 1 ? 3 : 1.2))
      .style('cursor', (d: any) => {
        // Check if this node has children in the original hierarchy
        const originalNode = root.descendants().find((n: any) => 
          n.data.name === d.data.name && n.depth === d.depth
        );
        return (originalNode?.children && originalNode.children.length > 0) ? 'pointer' : 'default';
      });

    // Add logos for Folder Fox and integrations
    nodeGroup.filter((d: any) => d.depth <= 1 && LOGO_MAP[d.data.name])
      .append('image')
      .attr('href', (d: any) => LOGO_MAP[d.data.name])
      .attr('x', (d: any) => {
        const size = d.depth === 0 ? rootRadius * 1.6 : integrationRadius * 1.6;
        return -size / 2;
      })
      .attr('y', (d: any) => {
        const size = d.depth === 0 ? rootRadius * 1.6 : integrationRadius * 1.6;
        return -size / 2;
      })
      .attr('width', (d: any) => d.depth === 0 ? rootRadius * 1.6 : integrationRadius * 1.6)
      .attr('height', (d: any) => d.depth === 0 ? rootRadius * 1.6 : integrationRadius * 1.6)
      .style('pointer-events', 'none');

    // Add labels with proper orientation
    nodeGroup.append('text')
      .attr('dy', '0.31em')
      .attr('x', (d: any) => {
        if (d.depth === 0) return 0;
        const angle = d.x;
        return angle < Math.PI ? 12 : -12;
      })
      .attr('y', (d: any) => {
        if (d.depth === 0) return rootRadius + 60;
        if (d.depth === 1) return integrationRadius + 48;
        return 0;
      })
      .attr('text-anchor', (d: any) => {
        if (d.depth <= 1) return 'middle';
        const angle = d.x;
        return angle < Math.PI ? 'start' : 'end';
      })
      .attr('transform', (d: any) => {
        if (d.depth <= 1) return '';
        const angle = d.x;
        const degrees = (angle * 180 / Math.PI) - 90;
        if (angle >= Math.PI / 2 && angle < 3 * Math.PI / 2) {
          return `rotate(${degrees + 180})`;
        } else {
          return `rotate(${degrees})`;
        }
      })
      .text((d: any) => d.data.name)
      .style('font-size', (d: any) => {
        if (d.depth === 0) return '64px'; // 16 * 4
        if (d.depth === 1) return '52px'; // 13 * 4
        return '44px'; // 11 * 4
      })
      .style('font-weight', (d: any) => (d.depth <= 1 ? 'bold' : '500'))
      .style('fill', '#333')
      .style('pointer-events', 'none')
      .clone(true).lower()
      .attr('stroke', 'white')
      .attr('stroke-width', 3)
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
    .attr('font-size', (d: any) => d.depth <= 1 ? '72px' : '56px') // 18 * 4, 14 * 4
    .attr('font-weight', 'bold')
    .attr('fill', (d: any) => d.depth <= 1 ? '#333' : '#666')
    .style('pointer-events', 'none')
    .text((d: any) => expanded.has(d.data.name) ? '−' : '+');

    // Add tooltips
    nodeGroup.append('title')
      .text((d: any) => {
        const metrics = d.data.metrics;
        if (metrics && d.depth > 0) {
          return `${d.data.name}\n${metrics.fileCount.toLocaleString()} files • ${metrics.folderCount.toLocaleString()} folders`;
        }
        return d.data.name;
      });

    // Double-click to expand/collapse
    nodeGroup.on('dblclick', (event: any, d: any) => {
      event.stopPropagation();
      const name = d.data?.name;
      if (!name) return;

      // Check if node has children in original hierarchy
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

  }, [hierarchyData, diameter, expanded, rotation]);

  // Handle rotation with right-click or Shift+drag
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.shiftKey) {
        e.preventDefault();
        setIsRotating(true);

        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
        lastAngleRef.current = angle;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isRotating) return;

      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      const delta = angle - lastAngleRef.current;

      setRotation(prev => prev + delta);
      lastAngleRef.current = angle;
    };

    const handleMouseUp = () => {
      setIsRotating(false);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', handleContextMenu);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isRotating]);

  const containerSize = Math.max(diameter, MIN_SIZE);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: `${containerSize}px`,
        height: `${containerSize}px`,
        minWidth: `${MIN_SIZE}px`,
        minHeight: `${MIN_SIZE}px`,
        cursor: isRotating ? 'grabbing' : 'default',
      }}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        role="img"
        aria-label="Folder Fox - Radial Tree Explorer"
      />

      {/* Title */}
      <div className="absolute top-4 left-4 bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-lg shadow-lg">
        <div className="text-lg font-bold">Folder Fox Explorer</div>
        <div className="text-xs opacity-90">Multi-Cloud File Visualization</div>
      </div>

      {/* Rotation Indicator */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 border border-gray-200">
        <div className="text-sm font-semibold text-gray-700">
          Rotation: {Math.round(rotation)}°
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => setRotation(0)}
        className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 border border-gray-200 hover:bg-orange-50 hover:border-orange-400 transition-all"
      >
        <span className="text-sm font-semibold text-gray-700">↻ Reset</span>
      </button>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 border border-gray-200 max-w-sm">
        <div className="text-xs space-y-1">
          <div className="font-semibold text-gray-800 mb-2">Controls:</div>
          <div className="text-gray-600">🖱️ <strong>Right-click + Drag</strong> or <strong>Shift + Drag</strong> to rotate</div>
          <div className="text-gray-600">🖱️ <strong>Left-click + Drag</strong> to pan</div>
          <div className="text-gray-600">🖱️ <strong>Scroll</strong> to zoom</div>
          <div className="text-gray-600">🖱️ <strong>Double-click</strong> nodes with + to expand folders</div>
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
            { name: 'Project C' }
          ]
        },
        {
          name: 'Personal',
          children: [
            { name: 'Photos', children: [{ name: '2024' }, { name: '2023' }] },
            { name: 'Documents' }
          ]
        }
      ]
    },
    {
      name: 'Dropbox',
      children: [
        { name: 'Work', children: [{ name: 'Reports' }, { name: 'Presentations' }] },
        { name: 'Backup' }
      ]
    },
    {
      name: 'OneDrive',
      children: [
        { name: 'Documents', children: [{ name: 'Office' }, { name: 'PDFs' }] },
        { name: 'Pictures' }
      ]
    }
  ];

  return (
    <div className="w-full h-screen p-4">
      <div className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden">
        <RadialTreeMap folders={sampleFolders} />
      </div>
    </div>
  );
}