//geometry
import { ORBITAL_RADII } from './constants';
import { D3HierarchyNode } from './types';

export function getOrbitalRadius(depth: number): number {
  return ORBITAL_RADII[depth] || ORBITAL_RADII[3];
}

const NODE_RADIUS_SCALE = 1.5;

export function getNodeRadius(depth: number): number {
  let baseRadius: number;

  if (depth === 0) {
    baseRadius = 47.5;
  } else if (depth === 1) {
    baseRadius = 38.75;
  } else if (depth === 2) {
    baseRadius = 43.75;
  } else {
    baseRadius = 37.5;
  }

  return baseRadius * NODE_RADIUS_SCALE;
}

export function calculateExpansionOffset(node: D3HierarchyNode, childCount: number): number {
  const childDepth = node.depth + 1;
  const childBaseRadius = getOrbitalRadius(childDepth);
  const childNodeRadius = getNodeRadius(childDepth);
  const childNodeDiameter = childNodeRadius * 2;
  const orbitSpacing = childNodeDiameter * 2.0;

  const estimatedOrbits = Math.ceil(childCount / 3);
  const outermostRadius = childBaseRadius + (estimatedOrbits - 1) * orbitSpacing;

  return outermostRadius + 80;
}

export function getReferenceAngle(parent: D3HierarchyNode): number {
  if (parent.parentNode) {
    const gpx = parent.parentNode.x ?? 0;
    const gpy = parent.parentNode.y ?? 0;
    const px = parent.x ?? 0;
    const py = parent.y ?? 0;
    return Math.atan2(py - gpy, px - gpx);
  }
  return parent.orbitAngle ?? 0;
}

export function checkCollision(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
  minDistance: number,
): boolean {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < minDistance;
}
