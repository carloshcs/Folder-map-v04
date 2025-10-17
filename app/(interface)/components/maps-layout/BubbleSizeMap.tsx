import React, { useEffect, useMemo, useState } from 'react';

import type { FolderItem } from '../right-sidebar/data';
import {
  buildBubbleNodes,
  buildBubbleTree,
  type BubbleNode,
  type BubbleTree,
  type BubbleTreeNode,
} from '@/lib/mapData';
import { handleNodeDoubleClick } from '@/app/(interface)/lib/mapUtils/interactions';
import {
  getPaletteColor,
  getReadableTextColor,
  shiftColor,
} from '@/app/(interface)/lib/utils/colors';

interface PositionedBubble extends BubbleNode {
  radius: number;
  x: number;
  y: number;
}

interface BubbleConnection {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface BubbleLayoutResult {
  bubbles: PositionedBubble[];
  connections: BubbleConnection[];
  width: number;
  height: number;
}

const MIN_RADIUS = 48;
const MAX_RADIUS = 160;
const BUBBLE_SPACING = 12;
const CONTAINER_PADDING = 48;

const formatSize = (bytes: number): string => {
  if (bytes <= 0) {
    return '0 KB';
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formatted = size >= 10 ? Math.round(size) : Number(size.toFixed(1));
  return `${formatted} ${units[unitIndex]}`;
};

const computeRadiusScale = (data: BubbleNode[]): ((size: number) => number) => {
  const sizes = data.map(item => item.size).filter(size => size > 0);
  if (sizes.length === 0) {
    return () => MIN_RADIUS * 0.6;
  }

  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);

  if (minSize === maxSize) {
    return () => (MIN_RADIUS + MAX_RADIUS) / 2;
  }

  return (size: number) => {
    if (size <= 0) {
      return MIN_RADIUS * 0.6;
    }
    const normalized = (size - minSize) / (maxSize - minSize);
    return MIN_RADIUS + normalized * (MAX_RADIUS - MIN_RADIUS);
  };
};

const layoutBubbles = (tree: BubbleTree, expandedNodes: Set<string>): BubbleLayoutResult => {
  const { roots, nodeMap } = tree;

  if (!roots.length) {
    return { bubbles: [], connections: [], width: 0, height: 0 };
  }

  const scaleRadius = computeRadiusScale(Array.from(nodeMap.values()));

  const depthSpacing = MAX_RADIUS * 1.5;
  const horizontalSpacing = MAX_RADIUS + BUBBLE_SPACING * 2;

  let currentX = CONTAINER_PADDING;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const positioned = new Map<string, PositionedBubble>();

  const assignPositions = (node: BubbleTreeNode, depth: number, startX: number): number => {
    const radius = scaleRadius(node.size);
    const y = CONTAINER_PADDING + depth * depthSpacing + radius;
    const nodePosition: PositionedBubble = {
      ...node,
      radius,
      x: startX + radius,
      y,
    };

    positioned.set(node.id, nodePosition);

    minX = Math.min(minX, nodePosition.x - radius);
    maxX = Math.max(maxX, nodePosition.x + radius);
    maxY = Math.max(maxY, nodePosition.y + radius);

    const isExpanded = expandedNodes.has(node.id);
    const children = isExpanded ? node.children : [];

    if (children.length === 0) {
      return nodePosition.x + radius + horizontalSpacing;
    }

    let childStart = startX;

    children.forEach(child => {
      childStart = assignPositions(child, depth + 1, childStart);
    });

    const firstChild = positioned.get(children[0].id);
    const lastChild = positioned.get(children[children.length - 1].id);

    if (firstChild && lastChild) {
      nodePosition.x = (firstChild.x + lastChild.x) / 2;
      positioned.set(node.id, nodePosition);

      minX = Math.min(minX, nodePosition.x - radius);
      maxX = Math.max(maxX, nodePosition.x + radius);
    }

    return Math.max(childStart, nodePosition.x + radius + horizontalSpacing);
  };

  roots.forEach(root => {
    currentX = assignPositions(root, 0, currentX);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return { bubbles: [], connections: [], width: 0, height: 0 };
  }

  const shiftX = CONTAINER_PADDING - minX;

  positioned.forEach(position => {
    position.x += shiftX;
  });

  const bubbles: PositionedBubble[] = Array.from(positioned.values());
  const positionedMap = new Map(bubbles.map(bubble => [bubble.id, bubble]));

  const connections: BubbleConnection[] = [];

  bubbles.forEach(bubble => {
    if (!bubble.parentId) {
      return;
    }

    const parent = positionedMap.get(bubble.parentId);
    if (!parent) {
      return;
    }

    connections.push({
      fromX: parent.x,
      fromY: parent.y + parent.radius - 8,
      toX: bubble.x,
      toY: bubble.y - bubble.radius + 8,
    });
  });

  const width = maxX - minX + CONTAINER_PADDING * 2;
  const height = Number.isFinite(maxY) ? maxY + CONTAINER_PADDING : 0;

  return {
    bubbles,
    connections,
    width,
    height,
  };
};

interface BubbleSizeMapProps {
  folders: FolderItem[];
  colorPaletteId?: string;
}

export const BubbleSizeMap: React.FC<BubbleSizeMapProps> = ({ folders, colorPaletteId }) => {
  const bubbleNodes = useMemo(() => buildBubbleNodes(folders), [folders]);
  const bubbleTree = useMemo<BubbleTree>(() => buildBubbleTree(bubbleNodes, { minDepth: 1 }), [bubbleNodes]);
  const allNodeIds = useMemo(() => Array.from(bubbleTree.nodeMap.keys()), [bubbleTree]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set(allNodeIds));

  useEffect(() => {
    setExpandedNodes(new Set(allNodeIds));
  }, [allNodeIds]);

  const layout = useMemo(() => layoutBubbles(bubbleTree, expandedNodes), [bubbleTree, expandedNodes]);

  if (!layout.bubbles.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        Select folders with storage data to generate the bubble map.
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="relative"
        style={{ width: layout.width, height: layout.height }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width={layout.width}
          height={layout.height}
        >
          {layout.connections.map((connection, index) => (
            <line
              key={`connection-${index}`}
              x1={connection.fromX}
              y1={connection.fromY}
              x2={connection.toX}
              y2={connection.toY}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </svg>
        {layout.bubbles.map((bubble, index) => {
          const baseColor = getPaletteColor(colorPaletteId, index);
          const gradientStart = shiftColor(baseColor, 0.35);
          const gradientEnd = shiftColor(baseColor, -0.28);
          const textColor = getReadableTextColor(gradientEnd);
          const gradient = `radial-gradient(circle at 30% 30%, ${gradientStart} 0%, ${gradientEnd} 100%)`;

          return (
            <div
              key={bubble.id}
              className="absolute rounded-full shadow-lg flex flex-col items-center justify-center text-center px-4"
              style={{
                width: bubble.radius * 2,
                height: bubble.radius * 2,
                left: bubble.x - bubble.radius,
                top: bubble.y - bubble.radius,
                background: gradient,
                color: textColor,
              }}
              onDoubleClick={event => {
                event.preventDefault();
                event.stopPropagation();
                const treeNode = bubbleTree.nodeMap.get(bubble.id);
                if (treeNode) {
                  handleNodeDoubleClick(treeNode, setExpandedNodes);
                }
              }}
            >
              <div className="w-full">
                <div className="text-sm font-semibold leading-tight break-words">
                  {bubble.name}
                </div>
                <div className="text-xs mt-1" style={{ color: shiftColor(textColor, 0.35) }}>
                  {formatSize(bubble.size)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
