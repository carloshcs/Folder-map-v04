import * as d3 from 'd3';
import { type Edge, type Node } from 'reactflow';

import {
  HORIZONTAL_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  SNAP_SIZE,
  VERTICAL_GAP,
  type FoxNodeData,
  type FoxTreeNode,
} from './foxThreeConfig';

export const createFlowLayout = (tree: FoxTreeNode) => {
  const hierarchy = d3.hierarchy(tree, node => node.children ?? []);
  const layout = d3
    .tree<FoxTreeNode>()
    .nodeSize([HORIZONTAL_GAP, VERTICAL_GAP])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.4));

  const root = layout(hierarchy);
  const xValues = root.descendants().map(node => node.x);
  const minX = Math.min(...xValues);
  const offsetX = Math.abs(minX) + 80;

  const nodes: Array<Node<FoxNodeData>> = root.descendants().map(node => {
    const dataNode = node.data;
    const item = dataNode.item;

    return {
      id: dataNode.id,
      type: 'fox-folder',
      position: {
        x: node.x + offsetX,
        y: node.depth * VERTICAL_GAP + 32,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: {
        label: dataNode.name,
        depth: node.depth,
        metrics: item?.metrics,
        link: item?.link,
        createdDate: item?.createdDate,
        modifiedDate: item?.modifiedDate,
        activityScore: item?.activityScore,
        pathSegments: dataNode.pathSegments,
        serviceName: dataNode.serviceName ?? (node.depth === 1 ? dataNode.name : undefined),
        childrenCount: dataNode.children?.length ?? 0,
        serviceId: dataNode.serviceId,
      },
    };
  });

  const edges: Edge[] = root.links().map(link => ({
    id: `${link.source.data.id}__${link.target.data.id}`,
    source: link.source.data.id,
    target: link.target.data.id,
    animated: true,
  }));

  return { nodes, edges };
};

export const snapPosition = (value: number) => Math.round(value / SNAP_SIZE) * SNAP_SIZE;
