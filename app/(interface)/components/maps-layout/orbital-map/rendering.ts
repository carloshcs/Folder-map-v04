//rendering
import * as d3 from 'd3';
import { LOGO_MAP } from './constants';
import { getNodeId } from './nodeUtils';
import { getNodeRadius } from './geometry';
import { D3HierarchyNode, SidebarPalette } from './types';

export function renderNodes(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  visibleNodes: D3HierarchyNode[],
  palette: SidebarPalette,
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
          .style('filter', 'url(#nodeShadow)')
          .style('opacity', 0)
          .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);

        group.each(function (d: D3HierarchyNode) {
          const selection = d3.select(this);
          const name = d.data?.name ?? 'Node';
          const isFolderFox = d.depth === 0 && name === 'Folder Fox';
          const isIntegration = d.depth === 1 && LOGO_MAP[name];

          if (isFolderFox || isIntegration) {
            const radius = getNodeRadius(d.depth);
            const gradientId = isFolderFox ? 'folderFoxGradient' : 'integrationGradient';
            const outlineColor = isFolderFox ? palette.primary : palette.accent;
            const foreground = isFolderFox ? palette.primaryForeground : palette.accentForeground;

            selection
              .append('circle')
              .attr('class', 'node-outline')
              .attr('r', radius)
              .attr('fill', `url(#${gradientId})`)
              .attr('stroke', outlineColor)
              .attr('stroke-width', 2.5)
              .attr('stroke-opacity', 0.35);

            selection
              .append('circle')
              .attr('class', 'node-highlight')
              .attr('r', radius - 6)
              .attr('fill', `url(#${gradientId})`)
              .attr('stroke', foreground)
              .attr('stroke-width', 1.5)
              .attr('stroke-opacity', 0.45)
              .style('pointer-events', 'none');

            selection
              .append('image')
              .attr('href', LOGO_MAP[name])
              .attr('x', -radius * 0.55)
              .attr('y', -radius * 0.55)
              .attr('width', radius * 1.1)
              .attr('height', radius * 1.1)
              .style('pointer-events', 'none');
          } else {
            const radius = getNodeRadius(d.depth);
            selection
              .append('circle')
              .attr('r', radius)
              .attr('fill', 'url(#defaultNodeGradient)')
              .attr('stroke', palette.border)
              .attr('stroke-width', 1.4)
              .attr('stroke-opacity', 0.6);

            const maxChars = Math.max(6, Math.floor(radius * 0.6));
            let displayText = name;

            if (displayText.length > maxChars) {
              displayText = displayText.slice(0, maxChars - 1) + '…';
            }

            const fontSize = Math.max(8, Math.min(14, radius * 0.42));

            selection
              .append('text')
              .attr('text-anchor', 'middle')
              .attr('dy', '0.35em')
              .attr('font-size', fontSize)
              .attr('fill', palette.surfaceForeground)
              .attr('font-weight', '600')
              .attr('pointer-events', 'none')
              .text(displayText);
          }
        });

        group.append('title').text(d => d.data?.name ?? 'Node');

        return group.transition().duration(300).style('opacity', 1);
      },
      update => update,
      exit => exit.transition().duration(200).style('opacity', 0).remove(),
    );

  node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  return node;
}
