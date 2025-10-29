// physics.ts – Improved Vis.js Orbital Physics

import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { D3HierarchyNode, NodePosition } from './types';
import { INTEGRATION_NAMES } from './constants';
import { getNodeId, getNodeLineage } from './nodeUtils';

export type PhysicsTickPayload = {
  nodes: D3HierarchyNode[];
  positions: Map<string, NodePosition>;
  isStabilized: boolean;
};

export function createManualPhysics(
  nodes: D3HierarchyNode[],
  onTick: (payload: PhysicsTickPayload) => void,
  existingPositions: Map<string, NodePosition>,
) {
  const visNodes = new DataSet<any>();
  const visEdges = new DataSet<any>();

  // Identify the root ("Folder Fox")
  const root = nodes.find(n => n?.depth === 0);

  const levelOneNodes = nodes.filter(node => node.depth === 1);
  const preferredOrder = new Map<string, number>();
  INTEGRATION_NAMES.forEach((name, index) => {
    preferredOrder.set(name, index);
  });

  const sortedLevelOneNodes = levelOneNodes
    .slice()
    .sort((a, b) => {
      const aName = a.data?.name ?? '';
      const bName = b.data?.name ?? '';
      const aIndex = preferredOrder.has(aName)
        ? preferredOrder.get(aName)!
        : INTEGRATION_NAMES.length + levelOneNodes.indexOf(a);
      const bIndex = preferredOrder.has(bName)
        ? preferredOrder.get(bName)!
        : INTEGRATION_NAMES.length + levelOneNodes.indexOf(b);

      return aIndex - bIndex;
    });

  const levelOneIndexById = new Map<string, number>();
  sortedLevelOneNodes.forEach((node, index) => {
    levelOneIndexById.set(getNodeId(node), index);
  });

  // Build vis.js node + edge dataset
  nodes.forEach(node => {
    const id = getNodeId(node);
    const existingPos = existingPositions.get(id);

    // Visual size + fixed state
    let size = 20;
    let fixed: any = false;
    let level = node.depth;
    let mass = 1;

    if (node.depth === 0) {
      size = 44;
      fixed = { x: true, y: true };
      mass = 10;
    } else if (node.depth === 1) {
      size = 35;
      mass = 3;
      level = 1;
    } else if (node.depth === 2) {
      size = 25;
      level = 2;
    }

    // Optional manual orbital placement for Level 1
    let x = existingPos?.x ?? node.x ?? 0;
    let y = existingPos?.y ?? node.y ?? 0;
    if (node.depth === 0) {
      x = 0;
      y = 0;
    } else if (node.depth === 1 && root) {
      const levelOneIndex = levelOneIndexById.get(id) ?? 0;
      const totalLevelOne = Math.max(sortedLevelOneNodes.length, 1);
      const angle = (2 * Math.PI / totalLevelOne) * levelOneIndex;
      const radius = 240;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
    }

    const labelLineage = getNodeLineage(node);
    const label = labelLineage.length > 0 ? labelLineage.join(' / ') : node.data?.name ?? id;

    visNodes.add({
      id,
      label,
      size,
      mass,
      level,
      x,
      y,
      fixed,
      node, // reference to original hierarchy node
    });

    // Add parent-edge
    if (node.parent) {
      const parentId = getNodeId(node.parent);
      visEdges.add({
        from: parentId,
        to: id,
        length: node.depth === 1 ? 260 :
                node.depth === 2 ? 200 : 140,
      });
    }
  });

  // Container (off-screen)
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.width = '1px';
  container.style.height = '1px';
  document.body.appendChild(container);

  const data = { nodes: visNodes, edges: visEdges };

  // Optimized physics config
  const options = {
    physics: {
      enabled: true,
      solver: 'barnesHut',
      barnesHut: {
        gravitationalConstant: -5000,
        centralGravity: 0.4,
        springLength: 160,
        springConstant: 0.03,
        damping: 0.12,
        avoidOverlap: 1,
      },
      stabilization: {
        enabled: true,
        iterations: 300,
        updateInterval: 25,
      },
    },
    nodes: {
      shape: 'dot',
    },
    edges: {
      smooth: {
        enabled: false,
      },
    },
    layout: {
      hierarchical: { enabled: false },
    },
  };

  const network = new Network(container, data, options);

  // Animation: sync vis.js positions back to d3 nodes
  let animationId: number | null = null;
  let isStabilized = false;

  function syncPositions() {
    const positions = network.getPositions();
    existingPositions.clear();

    nodes.forEach(node => {
      const id = getNodeId(node);
      const pos = positions[id];
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
      }

      existingPositions.set(id, {
        x: node.x ?? 0,
        y: node.y ?? 0,
        baseOrbitRadius: node.baseOrbitRadius ?? 0,
        calculatedRadius: node.calculatedRadius ?? 0,
        offsetAngle: node.offsetAngle ?? 0,
        orbitAngle: node.orbitAngle ?? 0,
      });
    });

    onTick({
      nodes,
      positions: existingPositions,
      isStabilized,
    });

    animationId = requestAnimationFrame(syncPositions);
  }

  syncPositions();

  // Stop physics drift once stable
  network.once('stabilizationIterationsDone', () => {
    isStabilized = true;
    network.setOptions({ physics: false }); // freeze graph
  });

  // If already stable, just sync
  if (network.physics.stabilized) {
    isStabilized = true;
    network.setOptions({ physics: false });
  }

  // ----- Drag Handlers -----
  function onDragStart(node: D3HierarchyNode) {
    const id = getNodeId(node);
    visNodes.update({ id, fixed: { x: true, y: true } });
    node.isDragging = true;
  }

  function onDrag(node: D3HierarchyNode, x: number, y: number) {
    const id = getNodeId(node);
    visNodes.update({ id, x, y });
    node.x = x;
    node.y = y;
  }

  function onDragEnd(node: D3HierarchyNode) {
    const id = getNodeId(node);
    visNodes.update({ id, fixed: false });
    node.isDragging = false;

    // Maintain orbit logic: update angle relative to parent
    if (node.parent && node.x != null && node.y != null) {
      const px = node.parent.x ?? 0;
      const py = node.parent.y ?? 0;
      node.orbitAngle = Math.atan2(node.y - py, node.x - px);
    }

    network.setOptions({ physics: true });
    network.startSimulation();

    isStabilized = false;

    // Freeze again after new settle
    network.once('stabilized', () => {
      isStabilized = true;
      network.setOptions({ physics: false });
    });
  }

  return {
    stop: () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
      network.destroy();
      if (container.parentNode) container.parentNode.removeChild(container);
    },
    dragHandlers: { onDragStart, onDrag, onDragEnd },
  };
}
