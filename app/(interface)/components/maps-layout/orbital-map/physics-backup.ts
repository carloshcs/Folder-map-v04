// physics.ts - vis.js based (FIXED)

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
  // Convert hierarchy to vis.js format
  const visNodes = new DataSet<any>();
  const visEdges = new DataSet<any>();

  // Add nodes
  nodes.forEach(node => {
    const id = getNodeId(node);
    const existingPos = existingPositions.get(id);
    
    // Determine node properties based on depth
    let size = 16;
    let fixed = false;
    let level = node.depth;
    
    if (node.depth === 0) {
      size = 35;
      fixed = { x: true, y: true };
    } else if (node.depth === 1) {
      size = 28;
      level = 1;
    } else if (node.depth === 2) {
      size = 20;
      level = 2;
    }

    visNodes.add({
      id,
      label: node.data?.name || id,
      level,
      size,
      x: existingPos?.x ?? node.x ?? 0,
      y: existingPos?.y ?? node.y ?? 0,
      fixed: fixed,
      mass: node.depth === 0 ? 10 : node.depth === 1 ? 3 : 1,
      node: node, // Keep reference to original node
    });

    // Add edges (parent-child connections)
    if (node.parent) {
      const parentId = getNodeId(node.parent);
      visEdges.add({
        from: parentId,
        to: id,
        length: node.depth === 1 ? 200 : node.depth === 2 ? 150 : 100,
      });
    }
  });

  // Create container (hidden, just for physics)
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.width = '1px';
  container.style.height = '1px';
  document.body.appendChild(container);

  const data = { nodes: visNodes, edges: visEdges };
  
  const options = {
    physics: {
      enabled: true,
      solver: 'barnesHut',
      barnesHut: {
        gravitationalConstant: -8000,
        centralGravity: 0.1,
        springLength: 150,
        springConstant: 0.04,
        damping: 0.09,
        avoidOverlap: 1,
      },
      stabilization: {
        enabled: true,
        iterations: 200,
        updateInterval: 25,
      },
    },
    layout: {
      hierarchical: {
        enabled: false,
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
  };

  const network = new Network(container, data, options);

  // Sync positions on every physics update
  let animationId: number;
  
  const syncPositions = () => {
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
  };

  // Wait for stabilization before starting animation loop
  network.once('stabilizationIterationsDone', () => {
    syncPositions();
  });

  // Start immediately if already stabilized
  if (network.physics.stabilized) {
    syncPositions();
  }

  // Drag handlers
  function onDragStart(node: D3HierarchyNode) {
    const id = getNodeId(node);
    const visNode = visNodes.get(id);
    if (visNode) {
      visNodes.update({ id, fixed: { x: true, y: true } });
    }
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
    const visNode = visNodes.get(id);
    
    if (visNode && node.depth > 0) {
      visNodes.update({ id, fixed: false });
    }
    
    node.isDragging = false;
    
    // Restart physics briefly
    network.startSimulation();
  }

  return {
    stop: () => {
      cancelAnimationFrame(animationId);
      network.destroy();
      
      // Safe removal - check if container is still in DOM
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
    dragHandlers: { onDragStart, onDrag, onDragEnd },
  };
}