import { getNodeRadius } from './geometry';
import type { NodePosition } from './types';

export type TooltipAnchor = {
  position: { x: number; y: number };
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
}: TooltipPositioningParams): TooltipAnchor | null => {
  const nodePosition = nodePositions.get(nodeId);

  if (!nodePosition) {
    return null;
  }

  const screenCenter = canvasToScreen(nodePosition);
  const baseRadius = getNodeRadius(depth);
  const screenRadius = baseRadius * zoomScale;

  return {
    position: {
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
  const nodeAnchor = calculateNodeAnchor(params);

  if (!nodeAnchor) {
    return null;
  }

  return nodeAnchor;
};
