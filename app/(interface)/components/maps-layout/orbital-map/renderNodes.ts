import * as d3 from 'd3';
import { getNodeId } from './nodeId';

const LOGO_MAP: Record<string, string> = {
  'Folder Fox': '/assets/folder-fox.png',
  'Google Drive': '/assets/google-drive-logo.png',
  Dropbox: '/assets/dropbox-logo.png',
  OneDrive: '/assets/onedrive-logo.png',
  Notion: '/assets/notion-logo.png',
};

const INTEGRATION_NAMES = ['Google Drive', 'Dropbox', 'OneDrive', 'Notion'];

export function renderNodes(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  visibleNodes: any[],
) {
  const node = nodeLayer
    .selectAll<SVGGElement, any>('g.node')
    .data(visibleNodes, d => getNodeId(d))
    .join(
      enter => {
        const group = enter
          .append('g')
          .attr('class', 'node')
          .style('cursor', 'pointer')
          .style('opacity', 0)
          .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);

        group.each(function (d: any) {
          const selection = d3.select(this);
          const name = d.data?.name ?? 'Node';
          const radius = d.depth === 0 ? 30 : 22;
          const isFolderFox = d.depth === 0 && name === 'Folder Fox';
          const isIntegration = d.depth === 1 && INTEGRATION_NAMES.includes(name);

          if ((isFolderFox || isIntegration) && LOGO_MAP[name]) {
            // ---- Logo node ----
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
            // ---- Regular folder node ----
            selection
              .append('circle')
              .attr('r', 18)
              .attr('fill', '#69b3a2')
              .attr('stroke', '#333')
              .attr('stroke-width', 1.5);

            selection
              .append('text')
              .attr('text-anchor', 'middle')
              .attr('dy', '0.35em')
              .attr('font-size', 9)
              .attr('fill', '#fff')
              .text(name.length > 12 ? name.slice(0, 10) + '…' : name);
          }
        });

        group.append('title').text(d => d.data?.name ?? 'Node');

        return group
          .transition()
          .duration(300)
          .style('opacity', 1);
      },
      update => update,
      exit =>
        exit.transition().duration(200).style('opacity', 0).remove(),
    );

  node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  return node;
}
