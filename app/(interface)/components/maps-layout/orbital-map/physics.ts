// Physics - Hybrid: Orbital for levels 0-2, Force-directed for 3+

import * as d3 from 'd3';
import { INTEGRATION_NAMES, RETURN_SPEED } from './constants';
import { calculateExpansionOffset, getOrbitalRadius } from './geometry';
import { positionChildNodes } from './positioning';
import { getNodeId } from './nodeUtils';
import { D3HierarchyNode, NodePosition } from './types';

// Extend D3HierarchyNode for force simulation
interface ForceNode extends D3HierarchyNode {
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export function createManualPhysics(
  nodes: D3HierarchyNode[],
  onTick: () => void,
  existingPositions: Map<string, NodePosition>,
) {
  // Setup root node (Folder Fox)
  const folderFox = nodes.find(n => n?.data?.name === 'Folder Fox');
  if (folderFox) {
    folderFox.x = 0;
    folderFox.y = 0;
    folderFox.isPrimary = true;
  }

  // Setup Level 1: Integrations (orbital)
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

  // Group nodes by depth
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

  // Position Level 2 nodes (orbital)
  if (depthGroups.has(2)) {
    const nodesAtDepth2 = depthGroups.get(2)!;
    const byParent = new Map<D3HierarchyNode, D3HierarchyNode[]>();

    nodesAtDepth2.forEach(node => {
      const parent = node.parent!;
      if (!byParent.has(parent)) {
        byParent.set(parent, []);
      }
      byParent.get(parent)!.push(node);
    });

    byParent.forEach((children, parent) => {
      const positionedNodes: { x: number; y: number }[] = [];
      positionChildNodes(children, parent, 2, existingPositions, positionedNodes);
    });
  }

  // Setup Level 3+ nodes with STATIC positioning (pyvis-style)
  const forceNodes = nodes.filter(n => n.depth >= 3);
  
  if (forceNodes.length > 0) {
    // Group nodes by parent AND depth for hierarchical positioning
    const level3Nodes = forceNodes.filter(n => n.depth === 3);
    const deeperNodes = forceNodes.filter(n => n.depth > 3);
    
    // Position level 3 nodes (children of level 2)
    const byParentL3 = new Map<D3HierarchyNode, D3HierarchyNode[]>();
    level3Nodes.forEach(node => {
      const parent = node.parent!;
      if (!byParentL3.has(parent)) {
        byParentL3.set(parent, []);
      }
      byParentL3.get(parent)!.push(node);
    });

    byParentL3.forEach((children, parent) => {
      const px = parent.x ?? 0;
      const py = parent.y ?? 0;
      const childCount = children.length;
      
      // Calculate radius based on number of children - increased spacing
      const baseRadius = 70;
      const circumference = childCount * 55;
      let calculatedRadius = Math.max(baseRadius, circumference / (2 * Math.PI));
      
      // Arrange in circle
      const angleStep = (2 * Math.PI) / childCount;
      const minNodeDistance = 50; // Minimum distance between siblings
      
      // Initial positioning
      children.forEach((child, i) => {
        const nodeId = getNodeId(child);
        const existingPos = existingPositions.get(nodeId);
        
        if (existingPos) {
          Object.assign(child, existingPos);
        } else {
          const angle = i * angleStep - Math.PI / 2;
          child.x = px + Math.cos(angle) * calculatedRadius;
          child.y = py + Math.sin(angle) * calculatedRadius;
          child.orbitAngle = angle;
          child.baseOrbitRadius = calculatedRadius;
        }
        
        child.targetX = child.x;
        child.targetY = child.y;
        child.isInOrbit = true;
        child.parentNode = parent;
      });
      
      // Check for sibling collisions and adjust radius if needed
      let hasCollision = true;
      let attempts = 0;
      while (hasCollision && attempts < 5) {
        hasCollision = false;
        
        for (let i = 0; i < children.length; i++) {
          for (let j = i + 1; j < children.length; j++) {
            const child1 = children[i];
            const child2 = children[j];
            const dx = child1.x! - child2.x!;
            const dy = child1.y! - child2.y!;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minNodeDistance) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) break;
        }
        
        if (hasCollision) {
          // Increase radius by 20% and recalculate positions
          calculatedRadius *= 1.2;
          children.forEach((child, i) => {
            const angle = i * angleStep - Math.PI / 2;
            child.x = px + Math.cos(angle) * calculatedRadius;
            child.y = py + Math.sin(angle) * calculatedRadius;
            child.baseOrbitRadius = calculatedRadius;
            child.targetX = child.x;
            child.targetY = child.y;
          });
        }
        
        attempts++;
      }
    });

    // Position level 4+ nodes (orbit around their level 3+ parents)
    const byParentDeep = new Map<D3HierarchyNode, D3HierarchyNode[]>();
    deeperNodes.forEach(node => {
      const parent = node.parent!;
      if (!byParentDeep.has(parent)) {
        byParentDeep.set(parent, []);
      }
      byParentDeep.get(parent)!.push(node);
    });

    byParentDeep.forEach((children, parent) => {
      const px = parent.x ?? 0;
      const py = parent.y ?? 0;
      const childCount = children.length;
      
      // Smaller orbit for deeper levels - increased spacing
      const baseRadius = 50;
      const circumference = childCount * 45;
      let calculatedRadius = Math.max(baseRadius, circumference / (2 * Math.PI));
      
      const angleStep = (2 * Math.PI) / childCount;
      const minNodeDistance = 45;
      
      // Initial positioning
      children.forEach((child, i) => {
        const nodeId = getNodeId(child);
        const existingPos = existingPositions.get(nodeId);
        
        if (existingPos) {
          Object.assign(child, existingPos);
        } else {
          const angle = i * angleStep - Math.PI / 2;
          child.x = px + Math.cos(angle) * calculatedRadius;
          child.y = py + Math.sin(angle) * calculatedRadius;
          child.orbitAngle = angle;
          child.baseOrbitRadius = calculatedRadius;
        }
        
        child.targetX = child.x;
        child.targetY = child.y;
        child.isInOrbit = true;
        child.parentNode = parent;
      });
      
      // Check for sibling collisions
      let hasCollision = true;
      let attempts = 0;
      while (hasCollision && attempts < 5) {
        hasCollision = false;
        
        for (let i = 0; i < children.length; i++) {
          for (let j = i + 1; j < children.length; j++) {
            const child1 = children[i];
            const child2 = children[j];
            const dx = child1.x! - child2.x!;
            const dy = child1.y! - child2.y!;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minNodeDistance) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) break;
        }
        
        if (hasCollision) {
          calculatedRadius *= 1.2;
          children.forEach((child, i) => {
            const angle = i * angleStep - Math.PI / 2;
            child.x = px + Math.cos(angle) * calculatedRadius;
            child.y = py + Math.sin(angle) * calculatedRadius;
            child.baseOrbitRadius = calculatedRadius;
            child.targetX = child.x;
            child.targetY = child.y;
          });
        }
        
        attempts++;
      }
    });
  }

  let animationId: number;

  function animate() {
    // Animate all orbital nodes (levels 1-2 and 3+)
    nodes.forEach(node => {
      if (!node.isInOrbit) return;
      if (node.depth === 0) return;
      if (node.isDragging) return;

      if (node.depth === 1) {
        // Level 1: Orbit around Folder Fox
        const cx = folderFox?.x ?? 0;
        const cy = folderFox?.y ?? 0;
        const radius = getOrbitalRadius(1);

        node.targetX = cx + Math.cos(node.orbitAngle!) * radius;
        node.targetY = cy + Math.sin(node.orbitAngle!) * radius;
      } else if (node.depth === 2) {
        // Level 2: Orbit around integrations with expansion offset
        const parent = node.parentNode;
        if (!parent) return;

        const px = parent.x ?? 0;
        const py = parent.y ?? 0;
        const referenceAngle = parent.orbitAngle ?? 0;

        node.orbitAngle = node.orbitAngle ?? referenceAngle;

        let effectiveRadius = node.baseOrbitRadius || node.calculatedRadius || getOrbitalRadius(node.depth);

        // If this level 2 node is expanded, push it outward
        if (node.isExpanded && node.hasChildren) {
          if (node.expansionOffset === undefined) {
            // Calculate how much space the children need
            const childCount = node.children?.length || 3;
            const childCircumference = childCount * 55; // Space per child
            const childRadius = Math.max(70, childCircumference / (2 * Math.PI));
            // Push parent out by child orbit radius + buffer (increased by 20%)
            node.expansionOffset = (childRadius + 30) * 1.2;
          }
          effectiveRadius = node.baseOrbitRadius! + node.expansionOffset;
        } else if (!node.isExpanded && node.expansionOffset !== undefined) {
          node.expansionOffset = undefined;
          effectiveRadius = node.baseOrbitRadius!;
        }

        const angle = referenceAngle + (node.offsetAngle || 0);
        node.targetX = px + Math.cos(angle) * effectiveRadius;
        node.targetY = py + Math.sin(angle) * effectiveRadius;
      } else if (node.depth >= 3) {
        // Level 3+: Orbit around their parent with expansion offset and collision avoidance
        const parent = node.parentNode;
        if (!parent) return;

        const px = parent.x ?? 0;
        const py = parent.y ?? 0;
        let radius = node.baseOrbitRadius || 50;
        
        // If this node is expanded and has children, push it outward
        if (node.isExpanded && node.hasChildren) {
          if (node.expansionOffset === undefined) {
            const childCount = node.children?.length || 3;
            const childCircumference = childCount * 45;
            const childRadius = Math.max(50, childCircumference / (2 * Math.PI));
            // Increased by 20%
            node.expansionOffset = (childRadius + 25) * 1.2;
          }
          radius = node.baseOrbitRadius! + node.expansionOffset;
        } else if (!node.isExpanded && node.expansionOffset !== undefined) {
          node.expansionOffset = undefined;
          radius = node.baseOrbitRadius!;
        }
        
        const angle = node.orbitAngle || 0;
        let targetX = px + Math.cos(angle) * radius;
        let targetY = py + Math.sin(angle) * radius;

        // Collision avoidance: check if expanding toward grandparent
        if (node.isExpanded && parent.parentNode) {
          const grandparent = parent.parentNode;
          const gpx = grandparent.x ?? 0;
          const gpy = grandparent.y ?? 0;
          
          // Vector from grandparent to this node
          const dx = targetX - gpx;
          const dy = targetY - gpy;
          const distToGrandparent = Math.sqrt(dx * dx + dy * dy);
          
          // Grandparent's orbit radius + safety margin
          const grandparentOrbitRadius = parent.calculatedRadius || parent.baseOrbitRadius || getOrbitalRadius(parent.depth);
          const minSafeDistance = grandparentOrbitRadius - 40; // Keep children away from grandparent orbit
          
          // If too close to grandparent, push parent further out
          if (distToGrandparent < minSafeDistance) {
            const pushAmount = (minSafeDistance - distToGrandparent) + 30;
            // Push parent away from grandparent
            if (parent.parentNode && parent.baseOrbitRadius) {
              parent.baseOrbitRadius += pushAmount;
              // Recalculate parent position
              const parentAngle = parent.orbitAngle || 0;
              const parentRefAngle = parent.parentNode.orbitAngle || 0;
              const parentRadius = parent.baseOrbitRadius + (parent.expansionOffset || 0);
              parent.targetX = (parent.parentNode.x ?? 0) + Math.cos(parentRefAngle + (parent.offsetAngle || 0)) * parentRadius;
              parent.targetY = (parent.parentNode.y ?? 0) + Math.sin(parentRefAngle + (parent.offsetAngle || 0)) * parentRadius;
              
              // Recalculate this node's position based on new parent position
              targetX = parent.targetX! + Math.cos(angle) * radius;
              targetY = parent.targetY! + Math.sin(angle) * radius;
            }
          }
        }

        node.targetX = targetX;
        node.targetY = targetY;
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
    } else if (node.depth === 2) {
      const parent = node.parentNode;
      if (!parent) return;

      const px = parent.x ?? 0;
      const py = parent.y ?? 0;
      const radius = node.calculatedRadius || getOrbitalRadius(node.depth);
      const angle = parent.orbitAngle! + (node.offsetAngle || 0);

      node.targetX = px + Math.cos(angle) * radius;
      node.targetY = py + Math.sin(angle) * radius;
    } else {
      // Level 3+: Maintain orbit around parent
      const parent = node.parentNode;
      if (!parent) return;

      const px = parent.x ?? 0;
      const py = parent.y ?? 0;
      const radius = node.baseOrbitRadius || 50;
      const angle = node.orbitAngle || 0;

      node.targetX = px + Math.cos(angle) * radius;
      node.targetY = py + Math.sin(angle) * radius;
    }
  }

  return {
    stop: () => {
      cancelAnimationFrame(animationId);
    },
    dragHandlers: { onDragStart, onDrag, onDragEnd },
  };
}