import { getNodeRadius } from './geometry';
import type { NodePosition } from './types';

export type TooltipAnchor = {
  position: { x: number; y: number };
  screenRadius: number;
  baseRadius: number;
};

export type PerimeterTopResult = {
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

export const calculateNodePerimeterTop = ({
  nodeId,
  depth,
  nodePositions,
  zoomScale,
  canvasToScreen,
}: TooltipPositioningParams): PerimeterTopResult | null => {
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
      y: screenCenter.y - screenRadius,
    },
    screenRadius,
    baseRadius,
  };
};

export const getTooltipAnchorForNode = (
  params: TooltipPositioningParams,
): TooltipAnchor | null => {
  const perimeterTop = calculateNodePerimeterTop(params);

  if (!perimeterTop) {
    return null;
  }

  return {
    position: perimeterTop.anchor,
    screenRadius: perimeterTop.screenRadius,
    baseRadius: perimeterTop.baseRadius,
  };
};
