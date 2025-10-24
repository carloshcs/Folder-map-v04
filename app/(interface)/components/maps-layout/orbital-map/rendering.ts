//rendering
import * as d3 from 'd3';
import { LOGO_MAP } from './constants';
import { getNodeColor, getNodeId } from './nodeUtils';
import { getNodeRadius } from './geometry';
import { D3HierarchyNode } from './types';

interface NodeEventHandlers {
  onNodeEnter?: (event: any, node: D3HierarchyNode) => void;
  onNodeLeave?: (event: any, node: D3HierarchyNode) => void;
  onNodeMove?: (event: any, node: D3HierarchyNode) => void;
}

export function renderNodes(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  visibleNodes: D3HierarchyNode[],
  eventHandlers?: NodeEventHandlers,
) {
  const node = nodeLayer
    .selectAll<SVGGElement, D3HierarchyNode>('g.node')
    .data(visibleNodes, d => getNodeId(d))
    .join(
      enter => {
        const group = enter
          .append('g')
          .attr('class', 'node')
          .style('cursor', 'pointer')
          .style('opacity', 0)
          .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
          .attr('filter', 'url(#node-shadow)');

        group.each(function (d: D3HierarchyNode) {
          const selection = d3.select(this);
          const name = d.data?.name ?? 'Node';
          const isFolderFox = d.depth === 0 && name === 'Folder Fox';
          const isIntegration = d.depth === 1 && LOGO_MAP[name];

          if (isFolderFox || isIntegration) {
            const radius = getNodeRadius(d.depth);
            selection
              .append('circle')
              .attr('r', radius)
              .attr('fill', '#fff')
              .attr('stroke', '#ccc')
              .attr('stroke-width', 2);

            selection
              .append('image')
              .attr('href', LOGO_MAP[name])
              .attr('x', -radius * 0.6)
              .attr('y', -radius * 0.6)
              .attr('width', radius * 1.2)
              .attr('height', radius * 1.2)
              .style('pointer-events', 'none');
          } else {
            const radius = getNodeRadius(d.depth);
            const color = getNodeColor(d.depth);

            selection
              .append('circle')
              .attr('r', radius)
              .attr('fill', color)
              .attr('stroke', '#333')
              .attr('stroke-width', 1);

            const maxChars = Math.max(6, Math.floor(radius * 0.7));
            let displayText = name;

            if (displayText.length > maxChars) {
              displayText = displayText.slice(0, maxChars - 1) + '…';
            }

            const fontSize = Math.max(7, Math.min(11, radius * 0.48));

            selection
              .append('text')
              .attr('text-anchor', 'middle')
              .attr('dy', '0.35em')
              .attr('font-size', fontSize)
              .attr('fill', '#000')
              .attr('font-weight', '500')
              .attr('pointer-events', 'none')
              .text(displayText);
          }
        });

        group.append('title').text(d => d.data?.name ?? 'Node');

        if (eventHandlers?.onNodeEnter) {
          group.on('mouseenter', eventHandlers.onNodeEnter);
        }
        if (eventHandlers?.onNodeMove) {
          group.on('mousemove', eventHandlers.onNodeMove);
        }
        if (eventHandlers?.onNodeLeave) {
          group.on('mouseleave', eventHandlers.onNodeLeave);
        }

        return group.transition().duration(300).style('opacity', 1);
      },
      update => update,
      exit => exit.transition().duration(200).style('opacity', 0).remove(),
    );

  node
    .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    .attr('filter', 'url(#node-shadow)')
    .on('mouseenter', eventHandlers?.onNodeEnter ?? null)
    .on('mousemove', eventHandlers?.onNodeMove ?? null)
    .on('mouseleave', eventHandlers?.onNodeLeave ?? null);
  return node;
}
