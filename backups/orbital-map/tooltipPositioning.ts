import { getNodeRadius } from './geometry';
import type { NodePosition } from './types';

export type TooltipAnchor = {
  position: { x: number; y: number };
  screenRadius: number;
  baseRadius: number;
};

export type NodeAnchorResult = {
  anchor: { x: number; y: number };
  screenRadius: number;
  baseRadius: number;
};

export interface TooltipPositioningParams {
  nodeId: string;
  depth: number;
  nodePositions: Map<string, NodePosition>;
  zoomScale: number;
  canvasToScreen: (point: { x: number; y: number }) => { x: number; y: number };
}

export const calculateNodeAnchor = ({
  nodeId,
  depth,
  nodePositions,
  zoomScale,
  canvasToScreen,
}: TooltipPositioningParams): NodeAnchorResult | null => {
  const nodePosition = nodePositions.get(nodeId);

  if (!nodePosition) {
    return null;
  }

  const screenCenter = canvasToScreen(nodePosition);
  const baseRadius = getNodeRadius(depth);
  const screenRadius = baseRadius * zoomScale;

  return {
    anchor: {
      x: screenCenter.x,
      y: screenCenter.y,
    },
    screenRadius,
    baseRadius,
  };
};

export const getTooltipAnchorForNode = (
  params: TooltipPositioningParams,
): TooltipAnchor | null => {
    // Try to measure the actual DOM element if available so zoom/pan/page-zoom are always reflected
  try {
    const selector = `[data-node-id="${params.nodeId}"]`;
    const elem = typeof document !== 'undefined' ? document.querySelector(selector) as (SVGGElement | null) : null;
    const circle = elem ? (elem.querySelector('circle.node-circle') as SVGGraphicsElement | null) : null;
    const measured = (circle ?? elem) as SVGGraphicsElement | null;
    if (measured && measured.getBoundingClientRect) {
      const rect = measured.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const baseRadius = getNodeRadius(params.depth);
      const screenRadius = Math.max(rect.width, rect.height) / 2;
      return {
        position: { x: cx, y: cy },
        screenRadius,
        baseRadius,
      };
    }
  } catch {}

  const nodeAnchor = calculateNodeAnchor(params);

  if (!nodeAnchor) {
    return null;
  }

  return {
    position: nodeAnchor.anchor,
    screenRadius: nodeAnchor.screenRadius,
    baseRadius: nodeAnchor.baseRadius,
  };
};
