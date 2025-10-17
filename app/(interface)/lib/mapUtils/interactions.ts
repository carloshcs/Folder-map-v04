import type React from 'react';
import {
  D3DragEvent,
  Selection,
  drag,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3';

export const enableNodeDrag = <T extends SimulationNodeDatum>(
  simulation: Simulation<T, undefined>,
  nodeSelection: Selection<SVGGElement | SVGCircleElement, T, any, unknown>,
) => {
  const dragBehaviour = drag<SVGGElement | SVGCircleElement, T>()
    .on('start', (event: D3DragEvent<Element, T, T>, node) => {
      if (!event.active) {
        simulation.alphaTarget(0.3).restart();
      }

      node.fx = node.x ?? event.x;
      node.fy = node.y ?? event.y;
    })
    .on('drag', (event: D3DragEvent<Element, T, T>, node) => {
      node.fx = event.x;
      node.fy = event.y;
    })
    .on('end', (event: D3DragEvent<Element, T, T>, node) => {
      if (!event.active) {
        simulation.alphaTarget(0);
      }

      node.fx = null;
      node.fy = null;
    });

  nodeSelection.call(dragBehaviour as any);
};

interface ExpandableNode {
  id: string;
  children?: ExpandableNode[];
}

const collectDescendantIds = (node: ExpandableNode | undefined, accumulator: Set<string>) => {
  if (!node?.children?.length) {
    return;
  }

  node.children.forEach(child => {
    accumulator.add(child.id);
    collectDescendantIds(child, accumulator);
  });
};

export const handleNodeDoubleClick = <T extends ExpandableNode>(
  node: T,
  setExpandedState: React.Dispatch<React.SetStateAction<Set<string>>>,
) => {
  if (!node) {
    return;
  }

  setExpandedState(previous => {
    const next = new Set(previous);

    if (next.has(node.id)) {
      next.delete(node.id);
      const descendants = new Set<string>();
      collectDescendantIds(node, descendants);
      descendants.forEach(id => next.delete(id));
      return next;
    }

    next.add(node.id);
    return next;
  });
};
