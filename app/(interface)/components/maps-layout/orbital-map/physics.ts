// physics.ts – Improved Vis.js Orbital Physics

import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { D3HierarchyNode, NodePosition } from './types';
import { INTEGRATION_NAMES } from './constants';
import { getNodeId } from './nodeUtils';

export function createManualPhysics(
  nodes: D3HierarchyNode[],
  onTick: () => void,
  existingPositions: Map<string, NodePosition>,
) {
  const visNodes = new DataSet<any>();
  const visEdges = new DataSet<any>();

  // Identify the root ("Folder Fox")
  const root = nodes.find(n => n?.depth === 0);

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
      const idx = INTEGRATION_NAMES.indexOf(node.data?.name || '');
      const angle = (2 * Math.PI / INTEGRATION_NAMES.length) * idx;
      const radius = 240;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
    }

    visNodes.add({
      id,
      label: node.data?.name ?? id,
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
  let animationId: number;
  function syncPositions() {
    const positions = network.getPositions();
    nodes.forEach(node => {
      const id = getNodeId(node);
      const pos = positions[id];
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
      }
    });
    onTick();
    animationId = requestAnimationFrame(syncPositions);
  }

  // Stop physics drift once stable
  network.once('stabilizationIterationsDone', () => {
    network.setOptions({ physics: false }); // freeze graph
    syncPositions();
  });

  // If already stable, just sync
  if (network.physics.stabilized) {
    network.setOptions({ physics: false });
    syncPositions();
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

    // Freeze again after new settle
    network.once('stabilized', () => {
      network.setOptions({ physics: false });
    });
  }

  return {
    stop: () => {
      cancelAnimationFrame(animationId);
      network.destroy();
      if (container.parentNode) container.parentNode.removeChild(container);
    },
    dragHandlers: { onDragStart, onDrag, onDragEnd },
  };
}
