import { calculateExpansionOffset, checkCollision, getOrbitalRadius, getReferenceAngle, getNodeRadius } from './geometry';
import { getNodeId } from './nodeUtils';
import { D3HierarchyNode, NodePosition } from './types';

export function positionChildNodes(
  children: D3HierarchyNode[],
  parent: D3HierarchyNode,
  depth: number,
  existingPositions: Map<string, NodePosition>,
  positionedNodes: { x: number; y: number }[],
) {
  const childCount = children.length;
  const baseRadius = getOrbitalRadius(depth);
  const nodeRadius = getNodeRadius(depth);
  const nodeDiameter = nodeRadius * 2;
  const minSpacing = nodeDiameter * 1.4;
  const spreadAngle = Math.PI * 0.75;

  const referenceAngle = getReferenceAngle(parent);

  const expansionOffset = parent.depth >= 3 && parent.isExpanded && parent.hasChildren
    ? calculateExpansionOffset(parent, childCount)
    : 0;

  parent.expansionOffset = expansionOffset;
  parent.baseOrbitRadius = parent.baseOrbitRadius ?? baseRadius;

  const allChildrenHavePositions = children.every(child => {
    const nodeId = getNodeId(child);
    return existingPositions.has(nodeId);
  });

  if (allChildrenHavePositions) {
    children.forEach(child => {
      const nodeId = getNodeId(child);
      const existingPos = existingPositions.get(nodeId)!;

      child.parentNode = parent;
      child.isInOrbit = true;
      Object.assign(child, existingPos, { targetX: existingPos.x, targetY: existingPos.y });
      positionedNodes.push({ x: child.x!, y: child.y! });
    });
    return;
  }

  const baseOrbitSpacing = nodeDiameter * 1.8;

  function getOrbitCapacity(orbitRadius: number): number {
    const arcLength = orbitRadius * spreadAngle;
    const nodesCanFit = Math.floor(arcLength / minSpacing);
    return Math.max(1, nodesCanFit);
  }

  const orbits: { radius: number; nodes: D3HierarchyNode[] }[] = [];
  let childIndex = 0;
  let orbitIndex = 0;

  while (childIndex < childCount) {
    const orbitRadius = baseRadius + orbitIndex * baseOrbitSpacing;
    const orbitCapacity = getOrbitCapacity(orbitRadius);
    const nodesForThisOrbit = Math.min(orbitCapacity, childCount - childIndex);

    orbits.push({
      radius: orbitRadius,
      nodes: children.slice(childIndex, childIndex + nodesForThisOrbit),
    });

    childIndex += nodesForThisOrbit;
    orbitIndex++;
  }

  orbits.forEach((orbit, orbitIdx) => {
    const orbitRadius = orbit.radius;
    const nodesInOrbit = orbit.nodes.length;
    const isOddOrbit = orbitIdx % 2 === 1;

    const px = parent.x ?? 0;
    const py = parent.y ?? 0;

    if (nodesInOrbit === 1) {
      const child = orbit.nodes[0];
      const nodeId = getNodeId(child);
      const existingPos = existingPositions.get(nodeId);

      child.parentNode = parent;
      child.isInOrbit = true;

      if (existingPos) {
        Object.assign(child, existingPos, { targetX: existingPos.x, targetY: existingPos.y });
      } else {
        child.orbitAngle = referenceAngle;
        child.offsetAngle = 0;

        let finalRadius = orbitRadius;
        let finalX = px + Math.cos(referenceAngle) * finalRadius;
        let finalY = py + Math.sin(referenceAngle) * finalRadius;

        for (let attempt = 0; attempt < 20; attempt++) {
          const hasCollision = positionedNodes.some(pos =>
            checkCollision({ x: finalX, y: finalY }, pos, minSpacing),
          );
          if (!hasCollision) break;
          finalRadius += 5;
          finalX = px + Math.cos(referenceAngle) * finalRadius;
          finalY = py + Math.sin(referenceAngle) * finalRadius;
        }

        Object.assign(child, {
          calculatedRadius: finalRadius,
          baseOrbitRadius: finalRadius,
          targetX: finalX,
          targetY: finalY,
          x: finalX,
          y: finalY,
        });
      }

      positionedNodes.push({ x: child.x!, y: child.y! });
    } else {
      const totalAngle = spreadAngle * 0.9;
      const angleIncrement = totalAngle / (nodesInOrbit - 1);
      const staggerOffset = isOddOrbit ? angleIncrement / 2 : 0;
      const startAngle = -totalAngle / 2 + staggerOffset;

      orbit.nodes.forEach((child, colIdx) => {
        const nodeId = getNodeId(child);
        const existingPos = existingPositions.get(nodeId);
        const offsetAngle = startAngle + colIdx * angleIncrement;

        child.parentNode = parent;
        child.isInOrbit = true;

        if (existingPos) {
          Object.assign(child, existingPos, { targetX: existingPos.x, targetY: existingPos.y });
        } else {
          child.orbitAngle = referenceAngle;
          child.offsetAngle = offsetAngle;

          const angle = referenceAngle + offsetAngle;
          let finalRadius = orbitRadius;
          let finalX = px + Math.cos(angle) * finalRadius;
          let finalY = py + Math.sin(angle) * finalRadius;

          for (let attempt = 0; attempt < 20; attempt++) {
            const hasCollision = positionedNodes.some(pos =>
              checkCollision({ x: finalX, y: finalY }, pos, minSpacing),
            );
            if (!hasCollision) break;
            finalRadius += 5;
            finalX = px + Math.cos(angle) * finalRadius;
            finalY = py + Math.sin(angle) * finalRadius;
          }

          Object.assign(child, {
            calculatedRadius: finalRadius,
            baseOrbitRadius: finalRadius,
            targetX: finalX,
            targetY: finalY,
            x: finalX,
            y: finalY,
          });
        }

        positionedNodes.push({ x: child.x!, y: child.y! });
      });
    }
  });
}
