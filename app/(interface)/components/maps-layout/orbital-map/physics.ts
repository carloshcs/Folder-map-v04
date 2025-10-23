// Physics - Hybrid: Orbital for levels 0-2, Force-directed for 3+

import * as d3 from 'd3';
import { INTEGRATION_NAMES, RETURN_SPEED } from './constants';
import { getOrbitalRadius } from './geometry';
import { positionChildNodes } from './positioning';
import { getNodeId } from './nodeUtils';
import { D3HierarchyNode, NodePosition } from './types';

const LEVEL_2_BASE_RADIUS = 120;

// Smoother animation constants
const ORBITAL_RETURN_SPEED = 0.15; // Increase from typical 0.05-0.1
const RADIUS_TRANSITION_SPEED = 0.08; // Smooth radius changes
const DRAG_DAMPING = 0.92; // Momentum after drag release

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
      vx: 0, // Add velocity for momentum
      vy: 0,
    });
    node.x = node.targetX;
    node.y = node.targetY;
  });

  // Position Level 2 nodes (orbital)
  const level2Nodes = nodes.filter(n => n.depth === 2);
  const byParentL2 = new Map<D3HierarchyNode, D3HierarchyNode[]>();
  
  level2Nodes.forEach(node => {
    const parent = node.parent!;
    if (!byParentL2.has(parent)) {
      byParentL2.set(parent, []);
    }
    byParentL2.get(parent)!.push(node);
    
    // Initialize velocity
    node.vx = node.vx ?? 0;
    node.vy = node.vy ?? 0;
  });

  byParentL2.forEach((children, parent) => {
    const positionedNodes: { x: number; y: number }[] = [];
    positionChildNodes(children, parent, 2, existingPositions, positionedNodes);
    
    children.forEach(child => {
      if (!child.baseOrbitRadius || child.baseOrbitRadius < LEVEL_2_BASE_RADIUS) {
        child.baseOrbitRadius = LEVEL_2_BASE_RADIUS;
      }
      // Track current effective radius for smooth transitions
      child.currentEffectiveRadius = child.baseOrbitRadius;
    });
  });

  // Setup Level 3+ nodes with D3 FORCE simulation
  const forceNodes = nodes.filter(n => n.depth >= 3);
  let forceSimulation: d3.Simulation<D3HierarchyNode, undefined> | null = null;
  
  if (forceNodes.length > 0) {
    // Initialize positions for new nodes
    forceNodes.forEach(node => {
      const nodeId = getNodeId(node);
      const existingPos = existingPositions.get(nodeId);
      
      if (existingPos) {
        node.x = existingPos.x;
        node.y = existingPos.y;
      } else if (node.parent) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 60 + Math.random() * 40;
        node.x = (node.parent.x ?? 0) + Math.cos(angle) * distance;
        node.y = (node.parent.y ?? 0) + Math.sin(angle) * distance;
      }
      
      node.isInOrbit = false;
      node.parentNode = node.parent;
    });

    // Create links
    const forceLinks = forceNodes
      .filter(n => n.parent && n.parent.depth >= 2)
      .map(n => ({ source: n.parent!, target: n }));

    // Create force simulation with SMOOTHER settings
    forceSimulation = d3.forceSimulation(forceNodes)
      .force('link', d3.forceLink(forceLinks)
        .id((d: any) => getNodeId(d))
        .distance(70)
        .strength(0.5)) // Increased from 0.3
      .force('charge', d3.forceManyBody()
        .strength(-250) // Slightly stronger repulsion
        .distanceMax(300)) // Add distance limit
      .force('collide', d3.forceCollide()
        .radius(38) // Slightly larger
        .strength(0.9)) // Stronger collision
      .force('center', d3.forceCenter(0, 0).strength(0.02)) // Gentle centering
      .alphaDecay(0.02) // Much slower decay = smoother settling
      .velocityDecay(0.3) // Less friction = more fluid
      .on('tick', () => {
        // Softer constraints
        forceNodes.forEach(node => {
          if (node.parent && !node.isDragging) {
            const parent = node.parent;
            const px = parent.x ?? 0;
            const py = parent.y ?? 0;
            
            const maxDist = 250; // Increased from 200
            const minDist = 35; // Slightly smaller
            
            const dx = node.x! - px;
            const dy = node.y! - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Soft spring-like constraints instead of hard limits
            if (dist > maxDist) {
              const excess = dist - maxDist;
              const pullStrength = 0.1; // Gentle pull back
              node.vx! -= (dx / dist) * excess * pullStrength;
              node.vy! -= (dy / dist) * excess * pullStrength;
            }
            
            if (dist < minDist && dist > 0) {
              const shortage = minDist - dist;
              const pushStrength = 0.1;
              node.vx! += (dx / dist) * shortage * pushStrength;
              node.vy! += (dy / dist) * shortage * pushStrength;
            }
          }
        });
      });

    // Let simulation run continuously at low alpha instead of stopping
    setTimeout(() => {
      if (forceSimulation) {
        forceSimulation.alphaTarget(0.01); // Keep minimal activity
      }
    }, 5000);
  }

  let animationId: number;

  function animate() {
    nodes.forEach(node => {
      if (node.depth >= 3) return; // Force simulation handles these
      if (!node.isInOrbit) return;
      if (node.depth === 0) return;
      
      if (node.isDragging) {
        // Apply damping during drag for smoother feel
        node.vx = (node.vx ?? 0) * 0.85;
        node.vy = (node.vy ?? 0) * 0.85;
        return;
      }

      // Calculate target position
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
        const referenceAngle = parent.orbitAngle ?? 0;

        node.orbitAngle = node.orbitAngle ?? referenceAngle;

        // Smooth radius transitions
        let targetRadius = node.baseOrbitRadius || LEVEL_2_BASE_RADIUS;

        if (node.isExpanded && node.hasChildren) {
          if (node.expansionOffset === undefined) {
            const childCount = node.children?.length || 3;
            const childCircumference = childCount * 65;
            const childRadius = Math.max(80, childCircumference / (2 * Math.PI));
            
            let maxGrandchildOrbit = 0;
            node.children?.forEach(child => {
              if (child.children && child.children.length > 0) {
                const gcCount = child.children.length;
                const gcCircumference = gcCount * 55;
                const gcRadius = Math.max(60, gcCircumference / (2 * Math.PI));
                maxGrandchildOrbit = Math.max(maxGrandchildOrbit, gcRadius);
              }
            });
            
            node.expansionOffset = childRadius + maxGrandchildOrbit + 80;
          }
          targetRadius = node.baseOrbitRadius! + node.expansionOffset;
        } else {
          node.expansionOffset = undefined;
          targetRadius = node.baseOrbitRadius!;
        }

        // Smoothly interpolate radius
        if (!node.currentEffectiveRadius) {
          node.currentEffectiveRadius = targetRadius;
        }
        node.currentEffectiveRadius += (targetRadius - node.currentEffectiveRadius) * RADIUS_TRANSITION_SPEED;

        const angle = referenceAngle + (node.offsetAngle || 0);
        node.targetX = px + Math.cos(angle) * node.currentEffectiveRadius;
        node.targetY = py + Math.sin(angle) * node.currentEffectiveRadius;
      }

      // Apply spring-like motion with velocity
      const dx = node.targetX! - node.x!;
      const dy = node.targetY! - node.y!;
      
      node.vx = (node.vx ?? 0) * DRAG_DAMPING + dx * ORBITAL_RETURN_SPEED;
      node.vy = (node.vy ?? 0) * DRAG_DAMPING + dy * ORBITAL_RETURN_SPEED;
      
      node.x! += node.vx;
      node.y! += node.vy;
    });

    onTick();
    animationId = requestAnimationFrame(animate);
  }

  animate();

  function onDragStart(node: D3HierarchyNode) {
    if (node.depth === 0) return;
    node.isDragging = true;
    
    if (node.depth >= 3 && forceSimulation) {
      forceSimulation.alphaTarget(0.3).restart();
    }
  }

  function onDrag(node: D3HierarchyNode, x: number, y: number) {
    if (node.depth === 0) return;
    
    // Calculate velocity from drag movement
    if (node.depth < 3) {
      const dx = x - (node.x ?? x);
      const dy = y - (node.y ?? y);
      node.vx = dx;
      node.vy = dy;
    }
    
    node.x = x;
    node.y = y;
    
    if (node.depth >= 3) {
      node.fx = x;
      node.fy = y;
    }
  }

  function onDragEnd(node: D3HierarchyNode) {
    if (node.depth === 0) return;
    node.isDragging = false;

    if (node.depth >= 3) {
      node.fx = undefined;
      node.fy = undefined;
      
      if (forceSimulation) {
        forceSimulation.alphaTarget(0.01); // Low alpha instead of 0
      }
    }
    // For orbital nodes, velocity will naturally return them to orbit
  }

  return {
    stop: () => {
      cancelAnimationFrame(animationId);
      if (forceSimulation) {
        forceSimulation.stop();
      }
    },
    dragHandlers: { onDragStart, onDrag, onDragEnd },
  };
}