//rendering
import * as d3 from 'd3';
import { LOGO_MAP } from './constants';
import { getNodeColor, getNodeId } from './nodeUtils';
import { getNodeRadius } from './geometry';
import { D3HierarchyNode } from './types';

type NodeVisualStyle = {
  fill: string;
  textColor: string;
};

interface NodeEventHandlers {
  onNodeEnter?: (event: any, node: D3HierarchyNode) => void;
  onNodeLeave?: (event: any, node: D3HierarchyNode) => void;
  onNodeMove?: (event: any, node: D3HierarchyNode) => void;
}

interface RenderNodesOptions extends NodeEventHandlers {
  colorAssignments?: Map<string, NodeVisualStyle>;
}

const MAX_FONT_SIZE = 16;
const MIN_FONT_SIZE = 7;

const ensureTextFits = (
  text: d3.Selection<SVGTextElement, unknown, null, undefined>,
  content: string,
  radius: number,
  textColor: string,
) => {
  const maxWidth = radius * 1.7;
  let fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, radius * 0.5));

  text
    .attr('fill', textColor)
    .attr('font-weight', '600')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('pointer-events', 'none')
    .attr('font-size', fontSize)
    .text(content);

  const node = text.node();
  if (!node) return;

  let textLength = node.getComputedTextLength();

  while (textLength > maxWidth && fontSize > MIN_FONT_SIZE) {
    fontSize -= 1;
    text.attr('font-size', fontSize);
    textLength = node.getComputedTextLength();
  }

  if (textLength <= maxWidth) return;

  let truncated = content;
  while (truncated.length > 1 && textLength > maxWidth) {
    truncated = truncated.slice(0, -1);
    text.text(`${truncated.trimEnd()}…`);
    textLength = node.getComputedTextLength();
  }
};

export function renderNodes(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  visibleNodes: D3HierarchyNode[],
  options?: RenderNodesOptions,
) {
  const { colorAssignments, onNodeEnter, onNodeLeave, onNodeMove } = options ?? {};

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
              .attr('class', 'node-circle')
              .attr('r', radius)
              .attr('fill', '#fff')
              .attr('stroke', '#ccc')
              .attr('stroke-width', 2);

            selection
              .append('image')
              .attr('class', 'node-logo')
              .attr('href', LOGO_MAP[name])
              .attr('x', -radius * 0.65)
              .attr('y', -radius * 0.65)
              .attr('width', radius * 1.3)
              .attr('height', radius * 1.3)
              .style('pointer-events', 'none');
          } else {
            const radius = getNodeRadius(d.depth);
            const color = getNodeColor(d.depth);

            selection
              .append('circle')
              .attr('class', 'node-circle')
              .attr('r', radius)
              .attr('fill', color)
              .attr('stroke', '#333')
              .attr('stroke-width', 1);

            selection
              .append('text')
              .attr('class', 'node-label')
              .attr('fill', '#000')
              .attr('font-weight', '600')
              .attr('pointer-events', 'none')
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .text(name);
          }
        });

        group.append('title').text(d => d.data?.name ?? 'Node');

        if (onNodeEnter) {
          group.on('mouseenter', onNodeEnter);
        }
        if (onNodeMove) {
          group.on('mousemove', onNodeMove);
        }
        if (onNodeLeave) {
          group.on('mouseleave', onNodeLeave);
        }

        return group.transition().duration(300).style('opacity', 1);
      },
      update => update,
      exit => exit.transition().duration(200).style('opacity', 0).remove(),
    );

  node
    .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    .attr('filter', 'url(#node-shadow)')
    .on('mouseenter', onNodeEnter ?? null)
    .on('mousemove', onNodeMove ?? null)
    .on('mouseleave', onNodeLeave ?? null)
    .each(function (d: D3HierarchyNode) {
      const selection = d3.select(this);
      const name = d.data?.name ?? 'Node';
      const isFolderFox = d.depth === 0 && name === 'Folder Fox';
      const isIntegration = d.depth === 1 && LOGO_MAP[name];
      const radius = getNodeRadius(d.depth);

      if (isFolderFox || isIntegration) {
        const circle = selection.select<SVGCircleElement>('circle.node-circle');
        circle
          .attr('r', radius)
          .attr('fill', '#fff')
          .attr('stroke', '#ccc')
          .attr('stroke-width', 2);

        const image = selection.select<SVGImageElement>('image.node-logo');
        const imageSize = radius * 1.3;
        image
          .attr('href', LOGO_MAP[name])
          .attr('x', -imageSize / 2)
          .attr('y', -imageSize / 2)
          .attr('width', imageSize)
          .attr('height', imageSize)
          .style('pointer-events', 'none');

        selection.selectAll('text.node-label').remove();
      } else {
        const circle = selection.select<SVGCircleElement>('circle.node-circle');
        const style = colorAssignments?.get(getNodeId(d));
        const fillColor = style?.fill ?? getNodeColor(d.depth);

        circle
          .attr('r', radius)
          .attr('fill', fillColor)
          .attr('stroke', '#333')
          .attr('stroke-width', 1);

        let text = selection.select<SVGTextElement>('text.node-label');
        if (text.empty()) {
          text = selection
            .append('text')
            .attr('class', 'node-label');
        }

        ensureTextFits(text, name, radius, style?.textColor ?? '#000');
      }
    });
  return node;
}
