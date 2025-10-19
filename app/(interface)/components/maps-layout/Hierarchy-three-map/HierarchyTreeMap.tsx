import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import type { FolderItem } from '../../right-sidebar/data';
import { buildHierarchyTree, type HierarchyNode } from '../utils';

interface HierarchyTreeMapProps {
  folders: FolderItem[];
}

const MIN_WIDTH = 960;
const MIN_HEIGHT = 720;
const MARGIN = { top: 48, right: 200, bottom: 48, left: 240 };

export const HierarchyTreeMap: React.FC<HierarchyTreeMapProps> = ({ folders }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ width: MIN_WIDTH, height: MIN_HEIGHT });

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

    const treeLayout = d3.tree<HierarchyNode>()
      .size([height - MARGIN.top - MARGIN.bottom, width - MARGIN.left - MARGIN.right])
      .separation((a, b) => (a.parent === b.parent ? 1.3 : 1.6));

    const treeRoot = treeLayout(root);

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const linkGenerator = d3.linkHorizontal<d3.HierarchyPointLink<HierarchyNode>, d3.HierarchyPointNode<HierarchyNode>>()
      .x(d => d.y)
      .y(d => d.x);

    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#d0d5dd')
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(treeRoot.links())
      .join('path')
      .attr('d', linkGenerator as any);

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(treeRoot.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    nodeGroup.append('circle')
      .attr('r', d => (d.depth === 0 ? 12 : 8))
      .attr('fill', d => (d.depth === 0 ? '#1d4ed8' : '#ffffff'))
      .attr('stroke', d => (d.depth === 0 ? '#1d4ed8' : '#475467'))
      .attr('stroke-width', d => (d.depth === 0 ? 3 : 1.5));

    nodeGroup.append('text')
      .attr('dy', '0.32em')
      .attr('x', d => (d.children ? -16 : 16))
      .attr('text-anchor', d => (d.children ? 'end' : 'start'))
      .attr('font-size', d => (d.depth <= 1 ? '14px' : '12px'))
      .attr('font-weight', d => (d.depth <= 1 ? 600 : 500))
      .attr('fill', '#1f2937')
      .text(d => d.data.name);

    nodeGroup.append('title')
      .text(d => {
        const { totalSize, fileCount, folderCount } = d.data.metrics;
        return `${d.data.name}\n${fileCount.toLocaleString()} files • ${folderCount.toLocaleString()} folders\n${(totalSize / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`;
      });
  }, [hierarchyData, size]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white">
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" role="img" aria-label="Hierarchical folder tree" />
    </div>
  );
};
