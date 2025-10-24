//rendering
import * as d3 from 'd3';
import { LOGO_MAP } from './constants';
import { getNodeColor, getNodeId } from './nodeUtils';
import { getNodeRadius } from './geometry';
import { D3HierarchyNode } from './types';
import { getReadableTextColor, shiftColor } from '../../../lib/utils/colors';

interface RenderNodeOptions {
  integrationColorMap: Map<string, string>;
  colorPaletteId?: string | null;
}

const FOX_FILL = '#fde68a';
const FOX_STROKE = '#f97316';
const INTEGRATION_BORDER = '#cbd5f5';

function getIntegrationAncestorName(node: D3HierarchyNode | undefined): string | null {
  let current = node;
  while (current) {
    if (current.depth === 1 && current.data?.name) {
      return current.data.name;
    }
    current = current.parent;
  }
  return null;
}

function getPaletteFill(node: D3HierarchyNode, options: RenderNodeOptions): string {
  const integrationName = getIntegrationAncestorName(node);
  if (!integrationName) {
    return '#e2e8f0';
  }

  const baseColor = options.integrationColorMap.get(integrationName) ?? '#475569';
  if (node.depth <= 2) {
    return baseColor;
  }

  const shiftAmount = Math.min(0.32, (node.depth - 2) * 0.08);
  return shiftColor(baseColor, shiftAmount);
}

function buildLabelLines(label: string, maxChars: number, maxLines: number): string[] {
  const sanitized = label.replace(/\./g, '. ');
  const tokens = sanitized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [label];

  const lines: string[] = [];
  let currentLine = '';

  const pushLine = (line: string) => {
    if (lines.length < maxLines) {
      lines.push(line);
    }
  };

  for (const token of tokens) {
    if (lines.length === maxLines) break;
    const appended = currentLine ? `${currentLine} ${token}` : token;

    if (appended.length <= maxChars) {
      currentLine = appended;
      continue;
    }

    if (currentLine) {
      pushLine(currentLine);
      currentLine = '';
      if (lines.length === maxLines) break;
    }

    if (token.length > maxChars) {
      const chunks = token.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? [token];
      for (const chunk of chunks) {
        if (lines.length === maxLines) break;
        pushLine(chunk);
      }
    } else {
      currentLine = token;
    }
  }

  if (lines.length < maxLines && currentLine) {
    pushLine(currentLine);
  }

  if (tokens.length && lines.length === maxLines) {
    const original = label.trim();
    const combinedLines = lines.join(' ');
    if (combinedLines.length < original.length) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/…?$/, '') + '…';
    }
  }

  return lines.length ? lines : [label];
}

export function renderNodes(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  visibleNodes: D3HierarchyNode[],
  options: RenderNodeOptions = { integrationColorMap: new Map(), colorPaletteId: null },
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
          .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);

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
              .attr('fill', isFolderFox ? FOX_FILL : '#ffffff')
              .attr('stroke', isFolderFox ? FOX_STROKE : INTEGRATION_BORDER)
              .attr('stroke-width', isFolderFox ? 3 : 2)
              .attr('filter', isFolderFox ? 'url(#fox-glow)' : null);

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
            const color = d.depth >= 2 ? getPaletteFill(d, options) : getNodeColor(d.depth);
            const strokeColor = shiftColor(color, -0.12);
            const textColor = getReadableTextColor(color);

            selection
              .append('circle')
              .attr('r', radius)
              .attr('fill', color)
              .attr('stroke', strokeColor)
              .attr('stroke-width', 1.5);

            const maxChars = Math.max(8, Math.floor(radius * 0.9));
            const lines = buildLabelLines(name, maxChars, 2);
            const fontSize = Math.max(8, Math.min(13, radius * 0.46));
            const lineHeight = 1.1;
            const startDy =
              lines.length === 1 ? '0.35em' : `${-((lines.length - 1) / 2) * lineHeight}em`;

            const text = selection
              .append('text')
              .attr('text-anchor', 'middle')
              .attr('font-size', fontSize)
              .attr('fill', textColor)
              .attr('font-weight', '500')
              .attr('pointer-events', 'none');

            text
              .selectAll('tspan')
              .data(lines)
              .join('tspan')
              .attr('x', 0)
              .attr('dy', (_, index) => (index === 0 ? startDy : `${lineHeight}em`))
              .text(line => line);
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
