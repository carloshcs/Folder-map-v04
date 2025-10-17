import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import type { FolderItem } from '../../right-sidebar/data';
import { buildHierarchyTree, type HierarchyNode } from '../utils';

interface SunBurstMapProps {
  folders: FolderItem[];
}

const MIN_SIZE = 720;
const CENTER_LABEL_RADIUS = 60;

export const SunBurstMap: React.FC<SunBurstMapProps> = ({ folders }) => {
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

    const radius = diameter / 2;

    const root = d3.hierarchy<HierarchyNode>(hierarchyData, node => node.children ?? [])
      .sum(node => Math.max(node.metrics.totalSize, node.metrics.fileCount * 2048, node.metrics.folderCount * 512, 1))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const partition = d3.partition<HierarchyNode>()
      .size([2 * Math.PI, radius - 16]);

    partition(root);

    const color = d3.scaleSequential(d3.interpolateCool).domain([0, root.height || 1]);

    const arcGenerator = d3.arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => Math.max(d.y0, CENTER_LABEL_RADIUS))
      .outerRadius(d => Math.max(d.y0, Math.min(radius, d.y1)));

    const g = svg
      .attr('width', diameter)
      .attr('height', diameter)
      .attr('viewBox', `${-radius} ${-radius} ${diameter} ${diameter}`)
      .append('g');

    const nodes = root.descendants().filter(node => node.depth > 0);

    g.append('g')
      .selectAll('path')
      .data(nodes)
      .join('path')
      .attr('d', arcGenerator as any)
      .attr('fill', node => color(node.depth))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .attr('fill-opacity', node => 0.45 + (node.depth / (root.height || 1)) * 0.35)
      .append('title')
      .text(node => {
        const { totalSize, fileCount, folderCount } = node.data.metrics;
        return `${node.ancestors().map(ancestor => ancestor.data.name).reverse().join(' / ')}` +
          `\n${fileCount.toLocaleString()} files • ${folderCount.toLocaleString()} folders` +
          `\n${(totalSize / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`;
      });

    const labelGroup = g.append('g')
      .attr('text-anchor', 'middle')
      .attr('font-family', 'inherit');

    nodes
      .filter(node => (node.x1 - node.x0) > 0.03)
      .forEach(node => {
        const angle = (node.x0 + node.x1) / 2 - Math.PI / 2;
        const radiusPosition = (node.y0 + node.y1) / 2;
        const x = Math.cos(angle) * radiusPosition;
        const y = Math.sin(angle) * radiusPosition;

        labelGroup.append('text')
          .attr('transform', `translate(${x},${y}) rotate(${(angle * 180) / Math.PI})`)
          .attr('dy', '0.32em')
          .attr('font-size', node.depth <= 2 ? '12px' : '10px')
          .attr('font-weight', node.depth <= 1 ? 600 : 500)
          .attr('fill', '#0f172a')
          .text(node.data.name);
      });

    const { totalSize, fileCount, folderCount } = hierarchyData.metrics;

    g.append('circle')
      .attr('r', CENTER_LABEL_RADIUS - 12)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e2e8f0');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-weight', 600)
      .attr('font-size', '18px')
      .attr('fill', '#1e293b')
      .attr('dy', '-0.2em')
      .text('Workspace');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#475569')
      .attr('dy', '1.1em')
      .text(`${fileCount.toLocaleString()} files`);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#475569')
      .attr('dy', '2.3em')
      .text(`${(totalSize / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#94a3b8')
      .attr('dy', '3.5em')
      .text(`${folderCount.toLocaleString()} folders`);
  }, [hierarchyData, diameter]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white">
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" role="img" aria-label="Sunburst folder distribution" />
    </div>
  );
};
