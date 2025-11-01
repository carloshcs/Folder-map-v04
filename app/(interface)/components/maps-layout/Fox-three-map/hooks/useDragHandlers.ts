import { useCallback, useRef } from 'react';
import { type Edge, type Node, type XYPosition } from 'reactflow';
import { type FoxNodeData } from '../config';
import { computeFamilySetFromNodes } from '../utils/tree';
import {
  clampToParentGap,
  computeBranchBounds,
  enforceDepthVerticalSeparation,
  enforceGridAndReflow,
  resolveDirectionHint,
  snapPosition,
  snapUpToGrid,
  snapWithMinimum,
} from '../utils/grid';
import { HORIZONTAL_GAP, VERTICAL_GAP, DRAG_VERTICAL_GAP, DRAG_SMOOTH_MAX_STEP, NODE_HEIGHT, NODE_WIDTH } from '../config';

// Branch-to-branch padding measured from previous bottom to next top
// Set to zero to minimize inter-branch pad during drag spacing.
const BRANCH_PAD = Math.max(0, 0);

// Limit per-update movement for smoother visual push/pull during drag
const clampStep = (delta: number): number => {
  const max = DRAG_SMOOTH_MAX_STEP;
  if (delta > max) return max;
  if (delta < -max) return -max;
  return delta;
};

// Hysteresis around axes to avoid flip-flop/jitter near quadrant boundaries during drag
const AXIS_PUSH_HYSTERESIS = 6; // pixels

const axisSide = (delta: number): -1 | 0 | 1 => {
  if (Math.abs(delta) <= AXIS_PUSH_HYSTERESIS) return 0;
  return delta > 0 ? 1 : -1;
};

const quadrantKeyFromDelta = (deltaX: number, deltaY: number): string => `${axisSide(deltaX)}:${axisSide(deltaY)}`;

const computeQuadrantKeyFromPositions = (child: XYPosition, parent: XYPosition): string =>
  quadrantKeyFromDelta(child.x - parent.x, child.y - parent.y);

type Boundary = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const getNodeDimensions = (node: Node<FoxNodeData>): { width: number; height: number } => ({
  width: node.width ?? NODE_WIDTH,
  height: node.height ?? NODE_HEIGHT,
});

const getNodeCenter = (node: Node<FoxNodeData>): XYPosition => {
  const { width, height } = getNodeDimensions(node);
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
};

const buildBoundaryFromParent = (parent: Node<FoxNodeData>): Boundary => {
  const center = getNodeCenter(parent);
  return {
    minX: center.x - HORIZONTAL_GAP,
    maxX: center.x + HORIZONTAL_GAP,
    minY: center.y - VERTICAL_GAP,
    maxY: center.y + VERTICAL_GAP,
  };
};

const isCenterOutsideBoundary = (center: XYPosition, boundary: Boundary): boolean =>
  center.x < boundary.minX || center.x > boundary.maxX || center.y < boundary.minY || center.y > boundary.maxY;

const clampPositionWithinBoundary = (
  position: XYPosition,
  node: Node<FoxNodeData>,
  boundary: Boundary,
): XYPosition => {
  const { width, height } = getNodeDimensions(node);
  const centerX = position.x + width / 2;
  const centerY = position.y + height / 2;
  const clampedCenterX = Math.min(Math.max(centerX, boundary.minX), boundary.maxX);
  const clampedCenterY = Math.min(Math.max(centerY, boundary.minY), boundary.maxY);
  if (clampedCenterX === centerX && clampedCenterY === centerY) return position;
  return {
    x: snapPosition(clampedCenterX - width / 2),
    y: snapPosition(clampedCenterY - height / 2),
  };
};

type Lookups = {
  parentLookup: Map<string, string | null>;
  childrenLookup: Map<string, any[]>; // FoxTreeNode[] but we only use .id
  getDescendantIds: (id: string) => string[];
};

type Setters = {
  setFlowNodes: React.Dispatch<React.SetStateAction<Array<Node<FoxNodeData>>>>;
  setManualPositions: React.Dispatch<React.SetStateAction<Map<string, XYPosition>>>;
  setCustomOrder: React.Dispatch<React.SetStateAction<Map<string, string[]>>>;
};

type ActiveDragState = {
  id: string;
  parentId: string | null;
  initialParentOffset: { x: number; y: number } | null;
  lastCursor: XYPosition | null;
  serviceId?: string | null;
  desiredXSign?: -1 | 0 | 1;
  desiredYSign?: -1 | 0 | 1;
};

const enforceServiceNodeBoundary = (
  baseNodes: Array<Node<FoxNodeData>>,
  currentNodes: Array<Node<FoxNodeData>>,
  draggedId: string,
  parentLookup: Map<string, string | null>,
): Array<Node<FoxNodeData>> => {
  if (currentNodes.length === 0) return currentNodes;

  const baseMap = new Map(baseNodes.map(node => [node.id, node]));
  const parentCache = new Map<string, Node<FoxNodeData> | undefined>();

  return currentNodes.map(node => {
    const depth = (node.data as FoxNodeData).depth ?? 0;
    if (depth !== 1 || node.id === draggedId) return node;

    const parentId = parentLookup.get(node.id) ?? null;
    if (!parentId) return node;

    if (!parentCache.has(parentId)) {
      parentCache.set(parentId, currentNodes.find(n => n.id === parentId) ?? baseMap.get(parentId));
    }
    const parentNode = parentCache.get(parentId);
    if (!parentNode) return node;

    const boundary = buildBoundaryFromParent(parentNode);
    const baseNode = baseMap.get(node.id);
    const baseCenter = baseNode ? getNodeCenter(baseNode) : null;
    const startedOutside = baseCenter ? isCenterOutsideBoundary(baseCenter, boundary) : false;

    if (startedOutside) {
      if (!baseNode) return node;
      if (node.position.x === baseNode.position.x && node.position.y === baseNode.position.y) return node;
      return { ...node, position: { ...baseNode.position } };
    }

    const clamped = clampPositionWithinBoundary(node.position, node, boundary);
    if (clamped.x === node.position.x && clamped.y === node.position.y) return node;
    return { ...node, position: clamped };
  });
};

export const useDragHandlers = (lookups: Lookups, setters: Setters) => {
  const { parentLookup, childrenLookup, getDescendantIds } = lookups;
  const { setFlowNodes, setManualPositions, setCustomOrder } = setters;

  const activeDragRef = useRef<ActiveDragState | null>(null);
  const dragStartPositionsRef = useRef<Map<string, XYPosition> | null>(null);
  const dragFamilyIdsRef = useRef<Set<string> | null>(null);

  // Throttle drag updates to animation frames to reduce re-renders
  const rafInFlightRef = useRef(false);
  const rafQueuedRef = useRef(false);
  // Track the pending rAF so we can cancel it on drag stop
  const rafIdRef = useRef<number | null>(null);
  const lastDragIdRef = useRef<string | null>(null);
  const lastDragPositionRef = useRef<XYPosition | null>(null);

  const rawHandleNodeDrag = useCallback(
    (id: string, position?: XYPosition | null) => {
      if (!position || id === 'fox-root') return;

      const latestPos = position;
      setFlowNodes(nodes => {
        const targetIndex = nodes.findIndex(node => node.id === id);
        if (targetIndex === -1) return nodes;

        const targetNode = nodes[targetIndex];
        const branchIds = new Set([id, ...getDescendantIds(id)]);
        const parentId = parentLookup.get(id) ?? null;

        if (!activeDragRef.current || activeDragRef.current.id !== id) {
          let initialParentOffset: { x: number; y: number } | null = null;

          if (parentId) {
            const parentNode = nodes.find(node => node.id === parentId);
            if (parentNode) {
              initialParentOffset = {
                x: targetNode.position.x - parentNode.position.x,
                y: targetNode.position.y - parentNode.position.y,
              };
            }
          }

          const startPositions = new Map<string, XYPosition>();
          const draggedData = targetNode.data as FoxNodeData;
          const isServiceLevel = (draggedData.depth ?? 0) === 1;
          const draggedServiceId = draggedData.serviceId;
          const scopeIds = isServiceLevel
            ? computeFamilySetFromNodes(nodes, draggedServiceId)
            : branchIds;
          dragFamilyIdsRef.current = scopeIds;
          nodes.forEach(n => {
            if (scopeIds.has(n.id)) {
              startPositions.set(n.id, { x: n.position.x, y: n.position.y });
            }
          });
          dragStartPositionsRef.current = startPositions;

          activeDragRef.current = {
            id,
            parentId,
            initialParentOffset,
            lastCursor: { ...position },
            serviceId: draggedServiceId ?? null,
            desiredXSign: initialParentOffset ? axisSide(initialParentOffset.x) : 0,
            desiredYSign: initialParentOffset ? axisSide(initialParentOffset.y) : 0,
          };
        } else {
          activeDragRef.current.lastCursor = { ...latestPos };
        }

        const startPositions = dragStartPositionsRef.current;
        if (!startPositions) {
          const deltaX = latestPos.x - targetNode.position.x;
          const deltaY = latestPos.y - targetNode.position.y;
          if (deltaX === 0 && deltaY === 0) return nodes;
          return nodes.map(node => {
            if (!branchIds.has(node.id)) return node;
            if (node.id === id) return { ...node, position: { ...latestPos } };
            return { ...node, position: { x: node.position.x + deltaX, y: node.position.y + deltaY } };
          });
        }

        const startRoot = startPositions.get(id) ?? { x: targetNode.position.x, y: targetNode.position.y };
        const totalDeltaX = latestPos.x - startRoot.x;
        const totalDeltaY = latestPos.y - startRoot.y;
        const crossedAxisX = (startRoot.x < 0 && latestPos.x > 0) || (startRoot.x > 0 && latestPos.x < 0);
        const crossedAxisY = (startRoot.y < 0 && latestPos.y > 0) || (startRoot.y > 0 && latestPos.y < 0);
        const mirroredRootX = -startRoot.x;
        const mirroredRootY = -startRoot.y;
        const extraAfterMirrorX = latestPos.x - mirroredRootX;
        const extraAfterMirrorY = latestPos.y - mirroredRootY;

        const familySet =
          dragFamilyIdsRef.current ?? computeFamilySetFromNodes(nodes, (targetNode.data as FoxNodeData).serviceId);

        const draggedData = targetNode.data as FoxNodeData;
        const isServiceLevel = (draggedData.depth ?? 0) === 1;
        const parentNodeForClamp = parentId ? nodes.find(n => n.id === parentId) : undefined;
        const clampedDraggedPos = !isServiceLevel && parentNodeForClamp
          ? clampToParentGap(parentNodeForClamp.position, latestPos)
          : latestPos;

        // Update desired quadrant signs during drag with hysteresis — only update when clearly on one side
        if (parentNodeForClamp && activeDragRef.current && activeDragRef.current.id === id) {
          const dx = clampedDraggedPos.x - parentNodeForClamp.position.x;
          const dy = clampedDraggedPos.y - parentNodeForClamp.position.y;
          const sx = axisSide(dx);
          const sy = axisSide(dy);
          if (sx !== 0) activeDragRef.current.desiredXSign = sx;
          if (sy !== 0) activeDragRef.current.desiredYSign = sy;
        }

        let nextNodes = nodes.map(node => {
          const inBranch = branchIds.has(node.id);
          const inFamily = familySet.has(node.id);
          if (!inBranch && !inFamily) return node;
          if (node.id === id) {
            return { ...node, position: { x: clampedDraggedPos.x, y: clampedDraggedPos.y } };
          }
          const start = startPositions.get(node.id) ?? node.position;
          if (inBranch) {
            const adjDeltaX = clampedDraggedPos.x - (startPositions.get(id)?.x ?? targetNode.position.x);
            const adjDeltaY = clampedDraggedPos.y - (startPositions.get(id)?.y ?? targetNode.position.y);
            const adjExtraAfterMirrorX = clampedDraggedPos.x - mirroredRootX;
            const adjExtraAfterMirrorY = clampedDraggedPos.y - mirroredRootY;
            const nextX = crossedAxisX ? (-start.x + adjExtraAfterMirrorX) : (start.x + adjDeltaX);
            const nextY = crossedAxisY ? (-start.y + adjExtraAfterMirrorY) : (start.y + adjDeltaY);
            return { ...node, position: { x: nextX, y: nextY } };
          }
          if (!crossedAxisX && !crossedAxisY) return node;
          const nextX = crossedAxisX ? (-start.x + extraAfterMirrorX) : (start.x + totalDeltaX);
          const nextY = crossedAxisY ? (-start.y + extraAfterMirrorY) : (start.y + totalDeltaY);
          return { ...node, position: { x: nextX, y: nextY } };
        });

        {
          const parentId = parentLookup.get(id) ?? null;
          if (parentId) {
            const siblingIds = (childrenLookup.get(parentId) ?? []).map(c => c.id);
            if (siblingIds.length > 1) {
              const siblingSet = new Set(siblingIds);
              const liveSiblingsAll = nextNodes.filter(n => siblingSet.has(n.id));
              const draggedNodeLive = nextNodes.find(n => n.id === id);
              const draggedDepth = (draggedNodeLive ? (draggedNodeLive.data as FoxNodeData).depth ?? 0 : 0);
              const isServiceLevelDrag = draggedDepth === 1;

              if (isServiceLevelDrag) {
                const liveServiceSiblings = liveSiblingsAll.filter(n => ((n.data as FoxNodeData).depth ?? 0) === 1);
                const parentNodeLive = nextNodes.find(n => n.id === parentId);
                if (parentNodeLive && liveServiceSiblings.length > 1) {
                  const sorted = liveServiceSiblings.slice().sort((a, b) => a.position.y - b.position.y);
                  const adjustments = new Map<string, number>();
                  sorted.forEach((sib, index) => {
                    if (sib.id === id) return;
                    const targetY = (parentNodeLive.position.y + VERTICAL_GAP + VERTICAL_GAP * index);
                    const dy = clampStep(targetY - sib.position.y);
                    if (dy !== 0) adjustments.set(sib.id, dy);
                  });
                  if (adjustments.size > 0) {
                    const membership = new Map<string, number>();
                    const branchCache = new Map<string, string[]>();
                    adjustments.forEach((dy, rootId) => {
                      membership.set(rootId, dy);
                      const cached = branchCache.get(rootId) ?? lookups.getDescendantIds(rootId);
                      branchCache.set(rootId, cached);
                      cached.forEach(descId => membership.set(descId, dy));
                    });
                    nextNodes = nextNodes.map(n => {
                      const dy = membership.get(n.id);
                      if (dy === undefined) return n;
                      return { ...n, position: { x: n.position.x, y: (n.position.y + dy) } };
                    });
                  }
                }
              } else {
                const liveSiblings = liveSiblingsAll;
                // If any sibling branch is expanded (taller than one node),
                // skip tidy stacking to avoid fighting with branch spacing.
                const branchInfo = liveSiblings.map(sib => {
                  const ids = new Set([sib.id, ...lookups.getDescendantIds(sib.id)]);
                  const bounds = computeBranchBounds(nextNodes as any, ids);
                  return { root: sib, ids, ...bounds };
                });
                const anyExpanded = branchInfo.some(b => b.maxY - b.minY > NODE_HEIGHT);
                if (!anyExpanded) {
                  const parentNodeLive = nextNodes.find(n => n.id === parentId);
                  if (parentNodeLive) {
                    const sorted = liveSiblings.slice().sort((a, b) => a.position.y - b.position.y);
                    const adjustments = new Map<string, number>();
                    sorted.forEach((sib, index) => {
                      if (sib.id === id) return;
                      const targetY = (parentNodeLive.position.y + VERTICAL_GAP + VERTICAL_GAP * index);
                      const dy = clampStep(targetY - sib.position.y);
                      if (dy !== 0) adjustments.set(sib.id, dy);
                    });
                    if (adjustments.size > 0) {
                      const membership = new Map<string, number>();
                      const branchCache = new Map<string, string[]>();
                      adjustments.forEach((dy, rootId) => {
                        membership.set(rootId, dy);
                        const cached = branchCache.get(rootId) ?? lookups.getDescendantIds(rootId);
                        branchCache.set(rootId, cached);
                        cached.forEach(descId => membership.set(descId, dy));
                      });
                      nextNodes = nextNodes.map(n => {
                        const dy = membership.get(n.id);
                        if (dy === undefined) return n;
                        return { ...n, position: { x: n.position.x, y: (n.position.y + dy) } };
                      });
                    }
                  }
                }
              }
            }
          }
        }

        {
          const draggedNodeLive = nextNodes.find(n => n.id === id);
          const draggedDepth = (draggedNodeLive ? (draggedNodeLive.data as FoxNodeData).depth ?? 0 : 0);
          const isServiceLevelDrag = draggedDepth === 1;
          const directParentId = parentLookup.get(id) ?? null;
          const grandParentId = directParentId ? parentLookup.get(directParentId) ?? null : null;

          const resolveAndSpaceBranches = (branchRootIds: string[], draggedRootId: string) => {
            if (branchRootIds.length <= 1) return;
            const idToIndex = new Map(nextNodes.map((n, i) => [n.id, i]));
            const branches = branchRootIds.map(rootId => {
              const ids = new Set([rootId, ...getDescendantIds(rootId)]);
              const bounds = computeBranchBounds(nextNodes, ids);
              return { rootId, ids, ...bounds };
            });
            const parentGroupId = parentLookup.get(draggedRootId) ?? null;
            const parentNode = parentGroupId ? nextNodes.find(n => n.id === parentGroupId) : null;
            const parentPosition = parentNode?.position ?? { x: 0, y: 0 };
            const parentDepth = parentNode ? ((parentNode.data as FoxNodeData).depth ?? 0) : null;
            const parentBoundary = parentDepth === 0 && parentNode ? buildBoundaryFromParent(parentNode) : null;
            const rootNodeCache = new Map<string, Node<FoxNodeData> | undefined>();
            const getRootNode = (rootId: string) => {
              if (!rootNodeCache.has(rootId)) {
                rootNodeCache.set(rootId, nextNodes.find(n => n.id === rootId));
              }
              return rootNodeCache.get(rootId);
            };
            const quadrantCache = new Map<string, string>();
            const getQuadrantForRoot = (rootId: string) => {
              if (quadrantCache.has(rootId)) return quadrantCache.get(rootId)!;
              const node = getRootNode(rootId);
              const key = node ? computeQuadrantKeyFromPositions(node.position, parentPosition) : '0:0';
              quadrantCache.set(rootId, key);
              return key;
            };
            const isBranchOutsideBoundary = (rootId: string): boolean => {
              if (!parentBoundary) return false;
              const node = getRootNode(rootId);
              if (!node) return false;
              const center = getNodeCenter(node);
              return isCenterOutsideBoundary(center, parentBoundary);
            };
            if (isBranchOutsideBoundary(draggedRootId)) return;
            const draggedQuadrantKey = getQuadrantForRoot(draggedRootId);
            const relevantBranches = branches.filter(branch => {
              if (getQuadrantForRoot(branch.rootId) !== draggedQuadrantKey) return false;
              if (isBranchOutsideBoundary(branch.rootId)) return false;
              return true;
            });
            if (relevantBranches.length <= 1) return;
            const sorted = relevantBranches.slice().sort((a, b) => a.minY - b.minY);
            const draggedIndex = sorted.findIndex(b => b.rootId === draggedRootId);
            if (draggedIndex === -1) return;
            // Push all branches below the dragged branch down enough to keep gap
            for (let i = draggedIndex + 1; i < sorted.length; i += 1) {
              const prev = sorted[i - 1];
              const cur = sorted[i];
              const neededTop = prev.maxY + BRANCH_PAD;
              const rawDy = neededTop - cur.minY;
              const dy = clampStep(rawDy);
              if (dy !== 0) {
                cur.ids.forEach(nid => {
                  const idx = idToIndex.get(nid);
                  if (idx === undefined) return;
                  const node = nextNodes[idx];
                  nextNodes[idx] = { ...node, position: { x: node.position.x, y: node.position.y + dy } };
                });
                cur.minY += dy;
                cur.maxY += dy;
              }
            }
            // Pull branches above the dragged branch up enough to keep gap
            for (let i = draggedIndex - 1; i >= 0; i -= 1) {
              const next = sorted[i + 1];
              const cur = sorted[i];
              const neededBottom = next.minY - BRANCH_PAD;
              const rawDy = neededBottom - cur.maxY;
              const dy = clampStep(rawDy);
              if (dy !== 0) {
                cur.ids.forEach(nid => {
                  const idx = idToIndex.get(nid);
                  if (idx === undefined) return;
                  const node = nextNodes[idx];
                  nextNodes[idx] = { ...node, position: { x: node.position.x, y: node.position.y + dy } };
                });
                cur.minY += dy;
                cur.maxY += dy;
              }
            }
          };

          if (!isServiceLevelDrag && directParentId && grandParentId) {
            const branchRoots = (childrenLookup.get(grandParentId) ?? []).map(c => c.id);
            resolveAndSpaceBranches(branchRoots, directParentId);
          } else if (isServiceLevelDrag && directParentId) {
            const rootBranchRoots = (childrenLookup.get(directParentId) ?? []).map(c => c.id);
            resolveAndSpaceBranches(rootBranchRoots, id);
          }
        }

        {
          const draggedFinal = nextNodes.find(n => n.id === id) ?? targetNode;
          const draggedDepth = ((draggedFinal.data as FoxNodeData).depth ?? 0);
          const isServiceLevelDrag = draggedDepth === 1;
          if (!isServiceLevelDrag) {
            const signX = (draggedFinal.position.x ?? 0) >= 0 ? 1 : -1;
            const signY = (draggedFinal.position.y ?? 0) >= 0 ? 1 : -1;
            let minAbsX = Infinity;
            let minAbsY = Infinity;
            nextNodes.forEach(n => {
              if (!familySet.has(n.id)) return;
              const ax = Math.abs(n.position.x);
              const ay = Math.abs(n.position.y);
              if (ax < minAbsX) minAbsX = ax;
              if (ay < minAbsY) minAbsY = ay;
            });
            const rawPushX = Math.max(0, HORIZONTAL_GAP - (isFinite(minAbsX) ? minAbsX : HORIZONTAL_GAP));
            const rawPushY = Math.max(0, DRAG_VERTICAL_GAP - (isFinite(minAbsY) ? minAbsY : DRAG_VERTICAL_GAP));
            const pushX = rawPushX > AXIS_PUSH_HYSTERESIS ? (rawPushX - AXIS_PUSH_HYSTERESIS) : 0;
            const pushY = rawPushY > AXIS_PUSH_HYSTERESIS ? (rawPushY - AXIS_PUSH_HYSTERESIS) : 0;
            if (pushX > 0 || pushY > 0) {
              const dx = clampStep(signX * pushX);
              const dy = clampStep(signY * pushY);
              nextNodes = nextNodes.map(n => {
                if (!familySet.has(n.id)) return n;
                return { ...n, position: { x: (n.position.x + dx), y: (n.position.y + dy) } };
              });
            }
          }
        }

        nextNodes = enforceServiceNodeBoundary(nodes, nextNodes, id, parentLookup);

        return nextNodes;
      });
    },
    [getDescendantIds, parentLookup, childrenLookup, setFlowNodes],
  );

  const handleNodeDrag = useCallback(
    (id: string, position?: XYPosition | null) => {
      if (!position || id === 'fox-root') return;

      lastDragIdRef.current = id;
      lastDragPositionRef.current = position;

      if (rafInFlightRef.current) {
        rafQueuedRef.current = true;
        return;
      }

      rafInFlightRef.current = true;
      rafIdRef.current = requestAnimationFrame(() => {
        const dragId = lastDragIdRef.current;
        const dragPos = lastDragPositionRef.current;
        if (dragId && dragPos) {
          rawHandleNodeDrag(dragId, dragPos);
        }
        // Clear the scheduled rAF id
        rafIdRef.current = null;
        rafInFlightRef.current = false;
        if (rafQueuedRef.current) {
          rafQueuedRef.current = false;
          const nextId = lastDragIdRef.current;
          const nextPos = lastDragPositionRef.current;
          if (nextId && nextPos) {
            handleNodeDrag(nextId, nextPos);
          }
        }
      });
    },
    [rawHandleNodeDrag],
  );

  const handleNodeDragStop = useCallback(
    (id: string, _position?: XYPosition | null) => {
      if (id === 'fox-root') {
        activeDragRef.current = null;
        return;
      }

      // Cancel any pending drag rAF to avoid stale updates after finalize
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      // If we had a queued/in-flight update for this id, flush once synchronously
      if ((rafInFlightRef.current || rafQueuedRef.current) && lastDragIdRef.current === id && lastDragPositionRef.current) {
        rafInFlightRef.current = false;
        rafQueuedRef.current = false;
        rawHandleNodeDrag(id, lastDragPositionRef.current);
      }
      // Clear last-known drag to avoid any stale reuse
      lastDragIdRef.current = null;
      lastDragPositionRef.current = null;

      let updatedNodesSnapshot: Array<Node<FoxNodeData>> = [];
      let branchMutationsSnapshot: Array<{
        id: string;
        branchIds: string[];
        deltaX: number;
        deltaY: number;
        finalPosition: XYPosition;
      }> = [];

      setFlowNodes(nodes => {
        const existingIndex = nodes.findIndex(node => node.id === id);
        if (existingIndex === -1) {
          updatedNodesSnapshot = nodes;
          branchMutationsSnapshot = [];
          return nodes;
        }

        const targetNode = nodes[existingIndex];
        const parentId = parentLookup.get(id);

        if (!parentId) {
          updatedNodesSnapshot = nodes;
          branchMutationsSnapshot = [];
          activeDragRef.current = null;
          return nodes;
        }

        const parentNode = nodes.find(node => node.id === parentId);
        if (!parentNode) {
          updatedNodesSnapshot = nodes;
          branchMutationsSnapshot = [];
          activeDragRef.current = null;
          return nodes;
        }

        const dragState = activeDragRef.current;
        activeDragRef.current = null;

        const parentPosition = parentNode.position;
        const branchAdjustments: Array<{
          id: string;
          branchIds: Set<string>;
          currentX: number;
          currentY: number;
          targetX: number;
          targetY: number;
          quadrantKey: string;
          resolvedY?: number;
          finalX?: number;
          finalY?: number;
          deltaX?: number;
          deltaY?: number;
        }> = [];

        const storedSX = (dragState && dragState.id === id ? dragState.desiredXSign : undefined);
        const storedSY = (dragState && dragState.id === id ? dragState.desiredYSign : undefined);
        const primaryDirectionX =
          dragState && dragState.id === id && (storedSX === -1 || storedSX === 1)
            ? storedSX
            : (dragState && dragState.id === id
                ? (dragState.lastCursor?.x ?? targetNode.position.x) - parentPosition.x
                : targetNode.position.x - parentPosition.x);
        const primaryDirectionY =
          dragState && dragState.id === id && (storedSY === -1 || storedSY === 1)
            ? storedSY
            : (dragState && dragState.id === id
                ? (dragState.lastCursor?.y ?? targetNode.position.y) - parentPosition.y
                : targetNode.position.y - parentPosition.y);

        const initialOffset = dragState?.initialParentOffset ?? null;

        const branchIds = new Set([id, ...getDescendantIds(id)]);
        const targetX = snapWithMinimum(
          targetNode.position.x,
          parentPosition.x,
          HORIZONTAL_GAP,
          resolveDirectionHint(primaryDirectionX, initialOffset?.x ?? null),
        );
        const targetY = snapWithMinimum(
          targetNode.position.y,
          parentPosition.y,
          VERTICAL_GAP,
          resolveDirectionHint(primaryDirectionY, initialOffset?.y ?? null),
        );
        const targetQuadrant = quadrantKeyFromDelta(targetX - parentPosition.x, targetY - parentPosition.y);

        branchAdjustments.push({
          id,
          branchIds,
          currentX: targetNode.position.x,
          currentY: targetNode.position.y,
          targetX,
          targetY,
          quadrantKey: targetQuadrant,
        });

        const siblingNodes = (childrenLookup.get(parentId) ?? [])
          .map(child => nodes.find(node => node.id === child.id))
          .filter((sibling): sibling is Node<FoxNodeData> => Boolean(sibling) && sibling.id !== id);

        siblingNodes.forEach(siblingNode => {
          const siblingBranchIds = new Set([siblingNode.id, ...getDescendantIds(siblingNode.id)]);
          const diffX = siblingNode.position.x - parentPosition.x;
          const diffY = siblingNode.position.y - parentPosition.y;
          const siblingTargetX = snapWithMinimum(
            siblingNode.position.x,
            parentPosition.x,
            HORIZONTAL_GAP,
            resolveDirectionHint(diffX, diffX),
          );
          const siblingTargetY = snapWithMinimum(
            siblingNode.position.y,
            parentPosition.y,
            VERTICAL_GAP,
            resolveDirectionHint(diffY, diffY),
          );
          const siblingQuadrant = quadrantKeyFromDelta(siblingTargetX - parentPosition.x, siblingTargetY - parentPosition.y);
          branchAdjustments.push({
            id: siblingNode.id,
            branchIds: siblingBranchIds,
            currentX: siblingNode.position.x,
            currentY: siblingNode.position.y,
            targetX: siblingTargetX,
            targetY: siblingTargetY,
            quadrantKey: siblingQuadrant,
          });
        });

        if (branchAdjustments.length === 0) {
          updatedNodesSnapshot = nodes;
          branchMutationsSnapshot = [];
          return nodes;
        }

        const branchesByQuadrant = new Map<string, typeof branchAdjustments>();
        branchAdjustments.forEach(branch => {
          const group = branchesByQuadrant.get(branch.quadrantKey);
          if (group) {
            group.push(branch);
          } else {
            branchesByQuadrant.set(branch.quadrantKey, [branch]);
          }
        });
        const draggedQuadrantKey = branchAdjustments.find(branch => branch.id === id)?.quadrantKey ?? targetQuadrant;
        branchesByQuadrant.forEach((group, key) => {
          if (key !== draggedQuadrantKey) {
            group.forEach(branch => {
              branch.resolvedY = snapPosition(branch.targetY);
            });
            return;
          }
          const sorted = group.slice().sort((a, b) => a.targetY - b.targetY);
          sorted.forEach((branch, index) => {
            if (index === 0) {
              branch.resolvedY = snapPosition(branch.targetY);
              return;
            }
            const previous = sorted[index - 1];
            const previousY = previous.resolvedY ?? snapPosition(previous.targetY);
            let resolvedY = snapPosition(branch.targetY);
            const minimum = previousY + VERTICAL_GAP;
            if (resolvedY < minimum) resolvedY = snapUpToGrid(minimum);
            branch.resolvedY = resolvedY;
          });
        });

        branchAdjustments.forEach(branch => {
          branch.finalX = branch.targetX;
          branch.finalY = branch.resolvedY ?? snapPosition(branch.targetY);
          branch.deltaX = branch.finalX - branch.currentX;
          branch.deltaY = branch.finalY - branch.currentY;
        });

        const branchMembership = new Map<string, (typeof branchAdjustments)[number]>();
        branchAdjustments.forEach(branch => {
          branch.branchIds.forEach(nodeId => {
            branchMembership.set(nodeId, branch);
          });
        });

        const updatedNodes = nodes.map(nodeItem => {
          const branch = branchMembership.get(nodeItem.id);
          if (!branch) {
            const sx = snapPosition(nodeItem.position.x);
            const sy = snapPosition(nodeItem.position.y);
            if (sx === nodeItem.position.x && sy === nodeItem.position.y) return nodeItem;
            return { ...nodeItem, position: { x: sx, y: sy } };
          }
          if (nodeItem.id === branch.id) {
            return { ...nodeItem, position: { x: branch.finalX ?? branch.targetX, y: branch.finalY ?? branch.targetY } };
          }
          return {
            ...nodeItem,
            position: {
              x: snapPosition(nodeItem.position.x + (branch.deltaX ?? 0)),
              y: snapPosition(nodeItem.position.y + (branch.deltaY ?? 0)),
            },
          };
        });

        let finalNodes = enforceGridAndReflow(updatedNodes);

        const startPositions = dragStartPositionsRef.current;
        if (startPositions) {
          const start = startPositions.get(id);
          const finalNode = finalNodes.find(n => n.id === id);
          const finalX = finalNode ? finalNode.position.x : targetNode.position.x;
          const finalY = finalNode ? finalNode.position.y : targetNode.position.y;
          const startX = start ? start.x : targetNode.position.x;
          const startY = start ? start.y : targetNode.position.y;
          const crossedAxisX = (startX < 0 && finalX > 0) || (startX > 0 && finalX < 0);
          const crossedAxisY = (startY < 0 && finalY > 0) || (startY > 0 && finalY < 0);
          if (crossedAxisX || crossedAxisY) {
            const familySet =
              dragFamilyIdsRef.current ?? computeFamilySetFromNodes(finalNodes, (targetNode.data as FoxNodeData).serviceId);
            const mirroredRootX = -startX;
            const mirroredRootY = -startY;
            const extraAfterMirrorX = finalX - mirroredRootX;
            const extraAfterMirrorY = finalY - mirroredRootY;
            const totalDeltaX = finalX - startX;
            const totalDeltaY = finalY - startY;
            finalNodes = finalNodes.map(n => {
              if (!familySet.has(n.id)) return n;
              if (n.id === id) return n;
              const origin = startPositions.get(n.id) ?? n.position;
              return {
                ...n,
                position: {
                  x: snapPosition(crossedAxisX ? -origin.x + extraAfterMirrorX : origin.x + totalDeltaX),
                  y: snapPosition(crossedAxisY ? -origin.y + extraAfterMirrorY : origin.y + totalDeltaY),
                },
              };
            });
          }
        }

        {
          const droppedNode = finalNodes.find(n => n.id === id);
          const isServiceLevelDrop = (droppedNode ? (droppedNode.data as FoxNodeData).depth ?? 0 : 0) === 1;
          if (!isServiceLevelDrop) {
            const directParentId = parentLookup.get(id) ?? null;
            const grandParentId = directParentId ? parentLookup.get(directParentId) ?? null : null;
            if (directParentId && grandParentId) {
              const branchRoots = (childrenLookup.get(grandParentId) ?? []).map(c => c.id);
              if (branchRoots.length > 1) {
                const idToIndex = new Map(finalNodes.map((n, i) => [n.id, i]));
                const parentNode = finalNodes.find(n => n.id === grandParentId);
                const parentPosition = parentNode?.position ?? { x: 0, y: 0 };
                const branchDescriptors = branchRoots.map(rootId => {
                  const ids = new Set([rootId, ...getDescendantIds(rootId)]);
                  const bounds = computeBranchBounds(finalNodes, ids);
                  return { rootId, ids, ...bounds };
                });
                const quadrantCache = new Map<string, string>();
                const getQuadrantForRoot = (rootId: string) => {
                  if (quadrantCache.has(rootId)) return quadrantCache.get(rootId)!;
                  const node = finalNodes.find(n => n.id === rootId);
                  const key = node ? computeQuadrantKeyFromPositions(node.position, parentPosition) : '0:0';
                  quadrantCache.set(rootId, key);
                  return key;
                };
                const draggedQuadrantKey = getQuadrantForRoot(directParentId);
                const relevantBranches = branchDescriptors
                  .filter(descriptor => getQuadrantForRoot(descriptor.rootId) === draggedQuadrantKey)
                  .sort((a, b) => a.minY - b.minY);
                const draggedIndex = relevantBranches.findIndex(b => b.rootId === directParentId);
                if (draggedIndex !== -1) {
                  for (let i = draggedIndex + 1; i < relevantBranches.length; i += 1) {
                    const prev = relevantBranches[i - 1];
                    const cur = relevantBranches[i];
                    const neededTop = prev.maxY + BRANCH_PAD;
                    const dy = snapPosition(neededTop - cur.minY);
                    if (dy !== 0) {
                      cur.ids.forEach(nid => {
                        const idx = idToIndex.get(nid);
                        if (idx === undefined) return;
                        const node = finalNodes[idx];
                        finalNodes[idx] = { ...node, position: { x: node.position.x, y: snapPosition(node.position.y + dy) } };
                      });
                      cur.minY = snapPosition(cur.minY + dy);
                      cur.maxY = snapPosition(cur.maxY + dy);
                    }
                  }
                  for (let i = draggedIndex - 1; i >= 0; i -= 1) {
                    const next = relevantBranches[i + 1];
                    const cur = relevantBranches[i];
                    const neededBottom = next.minY - BRANCH_PAD;
                    const dy = snapPosition(neededBottom - cur.maxY);
                    if (dy !== 0) {
                      cur.ids.forEach(nid => {
                        const idx = idToIndex.get(nid);
                        if (idx === undefined) return;
                        const node = finalNodes[idx];
                        finalNodes[idx] = { ...node, position: { x: node.position.x, y: snapPosition(node.position.y + dy) } };
                      });
                      cur.minY = snapPosition(cur.minY + dy);
                      cur.maxY = snapPosition(cur.maxY + dy);
                    }
                  }
                }
              }
            }
          }
        }

        // Also resolve branch spacing when a service-level node was dropped.
        if ((finalNodes.find(n => n.id === id)?.data as FoxNodeData | undefined)?.depth === 1) {
          const rootId = parentLookup.get(id) ?? null;
          if (rootId) {
            const branchRoots = (childrenLookup.get(rootId) ?? []).map(c => c.id);
            if (branchRoots.length > 1) {
              const idToIndex = new Map(finalNodes.map((n, i) => [n.id, i]));
              const parentNode = finalNodes.find(n => n.id === rootId);
              const parentPosition = parentNode?.position ?? { x: 0, y: 0 };
              const parentDepth = parentNode ? ((parentNode.data as FoxNodeData).depth ?? 0) : null;
              const parentBoundary = parentDepth === 0 && parentNode ? buildBoundaryFromParent(parentNode) : null;
              const branchDescriptors = branchRoots.map(rootId2 => {
                const ids = new Set([rootId2, ...getDescendantIds(rootId2)]);
                const bounds = computeBranchBounds(finalNodes, ids);
                return { rootId: rootId2, ids, ...bounds };
              });
              const quadrantCache = new Map<string, string>();
              const getQuadrantForRoot = (rootId2: string) => {
                if (quadrantCache.has(rootId2)) return quadrantCache.get(rootId2)!;
                const node = finalNodes.find(n => n.id === rootId2);
                const key = node ? computeQuadrantKeyFromPositions(node.position, parentPosition) : '0:0';
                quadrantCache.set(rootId2, key);
                return key;
              };
              const branchNodeCache = new Map<string, Node<FoxNodeData> | undefined>();
              const getRootNode = (rootId2: string) => {
                if (!branchNodeCache.has(rootId2)) {
                  branchNodeCache.set(rootId2, finalNodes.find(n => n.id === rootId2));
                }
                return branchNodeCache.get(rootId2);
              };
              const isBranchOutsideBoundary = (rootId2: string): boolean => {
                if (!parentBoundary) return false;
                const node = getRootNode(rootId2);
                if (!node) return false;
                const center = getNodeCenter(node);
                return isCenterOutsideBoundary(center, parentBoundary);
              };
              const draggedQuadrantKey = getQuadrantForRoot(id);
              const relevantBranches = branchDescriptors
                .filter(descriptor => getQuadrantForRoot(descriptor.rootId) === draggedQuadrantKey)
                .filter(descriptor => !isBranchOutsideBoundary(descriptor.rootId))
                .sort((a, b) => a.minY - b.minY);
              const skipAdjustments = parentBoundary ? isBranchOutsideBoundary(id) : false;
              if (!skipAdjustments) {
                const draggedIndex = relevantBranches.findIndex(b => b.rootId === id);
                if (draggedIndex !== -1) {
                  for (let i = draggedIndex + 1; i < relevantBranches.length; i += 1) {
                    const prev = relevantBranches[i - 1];
                    const cur = relevantBranches[i];
                    const neededTop = prev.maxY + BRANCH_PAD;
                    const dy = snapPosition(neededTop - cur.minY);
                    if (dy !== 0) {
                      cur.ids.forEach(nid => {
                        const idx = idToIndex.get(nid);
                        if (idx === undefined) return;
                        const node = finalNodes[idx];
                        finalNodes[idx] = { ...node, position: { x: node.position.x, y: snapPosition(node.position.y + dy) } };
                      });
                      cur.minY = snapPosition(cur.minY + dy);
                      cur.maxY = snapPosition(cur.maxY + dy);
                    }
                  }
                  for (let i = draggedIndex - 1; i >= 0; i -= 1) {
                    const next = relevantBranches[i + 1];
                    const cur = relevantBranches[i];
                    const neededBottom = next.minY - BRANCH_PAD;
                    const dy = snapPosition(neededBottom - cur.maxY);
                    if (dy !== 0) {
                      cur.ids.forEach(nid => {
                        const idx = idToIndex.get(nid);
                        if (idx === undefined) return;
                        const node = finalNodes[idx];
                        finalNodes[idx] = { ...node, position: { x: node.position.x, y: snapPosition(node.position.y + dy) } };
                      });
                      cur.minY = snapPosition(cur.minY + dy);
                      cur.maxY = snapPosition(cur.maxY + dy);
                    }
                  }
                }
              }
            }
          }
        }

        {
          const draggedFinalNode = finalNodes.find(n => n.id === id) ?? targetNode;
          const draggedDepth = ((draggedFinalNode.data as FoxNodeData).depth ?? 0);
          const isServiceLevelDrop = draggedDepth === 1;
          if (!isServiceLevelDrop) {
            const familySet = dragFamilyIdsRef.current ?? computeFamilySetFromNodes(finalNodes, (targetNode.data as FoxNodeData).serviceId);
            const signX = (draggedFinalNode.position.x ?? 0) >= 0 ? 1 : -1;
            const signY = (draggedFinalNode.position.y ?? 0) >= 0 ? 1 : -1;
            let minAbsX = Infinity;
            let minAbsY = Infinity;
            finalNodes.forEach(n => {
              if (!familySet.has(n.id)) return;
              const ax = Math.abs(n.position.x);
              const ay = Math.abs(n.position.y);
              if (ax < minAbsX) minAbsX = ax;
              if (ay < minAbsY) minAbsY = ay;
            });
            const pushX = Math.max(0, HORIZONTAL_GAP - (isFinite(minAbsX) ? minAbsX : HORIZONTAL_GAP));
            const pushY = Math.max(0, DRAG_VERTICAL_GAP - (isFinite(minAbsY) ? minAbsY : DRAG_VERTICAL_GAP));
            if (pushX > 0 || pushY > 0) {
              const dx = snapPosition(signX * pushX);
              const dy = snapPosition(signY * pushY);
              finalNodes = finalNodes.map(n => {
                if (!familySet.has(n.id)) return n;
                return { ...n, position: { x: snapPosition(n.position.x + dx), y: snapPosition(n.position.y + dy) } };
              });
            }
          }
        }

        // Note: We rely on snapWithMinimum earlier to enforce parent-relative
        // minimum gaps. Avoid additional clamping here to prevent reordering
        // conflicts with sibling/branch spacing computed above.

        {
          const scopeSet = dragFamilyIdsRef.current ?? computeFamilySetFromNodes(finalNodes, (targetNode.data as FoxNodeData).serviceId);
          const orderedDepths = Array.from(
            finalNodes.reduce((acc, node) => {
              if (!scopeSet.has(node.id)) return acc;
              const nodeDepth = ((node.data as FoxNodeData).depth ?? 0);
              if (nodeDepth > 0) acc.add(nodeDepth);
              return acc;
            }, new Set<number>()),
          ).sort((a, b) => a - b).filter(d => d !== 1); // skip service-level; branch spacing handles it
          orderedDepths.forEach(depth => {
            finalNodes = enforceDepthVerticalSeparation(finalNodes, scopeSet, depth, getDescendantIds);
          });
        }

        finalNodes = enforceServiceNodeBoundary(nodes, finalNodes, id, parentLookup);

        updatedNodesSnapshot = finalNodes;
        branchMutationsSnapshot = branchAdjustments.map(branch => ({
          id: branch.id,
          branchIds: Array.from(branch.branchIds),
          deltaX: branch.deltaX ?? 0,
          deltaY: branch.deltaY ?? 0,
          finalPosition: { x: branch.finalX ?? branch.targetX, y: branch.finalY ?? branch.targetY },
        }));

        return finalNodes;
      });

      const parentId = parentLookup.get(id);
      if (!parentId) return;

      // Consolidate manual position updates into a single write to avoid duplicate updates
      {
        const updatedMap = new Map(updatedNodesSnapshot.map(node => [node.id, node]));
        const draggedNode = updatedNodesSnapshot.find(n => n.id === id);
        const draggedServiceId = (draggedNode?.data as FoxNodeData | undefined)?.serviceId;
        const familySet = dragFamilyIdsRef.current ?? computeFamilySetFromNodes(updatedNodesSnapshot, draggedServiceId);
        const hasBranchMutations = branchMutationsSnapshot.length > 0;
        setManualPositions(prev => {
          const next = new Map(prev);
          let mutated = false;
          const applied = new Set<string>();
          // Apply updated positions for all nodes in the active drag family
          familySet.forEach(nodeId => {
            const updatedNode = updatedMap.get(nodeId);
            if (updatedNode) {
              const prevPos = next.get(nodeId);
              if (!prevPos || prevPos.x !== updatedNode.position.x || prevPos.y !== updatedNode.position.y) {
                next.set(nodeId, { ...updatedNode.position });
                mutated = true;
              }
              applied.add(nodeId);
            }
          });
          // Also apply branch mutations (siblings and their descendants) not already covered by familySet
          if (hasBranchMutations) {
            branchMutationsSnapshot.forEach(branch => {
              branch.branchIds.forEach(nodeId => {
                if (applied.has(nodeId)) return;
                const updatedNode = updatedMap.get(nodeId);
                if (updatedNode) {
                  const prevPos = next.get(nodeId);
                  if (!prevPos || prevPos.x !== updatedNode.position.x || prevPos.y !== updatedNode.position.y) {
                    next.set(nodeId, { ...updatedNode.position });
                    mutated = true;
                  }
                } else if (next.has(nodeId)) {
                  const stored = next.get(nodeId)!;
                  const nx = snapPosition(stored.x + branch.deltaX);
                  const ny = snapPosition(stored.y + branch.deltaY);
                  if (stored.x !== nx || stored.y !== ny) {
                    next.set(nodeId, { x: nx, y: ny });
                    mutated = true;
                  }
                }
                applied.add(nodeId);
              });
            });
          }
          return mutated ? next : prev;
        });
      }

      dragStartPositionsRef.current = null;
      dragFamilyIdsRef.current = null;

      const siblings = childrenLookup.get(parentId);
      if (!siblings || siblings.length <= 1) return;

      const draggedNodeForOrder = updatedNodesSnapshot.find(n => n.id === id);
      const isServiceLevelDragged = ((draggedNodeForOrder?.data as FoxNodeData | undefined)?.depth ?? 0) === 1;
      setCustomOrder(prev => {
        const siblingIds = siblings.map(child => child.id);
        if (!siblingIds.includes(id)) return prev;
        const baseOrder = prev.get(parentId) ?? siblingIds;
        const visibleSiblingsAll = updatedNodesSnapshot
          .filter(node => {
            const data = node.data as FoxNodeData;
            return (data.parentId ?? null) === parentId && siblingIds.includes(node.id);
          })
          .map(node => ({ id: node.id, y: node.position.y, depth: (node.data as FoxNodeData).depth ?? 0 }));
        const visibleSiblings = isServiceLevelDragged
          ? visibleSiblingsAll.filter(v => v.depth === 1).map(({ id, y }) => ({ id, y }))
          : visibleSiblingsAll.map(({ id, y }) => ({ id, y }));
        if (visibleSiblings.length <= 1) return prev;
        const sortedVisibleIds = visibleSiblings.slice().sort((a, b) => a.y - b.y).map(item => item.id);
        let mergedOrder: string[] = [];
        let baselineForCompare: string[] = baseOrder;
        if (isServiceLevelDragged) {
          const serviceIdsSet = new Set(sortedVisibleIds);
          const nonServiceInBase = baseOrder.filter(cid => !serviceIdsSet.has(cid));
          const firstServiceIndex = baseOrder.findIndex(cid => serviceIdsSet.has(cid));
          if (firstServiceIndex === -1) {
            mergedOrder = [...nonServiceInBase, ...sortedVisibleIds];
          } else {
            const before = nonServiceInBase.filter(cid => baseOrder.indexOf(cid) < firstServiceIndex);
            const after = nonServiceInBase.filter(cid => baseOrder.indexOf(cid) >= firstServiceIndex);
            mergedOrder = [...before, ...sortedVisibleIds, ...after];
          }
        } else {
          const visibleSet = new Set(sortedVisibleIds);
          const sanitizedBase = baseOrder.filter(childId => siblingIds.includes(childId));
          const completeBase =
            sanitizedBase.length === siblingIds.length
              ? sanitizedBase
              : [...sanitizedBase, ...siblingIds.filter(childId => !sanitizedBase.includes(childId))];
          baselineForCompare = completeBase;
          const remainingVisible = [...sortedVisibleIds];
          completeBase.forEach(childId => {
            if (visibleSet.has(childId)) {
              const nextVisible = remainingVisible.shift();
              if (nextVisible) mergedOrder.push(nextVisible);
            } else {
              mergedOrder.push(childId);
            }
          });
          mergedOrder.push(...remainingVisible);
        }
        const changed = mergedOrder.length !== baselineForCompare.length || mergedOrder.some((v, i) => v !== baselineForCompare[i]);
        if (!changed) return prev;
        const next = new Map(prev);
        next.set(parentId, mergedOrder);
        return next;
      });
    },
    [childrenLookup, getDescendantIds, parentLookup, rawHandleNodeDrag, setCustomOrder, setFlowNodes, setManualPositions],
  );

  return { handleNodeDrag, handleNodeDragStop } as const;
};
