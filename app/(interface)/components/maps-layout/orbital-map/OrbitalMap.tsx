// ===== CLEANED OrbitalMap.tsx =====
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface FolderItem {
  name: string;
  children?: FolderItem[];
}

interface D3HierarchyNode {
  data: any;
  depth: number;
  parent?: D3HierarchyNode;
  children?: D3HierarchyNode[];
  x?: number;
  y?: number;
  targetX?: number;
  targetY?: number;
  orbitAngle?: number;
  offsetAngle?: number;
  baseOrbitRadius?: number;
  calculatedRadius?: number;
  expansionOffset?: number;
  isDragging?: boolean;
  isInOrbit?: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  parentNode?: D3HierarchyNode;
  isPrimary?: boolean;
}

interface D3Link {
  source: D3HierarchyNode;
  target: D3HierarchyNode;
}

type D3GroupSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

interface OrbitalMapProps {
  folders: FolderItem[];
}

interface NodePosition {
  x: number;
  y: number;
  baseOrbitRadius: number;
  calculatedRadius: number;
  offsetAngle: number;
  orbitAngle: number;
}

// Configurable orbital radii for each level
const ORBITAL_RADII: Record<number, number> = {
  0: 0,
  1: 100,
  2: 90,
  3: 65,
};

const LOGO_MAP: Record<string, string> = {
  'Folder Fox': '/assets/folder-fox.png',
  'Google Drive': '/assets/google-drive-logo.png',
  Dropbox: '/assets/dropbox-logo.png',
  OneDrive: '/assets/onedrive-logo.png',
  Notion: '/assets/notion-logo.png',
};

const INTEGRATION_NAMES = ['Google Drive', 'Dropbox', 'OneDrive', 'Notion'];
const RETURN_SPEED = 0.12;
const FAST_SPEED = 0.25;

function getOrbitalRadius(depth: number): number {
  return ORBITAL_RADII[depth] || ORBITAL_RADII[3];
}

function getNodeRadius(depth: number): number {
  if (depth === 0) return 30;
  if (depth === 1) return 25;
  if (depth === 2) return 28;
  return 24;
}

function getNodeColor(depth: number): string {
  const colors: Record<number, string> = {
    0: '#fff',
    1: '#fff',
    2: '#a8d8a8',
    3: '#ffeb99',
    4: '#ffb3ba',
    5: '#bae1ff',
  };
  return colors[depth] || '#e0e0e0';
}

function getNodeId(d: any): string {
  if (d?.id) return String(d.id);
  if (d?.data?.name) {
    const name = d.data.name;
    const depth = d.depth;
    const parentName = d.parent?.data?.name || '';
    return `${depth}_${parentName}_${name}`.replace(/\s+/g, '_');
  }
  return 'node_' + Math.random().toString(36).slice(2);
}

function mapFolderToHierarchy(folder: FolderItem): any {
  const children = folder.children ? folder.children.map(mapFolderToHierarchy) : [];
  return { name: folder.name, children };
}

function buildHierarchy(folders: FolderItem[]) {
  const folderFox = {
    name: 'Folder Fox',
    children: folders.filter(f => INTEGRATION_NAMES.includes(f.name)).map(mapFolderToHierarchy),
  };
  return d3.hierarchy(folderFox);
}

function getVisibleNodesAndLinks(root: D3HierarchyNode, expanded: Set<string>) {
  const allNodes = root.descendants();
  const allLinks = root.links();

  const visibleNodes = allNodes.filter(d => {
    if (d.depth <= 1) return true;
    const parent = d.parent;
    if (!parent) return false;
    return expanded.has(parent.data.name);
  });

  const visibleLinks = allLinks.filter(
    d => visibleNodes.includes(d.source) && visibleNodes.includes(d.target),
  );

  visibleNodes.forEach(node => {
    node.isExpanded = expanded.has(node.data.name);
    node.hasChildren = (node.children && node.children.length > 0) || false;
  });

  return { visibleNodes, visibleLinks };
}

function checkCollision(pos1: {x: number, y: number}, pos2: {x: number, y: number}, minDistance: number): boolean {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < minDistance;
}

function calculateExpansionOffset(node: D3HierarchyNode, childCount: number): number {
  const childDepth = node.depth + 1;
  const childBaseRadius = getOrbitalRadius(childDepth);
  const childNodeRadius = getNodeRadius(childDepth);
  const childNodeDiameter = childNodeRadius * 2;
  const orbitSpacing = childNodeDiameter * 2.0;
  
  const estimatedOrbits = Math.ceil(childCount / 3);
  const outermostRadius = childBaseRadius + ((estimatedOrbits - 1) * orbitSpacing);
  
  return outermostRadius + 80;
}

function getReferenceAngle(parent: D3HierarchyNode): number {
  if (parent.parentNode) {
    const gpx = parent.parentNode.x ?? 0;
    const gpy = parent.parentNode.y ?? 0;
    const px = parent.x ?? 0;
    const py = parent.y ?? 0;
    return Math.atan2(py - gpy, px - gpx);
  }
  return parent.orbitAngle ?? 0;
}

function positionChildNodes(
  children: D3HierarchyNode[],
  parent: D3HierarchyNode,
  depth: number,
  existingPositions: Map<string, NodePosition>,
  positionedNodes: {x: number, y: number}[]
) {
  const childCount = children.length;
  const baseRadius = getOrbitalRadius(depth);
  const nodeRadius = getNodeRadius(depth);
  const nodeDiameter = nodeRadius * 2;
  const minSpacing = nodeDiameter * 1.4;
  const spreadAngle = Math.PI * 0.75;
  
  const referenceAngle = getReferenceAngle(parent);
  
  // Calculate expansion offset if needed
  const expansionOffset = (parent.depth >= 3 && parent.isExpanded && parent.hasChildren)
    ? calculateExpansionOffset(parent, childCount)
    : 0;
  
  parent.expansionOffset = expansionOffset;
  parent.baseOrbitRadius = parent.baseOrbitRadius ?? baseRadius;
  
  // Check if all children already have positions - if so, keep them
  const allChildrenHavePositions = children.every(child => {
    const nodeId = getNodeId(child);
    return existingPositions.has(nodeId);
  });
  
  if (allChildrenHavePositions) {
    // Just restore existing positions, don't recalculate
    children.forEach(child => {
      const nodeId = getNodeId(child);
      const existingPos = existingPositions.get(nodeId)!;
      
      child.parentNode = parent;
      child.isInOrbit = true;
      Object.assign(child, existingPos, { targetX: existingPos.x, targetY: existingPos.y });
      positionedNodes.push({x: child.x!, y: child.y!});
    });
    return;
  }
  
  const baseOrbitSpacing = nodeDiameter * 1.8;
  
  function getOrbitCapacity(orbitRadius: number): number {
    const arcLength = orbitRadius * spreadAngle;
    const nodesCanFit = Math.floor(arcLength / minSpacing);
    return Math.max(1, nodesCanFit);
  }
  
  // Distribute children across orbits
  const orbits: {radius: number, nodes: D3HierarchyNode[]}[] = [];
  let childIndex = 0;
  let orbitIndex = 0;
  
  while (childIndex < childCount) {
    const orbitRadius = baseRadius + (orbitIndex * baseOrbitSpacing);
    const orbitCapacity = getOrbitCapacity(orbitRadius);
    const nodesForThisOrbit = Math.min(orbitCapacity, childCount - childIndex);
    
    orbits.push({
      radius: orbitRadius,
      nodes: children.slice(childIndex, childIndex + nodesForThisOrbit)
    });
    
    childIndex += nodesForThisOrbit;
    orbitIndex++;
  }
  
  // Position nodes in each orbit
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
        
        // Collision detection
        for (let attempt = 0; attempt < 20; attempt++) {
          const hasCollision = positionedNodes.some(pos => 
            checkCollision({x: finalX, y: finalY}, pos, minSpacing)
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
          y: finalY
        });
      }
      
      positionedNodes.push({x: child.x!, y: child.y!});
    } else {
      const totalAngle = spreadAngle * 0.9;
      const angleIncrement = totalAngle / (nodesInOrbit - 1);
      const staggerOffset = isOddOrbit ? angleIncrement / 2 : 0;
      const startAngle = -totalAngle / 2 + staggerOffset;
      
      orbit.nodes.forEach((child, colIdx) => {
        const nodeId = getNodeId(child);
        const existingPos = existingPositions.get(nodeId);
        const offsetAngle = startAngle + (colIdx * angleIncrement);
        
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
          
          // Collision detection
          for (let attempt = 0; attempt < 20; attempt++) {
            const hasCollision = positionedNodes.some(pos => 
              checkCollision({x: finalX, y: finalY}, pos, minSpacing)
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
            y: finalY
          });
        }
        
        positionedNodes.push({x: child.x!, y: child.y!});
      });
    }
  });
}

export function createManualPhysics(
  nodes: D3HierarchyNode[],
  onTick: () => void,
  existingPositions: Map<string, NodePosition>
) {
  const folderFox = nodes.find(n => n?.data?.name === 'Folder Fox');
  
  if (folderFox) {
    folderFox.x = 0;
    folderFox.y = 0;
    folderFox.isPrimary = true;
  }
  
  // Position integration nodes (depth 1)
  const integrations = nodes.filter(
    n => n?.parent === folderFox && INTEGRATION_NAMES.includes(n?.data?.name)
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
      targetY: cy + Math.sin(angle) * radius
    });
    node.x = node.targetX;
    node.y = node.targetY;
  });
  
  // Group and position nodes by depth (depth >= 2)
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
      const positionedNodes: {x: number, y: number}[] = [];
      
      // Separate nodes into existing and new
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
      
      // First, restore all existing nodes with their exact positions
      existingNodes.forEach(child => {
        const nodeId = getNodeId(child);
        const existingPos = existingPositions.get(nodeId)!;
        
        child.parentNode = parent;
        child.isInOrbit = true;
        Object.assign(child, existingPos, { targetX: existingPos.x, targetY: existingPos.y });
        positionedNodes.push({x: child.x!, y: child.y!});
      });
      
      // Only position new nodes if there are any
      if (newNodes.length > 0) {
        positionChildNodes(newNodes, parent, depth, existingPositions, positionedNodes);
      }
    });
  });
  
  let animationId: number;
  
  function animate() {
    nodes.forEach(node => {
      if (node.depth === 0 || node.isDragging || !node.isInOrbit) return;
      
      const hasVisibleChildren = nodes.some(n => n.parentNode === node && n.isInOrbit);
      
      // Fast animation for depth 2 nodes with visible children
      if (hasVisibleChildren && node.depth === 2) {
        const dx = (node.targetX || 0) - (node.x || 0);
        const dy = (node.targetY || 0) - (node.y || 0);
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        
        if (distanceToTarget < 2) {
          node.x = node.targetX;
          node.y = node.targetY;
          return;
        }
        node.x! += (node.targetX! - node.x!) * FAST_SPEED;
        node.y! += (node.targetY! - node.y!) * FAST_SPEED;
        return;
      }
      
      // Update target positions
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
        const referenceAngle = getReferenceAngle(parent);
        
        node.orbitAngle = node.orbitAngle ?? referenceAngle;
        
        let effectiveRadius = node.baseOrbitRadius || node.calculatedRadius || getOrbitalRadius(node.depth);
        
        // Handle expansion for depth >= 3 nodes
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
      
      // Animate towards target
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

function renderNodes(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  visibleNodes: D3HierarchyNode[],
) {
  const node = nodeLayer
    .selectAll<SVGGElement, D3HierarchyNode>('g.node')
    .data(visibleNodes, d => getNodeId(d))
    .join(
      enter => {
        const group = enter
          .append('g')
          .attr('class', 'node')
          .style('cursor', 'pointer')
          .style('opacity', 0)
          .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
        
        group.each(function (d: D3HierarchyNode) {
          const selection = d3.select(this);
          const name = d.data?.name ?? 'Node';
          const isFolderFox = d.depth === 0 && name === 'Folder Fox';
          const isIntegration = d.depth === 1 && INTEGRATION_NAMES.includes(name);
          
          if ((isFolderFox || isIntegration) && LOGO_MAP[name]) {
            const radius = getNodeRadius(d.depth);
            selection
              .append('circle')
              .attr('r', radius)
              .attr('fill', '#fff')
              .attr('stroke', '#ccc')
              .attr('stroke-width', 2);
            
            selection
              .append('image')
              .attr('href', LOGO_MAP[name])
              .attr('x', -radius * 0.6)
              .attr('y', -radius * 0.6)
              .attr('width', radius * 1.2)
              .attr('height', radius * 1.2)
              .style('pointer-events', 'none');
          } else {
            const radius = getNodeRadius(d.depth);
            const color = getNodeColor(d.depth);
            
            selection
              .append('circle')
              .attr('r', radius)
              .attr('fill', color)
              .attr('stroke', '#333')
              .attr('stroke-width', 1);
            
            const maxChars = Math.max(6, Math.floor(radius * 0.7));
            let displayText = name;
            
            if (displayText.length > maxChars) {
              displayText = displayText.slice(0, maxChars - 1) + '…';
            }
            
            const fontSize = Math.max(7, Math.min(11, radius * 0.48));
            
            selection
              .append('text')
              .attr('text-anchor', 'middle')
              .attr('dy', '0.35em')
              .attr('font-size', fontSize)
              .attr('fill', '#000')
              .attr('font-weight', '500')
              .attr('pointer-events', 'none')
              .text(displayText);
          }
        });
        
        group.append('title').text(d => d.data?.name ?? 'Node');
        
        return group.transition().duration(300).style('opacity', 1);
      },
      update => update,
      exit => exit.transition().duration(200).style('opacity', 0).remove(),
    );
  
  node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  return node;
}

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

export const OrbitalMap: React.FC<OrbitalMapProps> = ({ folders }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1100, height: 900 });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const gRef = useRef<D3GroupSelection | null>(null);
  const linkLayerRef = useRef<D3GroupSelection | null>(null);
  const nodeLayerRef = useRef<D3GroupSelection | null>(null);
  const physicsRef = useRef<any>(null);
  const nodePositionsRef = useRef<Map<string, NodePosition>>(new Map());
  
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const nextWidth = Math.max(MIN_WIDTH, width);
        const nextHeight = Math.max(MIN_HEIGHT, height);

        setSize(prev => {
          if (prev.width === nextWidth && prev.height === nextHeight) {
            return prev;
          }

          return { width: nextWidth, height: nextHeight };
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    const g = svg.append('g').attr('class', 'orbital-root');
    gRef.current = g;
    
    linkLayerRef.current = g.append('g').attr('class', 'link-layer');
    nodeLayerRef.current = g.append('g').attr('class', 'node-layer');
    
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3])
      .on('zoom', event => g.attr('transform', event.transform));
    
    svg.call(zoom as any);
    svg.on('dblclick.zoom', null);
  }, []);
  
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !nodeLayerRef.current || !linkLayerRef.current)
      return;
    
    const svg = d3.select(svgRef.current);
    const { width, height } = size;
    
    const root = buildHierarchy(folders);
    const { visibleNodes, visibleLinks } = getVisibleNodesAndLinks(root, expanded);
    
    const maxDimension = Math.max(width, height);
    const viewPadding = maxDimension * 1.5;
    const viewWidth = width + viewPadding * 2;
    const viewHeight = height + viewPadding * 2;

    svg
      .attr('viewBox', [-viewWidth / 2, -viewHeight / 2, viewWidth, viewHeight])
      .attr('width', width)
      .attr('height', height)
      .style('background', 'none')
      .style('overflow', 'visible');
    
    const linkLayer = linkLayerRef.current!;
    const nodeLayer = nodeLayerRef.current!;
    
    const link = linkLayer
      .selectAll<SVGLineElement, any>('line')
      .data(visibleLinks, (d: any) => `${d.source.data.name}-${d.target.data.name}`)
      .join(
        enter => enter.append('line').attr('stroke', '#aaa').attr('stroke-width', 1.2),
        update => update,
        exit => exit.remove(),
      );
    
    if (physicsRef.current) physicsRef.current.stop();
    
    let node: any;
    
    const physics = createManualPhysics(visibleNodes, () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      
      if (node) node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    }, nodePositionsRef.current);
    
    physicsRef.current = physics;
    
    node = renderNodes(svg, nodeLayer, visibleNodes).style('pointer-events', 'all');
    
    const dragBehaviour = d3
      .drag<SVGGElement, any>()
      .filter((event: any) => {
        const sourceEvent = event?.sourceEvent ?? event;
        const type = sourceEvent?.type;

        if (type === 'mousedown' || type === 'pointerdown') {
          return sourceEvent.button === 2;
        }

        // Allow other input types (e.g. wheel) to pass through default drag filtering
        return type !== 'mousedown';
      })
      .on('start', (_event: any, d: any) => {
        physics.dragHandlers.onDragStart(d);
      })
      .on('drag', (event: any, d: any) => {
        const svgEl = svgRef.current!;
        const t = d3.zoomTransform(svgEl);
        const [px, py] = t.invert(d3.pointer(event, svgEl));
        physics.dragHandlers.onDrag(d, px, py);
      })
      .on('end', (_event: any, d: any) => {
        physics.dragHandlers.onDragEnd(d);
      });

    node.call(dragBehaviour as any);
    node.on('contextmenu', event => event.preventDefault());
    
    node.on('dblclick', (event: any, d: any) => {
      event.stopPropagation();
      const name = d.data?.name;
      if (!name) return;
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
    });
    
    visibleNodes.forEach(node => {
      const nodeId = getNodeId(node);
      nodePositionsRef.current.set(nodeId, {
        x: node.x!,
        y: node.y!,
        baseOrbitRadius: node.baseOrbitRadius!,
        calculatedRadius: node.calculatedRadius!,
        offsetAngle: node.offsetAngle!,
        orbitAngle: node.orbitAngle!
      });
    });
    
    return () => physics.stop();
  }, [folders, size, expanded]);
  
  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        minWidth: `${MIN_WIDTH}px`,
        minHeight: `${MIN_HEIGHT}px`,
      }}
    >
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};
