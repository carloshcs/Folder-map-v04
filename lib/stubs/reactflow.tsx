import React, { useEffect, useMemo, useRef, useState } from 'react';

type Position = { x: number; y: number };

export interface Node<Data = any> {
  id: string;
  position: Position;
  data: Data;
  type?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface Edge<Data = any> {
  id: string;
  source: string;
  target: string;
  data?: Data;
  animated?: boolean;
  style?: React.CSSProperties;
}

export interface NodeComponentProps<Data = any> {
  id: string;
  data: Data;
  selected: boolean;
  dragging: boolean;
  width: number;
  height: number;
}

type PointerLikeEvent = PointerEvent | React.PointerEvent<HTMLDivElement>;

type NodeDragHandler<Data = any> = (event: PointerLikeEvent, node: Node<Data>) => void;

type NodeMouseHandler<Data = any> = (event: React.PointerEvent<HTMLDivElement>, node: Node<Data>) => void;

interface ReactFlowProps<Data = any> {
  nodes: Array<Node<Data>>;
  edges: Edge[];
  nodeTypes?: Record<string, React.ComponentType<NodeComponentProps<Data>>>;
  onNodeDragStart?: NodeDragHandler<Data>;
  onNodeDrag?: NodeDragHandler<Data>;
  onNodeDragStop?: NodeDragHandler<Data>;
  onNodeMouseEnter?: NodeMouseHandler<Data>;
  onNodeMouseMove?: NodeMouseHandler<Data>;
  onNodeMouseLeave?: NodeMouseHandler<Data>;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 132;
const EDGE_ANIMATION_STYLE: React.CSSProperties = {
  strokeDasharray: '12 12',
  animation: 'fox-flow-edge-dash 12s linear infinite',
};

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
  pointerId: number;
};

const ReactFlow: React.FC<ReactFlowProps> = ({
  nodes,
  edges,
  nodeTypes,
  onNodeDrag,
  onNodeDragStart,
  onNodeDragStop,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeMouseMove,
  className,
  style,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const nodesWithDefaults = useMemo(() =>
    nodes.map(node => ({
      ...node,
      width: node.width ?? NODE_WIDTH,
      height: node.height ?? NODE_HEIGHT,
    })),
  [nodes]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, (typeof nodesWithDefaults)[number]>();
    nodesWithDefaults.forEach(node => {
      map.set(node.id, node);
    });
    return map;
  }, [nodesWithDefaults]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const node = nodeMap.get(dragState.id);
      if (!node) return;

      event.preventDefault();
      const x = event.clientX - dragState.offsetX;
      const y = event.clientY - dragState.offsetY;

      const updatedNode = { ...node, position: { x, y } };
      onNodeDrag?.(event, updatedNode);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const node = nodeMap.get(dragState.id);
      if (!node) return;

      event.preventDefault();

      dragStateRef.current = null;
      setDraggingId(null);

      if (containerRef.current?.hasPointerCapture(dragState.pointerId)) {
        containerRef.current.releasePointerCapture(dragState.pointerId);
      }

      const x = event.clientX - dragState.offsetX;
      const y = event.clientY - dragState.offsetY;
      const updatedNode = { ...node, position: { x, y } };

      onNodeDragStop?.(event, updatedNode);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [nodeMap, onNodeDrag, onNodeDragStop]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, node: Node) => {
    // Only start dragging with the primary (left) mouse button
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const container = containerRef.current;
    if (container) {
      container.setPointerCapture(event.pointerId);
    }
    dragStateRef.current = {
      id: node.id,
      offsetX: event.clientX - node.position.x,
      offsetY: event.clientY - node.position.y,
      pointerId: event.pointerId,
    };
    setDraggingId(node.id);
    onNodeDragStart?.(event, node);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className ?? ''}`}
      style={{ backgroundColor: '#f7f9fc', touchAction: 'none', ...style }}
    >
      {children}
      <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="fox-flow-edge" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a2b2ff" />
            <stop offset="100%" stopColor="#6f7dff" />
          </linearGradient>
        </defs>
        {edges.map(edge => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) {
            return null;
          }
          const sourceX = source.position.x + (source.width ?? NODE_WIDTH) / 2;
          const sourceY = source.position.y + (source.height ?? NODE_HEIGHT);
          const targetX = target.position.x + (target.width ?? NODE_WIDTH) / 2;
          const targetY = target.position.y;
          const midY = sourceY + (targetY - sourceY) * 0.5;
          const path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
          const strokeStyle: React.CSSProperties = {
            stroke: 'url(#fox-flow-edge)',
            strokeWidth: 2,
            fill: 'none',
            opacity: 0.85,
            filter: 'drop-shadow(0 4px 10px rgba(111, 125, 255, 0.3))',
            ...(edge.animated ? EDGE_ANIMATION_STYLE : {}),
            ...edge.style,
          };
          return <path key={edge.id} d={path} style={strokeStyle} />;
        })}
      </svg>
      <div className="absolute inset-0 pointer-events-none select-none">
        {nodesWithDefaults.map(node => {
          const NodeComponent = nodeTypes?.[node.type ?? 'default'];
          const style: React.CSSProperties = {
            position: 'absolute',
            transform: `translate(${node.position.x}px, ${node.position.y}px)`,
            width: node.width ?? NODE_WIDTH,
            height: node.height ?? NODE_HEIGHT,
            pointerEvents: 'auto',
            transition: draggingId === node.id ? 'none' : 'transform 200ms ease-out',
            ...node.style,
          };

          return (
            <div
              key={node.id}
              style={style}
              className={`group ${node.className ?? ''}`}
              onPointerDown={event => handlePointerDown(event, node)}
              onMouseEnter={event => onNodeMouseEnter?.(event, node)}
              onMouseMove={event => onNodeMouseMove?.(event, node)}
              onMouseLeave={event => onNodeMouseLeave?.(event, node)}
            >
              {NodeComponent ? (
                <NodeComponent
                  id={node.id}
                  data={node.data}
                  selected={false}
                  dragging={draggingId === node.id}
                  width={node.width ?? NODE_WIDTH}
                  height={node.height ?? NODE_HEIGHT}
                />
              ) : (
                <DefaultNode dragging={draggingId === node.id} label={String(node.data?.label ?? node.id)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DefaultNode: React.FC<{ label: string; dragging: boolean }> = ({ label, dragging }) => (
  <div
    className={`flex h-full w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition-shadow ${
      dragging ? 'shadow-lg' : 'shadow'
    }`}
  >
    {label}
  </div>
);

export const Background: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
    style={{
      backgroundImage: 'radial-gradient(rgba(111, 125, 255, 0.25) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      opacity: 0.7,
    }}
  />
);

export default ReactFlow;
