import { INTEGRATION_NAMES, RETURN_SPEED } from './constants';
import { calculateExpansionOffset, getOrbitalRadius } from './geometry';
import { positionChildNodes } from './positioning';
import { getNodeId } from './nodeUtils';
import { D3HierarchyNode, NodePosition } from './types';

export function createManualPhysics(
  nodes: D3HierarchyNode[],
  onTick: () => void,
  existingPositions: Map<string, NodePosition>,
) {
  const folderFox = nodes.find(n => n?.data?.name === 'Folder Fox');

  if (folderFox) {
    folderFox.x = 0;
    folderFox.y = 0;
    folderFox.isPrimary = true;
  }

  const integrations = nodes.filter(
    n => n?.parent === folderFox && INTEGRATION_NAMES.includes(n?.data?.name),
  );

  const integrationsCount = integrations.length || 1;
  const integrationAngleStep = (2 * Math.PI) / integrationsCount;

  integrations.forEach((node, i) => {
    const angle = i * integrationAngleStep - Math.PI / 2;
    const radius = getOrbitalRadius(1);
    const cx = folderFox?.x ?? 0;
    const cy = folderFox?.y ?? 0;

    Object.assign(node, {
      orbitAngle: angle,
      depth: 1,
      isInOrbit: true,
      targetX: cx + Math.cos(angle) * radius,
      targetY: cy + Math.sin(angle) * radius,
    });
    node.x = node.targetX;
    node.y = node.targetY;
  });

  const depthGroups = new Map<number, D3HierarchyNode[]>();
  nodes.forEach(node => {
    if (node.depth >= 2) {
      if (!depthGroups.has(node.depth)) {
        depthGroups.set(node.depth, []);
      }
      depthGroups.get(node.depth)!.push(node);
    }
  });

  const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

  sortedDepths.forEach(depth => {
    const nodesAtDepth = depthGroups.get(depth)!;
    const byParent = new Map<D3HierarchyNode, D3HierarchyNode[]>();

    nodesAtDepth.forEach(node => {
      const parent = node.parent!;
      if (!byParent.has(parent)) {
        byParent.set(parent, []);
      }
      byParent.get(parent)!.push(node);
    });

    byParent.forEach((children, parent) => {
      const positionedNodes: { x: number; y: number }[] = [];

      const existingNodes: D3HierarchyNode[] = [];
      const newNodes: D3HierarchyNode[] = [];

      children.forEach(child => {
        const nodeId = getNodeId(child);
        if (existingPositions.has(nodeId)) {
          existingNodes.push(child);
        } else {
          newNodes.push(child);
        }
      });

      existingNodes.forEach(child => {
        const nodeId = getNodeId(child);
        const existingPos = existingPositions.get(nodeId)!;

        child.parentNode = parent;
        child.isInOrbit = true;
        Object.assign(child, existingPos, { targetX: existingPos.x, targetY: existingPos.y });
        positionedNodes.push({ x: child.x!, y: child.y! });
      });

      if (newNodes.length > 0) {
        positionChildNodes(newNodes, parent, depth, existingPositions, positionedNodes);
      }
    });
  });

  let animationId: number;

  function animate() {
    nodes.forEach(node => {
      if (!node.isInOrbit) return;
      if (node.depth === 0) return;
      if (node.isDragging) return;

      if (node.depth === 1) {
        const cx = folderFox?.x ?? 0;
        const cy = folderFox?.y ?? 0;
        const radius = getOrbitalRadius(1);

        node.targetX = cx + Math.cos(node.orbitAngle!) * radius;
        node.targetY = cy + Math.sin(node.orbitAngle!) * radius;
      } else {
        const parent = node.parentNode;
        if (!parent) return;

        const px = parent.x ?? 0;
        const py = parent.y ?? 0;
        const referenceAngle = parent.orbitAngle ?? 0;

        node.orbitAngle = node.orbitAngle ?? referenceAngle;

        let effectiveRadius = node.baseOrbitRadius || node.calculatedRadius || getOrbitalRadius(node.depth);

        if (node.depth >= 3) {
          if (node.isExpanded && node.hasChildren) {
            if (node.expansionOffset === undefined) {
              node.expansionOffset = calculateExpansionOffset(node, 3) * 0.7;
            }
            effectiveRadius = node.baseOrbitRadius! + node.expansionOffset;
          } else if (!node.isExpanded && node.expansionOffset !== undefined) {
            node.expansionOffset = undefined;
            effectiveRadius = node.baseOrbitRadius!;
          }
        }

        const angle = referenceAngle + (node.offsetAngle || 0);
        node.targetX = px + Math.cos(angle) * effectiveRadius;
        node.targetY = py + Math.sin(angle) * effectiveRadius;
      }

      node.x! += (node.targetX! - node.x!) * RETURN_SPEED;
      node.y! += (node.targetY! - node.y!) * RETURN_SPEED;
    });

    onTick();
    animationId = requestAnimationFrame(animate);
  }

  animate();

  function onDragStart(node: D3HierarchyNode) {
    if (node.depth === 0) return;
    node.isDragging = true;
  }

  function onDrag(node: D3HierarchyNode, x: number, y: number) {
    if (node.depth === 0) return;
    node.x = x;
    node.y = y;
  }

  function onDragEnd(node: D3HierarchyNode) {
    if (node.depth === 0) return;
    node.isDragging = false;

    if (node.depth === 1) {
      const cx = folderFox?.x ?? 0;
      const cy = folderFox?.y ?? 0;
      const radius = getOrbitalRadius(1);

      node.targetX = cx + Math.cos(node.orbitAngle!) * radius;
      node.targetY = cy + Math.sin(node.orbitAngle!) * radius;
    } else {
      const parent = node.parentNode;
      if (!parent) return;

      const px = parent.x ?? 0;
      const py = parent.y ?? 0;
      const radius = node.calculatedRadius || getOrbitalRadius(node.depth);
      const angle = parent.orbitAngle! + (node.offsetAngle || 0);

      node.targetX = px + Math.cos(angle) * radius;
      node.targetY = py + Math.sin(angle) * radius;
    }
  }

  return {
    stop: () => cancelAnimationFrame(animationId),
    dragHandlers: { onDragStart, onDrag, onDragEnd },
  };
}
