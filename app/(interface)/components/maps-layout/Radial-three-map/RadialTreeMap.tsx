import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import type { FolderItem } from '../right-sidebar/data';
import { buildHierarchyTree, type HierarchyNode } from '../utils';

interface RadialTreeMapProps {
  folders: FolderItem[];
}

const MIN_SIZE = 960;
const MARGIN = 80;

export const RadialTreeMap: React.FC<RadialTreeMapProps> = ({ folders }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [diameter, setDiameter] = useState(MIN_SIZE);

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
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = diameter / 2 - MARGIN;

    const root = d3.hierarchy<HierarchyNode>(hierarchyData, node => node.children ?? []);

    const clusterLayout = d3.cluster<HierarchyNode>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

    const clusterRoot = clusterLayout(root);

    const g = svg
      .attr('width', diameter)
      .attr('height', diameter)
      .attr('viewBox', `${-diameter / 2} ${-diameter / 2} ${diameter} ${diameter}`)
      .append('g');

    const linkGenerator = d3.linkRadial<d3.HierarchyPointLink<HierarchyNode>, d3.HierarchyPointNode<HierarchyNode>>()
      .angle(d => d.x)
      .radius(d => d.y);

    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#d0d5dd')
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', 1.2)
      .selectAll('path')
      .data(clusterRoot.links())
      .join('path')
      .attr('d', linkGenerator as any);

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(clusterRoot.descendants())
      .join('g')
      .attr('transform', d => {
        const angle = d.x - Math.PI / 2;
        const x = Math.cos(angle) * d.y;
        const y = Math.sin(angle) * d.y;
        return `translate(${x},${y})`;
      });

    nodeGroup.append('circle')
      .attr('r', d => (d.depth === 0 ? 12 : 6))
      .attr('fill', d => (d.depth === 0 ? '#1d4ed8' : '#ffffff'))
      .attr('stroke', d => (d.depth === 0 ? '#1d4ed8' : '#475467'))
      .attr('stroke-width', d => (d.depth === 0 ? 3 : 1.2));

    nodeGroup.append('text')
      .attr('dy', '0.32em')
      .attr('x', d => (d.x > Math.PI ? -12 : 12))
      .attr('text-anchor', d => (d.x > Math.PI ? 'end' : 'start'))
      .attr('transform', d => {
        const rotation = (d.x * 180) / Math.PI - 90;
        return `rotate(${rotation})`;
      })
      .attr('font-size', d => (d.depth <= 1 ? '13px' : '11px'))
      .attr('font-weight', d => (d.depth <= 1 ? 600 : 500))
      .attr('fill', '#1f2937')
      .text(d => d.data.name);

    nodeGroup.append('title')
      .text(d => {
        const { totalSize, fileCount, folderCount } = d.data.metrics;
        return `${d.data.name}\n${fileCount.toLocaleString()} files • ${folderCount.toLocaleString()} folders\n${(totalSize / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`;
      });
  }, [hierarchyData, diameter]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white">
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" role="img" aria-label="Radial hierarchical tree" />
    </div>
  );
};
