import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Edge, type Node, type XYPosition } from 'reactflow';

import { type IntegrationService } from '@/app/(interface)/components/IntegrationFilter';
import { type FolderItem, type ServiceId } from '../../right-sidebar/data';

import { type FoxNodeData } from './config';
import { createFlowLayout, snapPosition } from './layout';
import { collectDescendantIds, collectVisibleNodeIds, buildParentLookup, buildChildrenLookup } from './utils/tree';
import { computeColorAssignments } from './utils/colors';
import { reorderTreeWithCustomOrder } from './utils/order';
import { enforceGridAndReflow } from './utils/grid';

import { useServiceFilter } from './hooks/useServiceFilter';
import { useExpansionState } from './hooks/useExpansion';
import { useDragHandlers } from './hooks/useDragHandlers';

interface UseFoxThreeActionsResult {
  availableServices: IntegrationService[];
  activeServiceId: ServiceId | null;
  handleServiceSelect: (serviceId: ServiceId | null) => void;
  nodesWithControls: Array<Node<FoxNodeData>>;
  edgesToRender: Edge[];
  handleNodeDrag: (id: string, position?: XYPosition | null) => void;
  handleNodeDragStop: (id: string, position?: XYPosition | null) => void;
}

export const useFoxThreeActions = (
  folders: FolderItem[],
  colorPaletteId?: string | null,
): UseFoxThreeActionsResult => {
  // Core state for rendered nodes/edges and manual positioning
  const [flowNodes, setFlowNodes] = useState<Array<Node<FoxNodeData>>>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [customOrder, setCustomOrder] = useState<Map<string, string[]>>(new Map());
  const [manualPositions, setManualPositions] = useState<Map<string, XYPosition>>(new Map());

  // Service filter and trees
  const { tree, filteredTree, availableServices, activeServiceId, handleServiceSelect } = useServiceFilter(folders);

  // Lookups for parent/children relationships
  const parentLookup = useMemo(() => buildParentLookup(tree), [tree]);
  const childrenLookup = useMemo(() => buildChildrenLookup(tree), [tree]);

  // Keep custom order in sync with tree children
  useEffect(() => {
    setCustomOrder(prev => {
      if (prev.size === 0) return prev;
      let mutated = false;
      const next = new Map(prev);
      prev.forEach((order, parentId) => {
        const children = childrenLookup.get(parentId);
        if (!children || children.length === 0) {
          if (next.delete(parentId)) mutated = true;
          return;
        }
        const childIds = children.map(child => child.id);
        const childIdSet = new Set(childIds);
        const filteredOrder = order.filter(id => childIdSet.has(id));
        const missingIds = childIds.filter(id => !filteredOrder.includes(id));
        const updatedOrder = missingIds.length > 0 || filteredOrder.length !== order.length
          ? [...filteredOrder, ...missingIds]
          : filteredOrder;
        const currentOrder = next.get(parentId) ?? [];
        if (currentOrder.length !== updatedOrder.length || currentOrder.some((v, i) => v !== updatedOrder[i])) {
          next.set(parentId, updatedOrder);
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [childrenLookup]);

  // Colors per node using palette and service branches
  const colorAssignments = useMemo(
    () => computeColorAssignments(filteredTree, colorPaletteId),
    [filteredTree, colorPaletteId],
  );

  // Apply custom order then layout expanded nodes
  const orderedTree = useMemo(
    () => reorderTreeWithCustomOrder(filteredTree, customOrder),
    [filteredTree, customOrder],
  );

  const { expandedState, toggleNodeExpansionById, getIsNodeExpanded } = useExpansionState(filteredTree);

  const layout = useMemo(
    () => createFlowLayout(orderedTree, expandedState),
    [orderedTree, expandedState],
  );

  // Re-apply any manual positions over computed layout
  const manualPositionsRef = useRef(manualPositions);
  useEffect(() => {
    manualPositionsRef.current = manualPositions;
  }, [manualPositions]);

  useEffect(() => {
    setFlowEdges(layout.edges);
  }, [layout]);

  useEffect(() => {
    setFlowNodes(
      enforceGridAndReflow(
        layout.nodes.map(node => {
          const manual = manualPositionsRef.current.get(node.id);
          if (!manual) return { ...node, position: { ...node.position } };
          return { ...node, position: { x: manual.x, y: manual.y } };
        }),
      ),
    );
  }, [layout]);

  // Descendant helper used by drag logic
  const getDescendantIds = useCallback(
    (nodeId: string) => collectDescendantIds(childrenLookup, nodeId),
    [childrenLookup],
  );

  // Drag logic extracted
  const { handleNodeDrag, handleNodeDragStop } = useDragHandlers(
    { parentLookup, childrenLookup, getDescendantIds },
    { setFlowNodes, setManualPositions, setCustomOrder },
  );

  // Visibility filtering
  const visibleNodeIds = useMemo(
    () => collectVisibleNodeIds(filteredTree, expandedState),
    [filteredTree, expandedState],
  );

  const nodesToRender = useMemo(
    () => flowNodes.filter(node => visibleNodeIds.has(node.id)),
    [flowNodes, visibleNodeIds],
  );

  const edgesToRender = useMemo(
    () => flowEdges.filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [flowEdges, visibleNodeIds],
  );

  // Attach UI controls and computed colors per node
  const nodesWithControls = useMemo(
    () =>
      nodesToRender.map(node => {
        const typedNode = node as Node<FoxNodeData>;
        const { depth, childrenCount } = typedNode.data;
        const isExpanded = getIsNodeExpanded(node.id, depth, childrenCount);
        const colorStyle = colorAssignments.get(node.id);
        return {
          ...typedNode,
          draggable: node.id !== 'fox-root',
          data: {
            ...typedNode.data,
            isExpanded,
            // Pin current position before toggling expansion so it never snaps back
            onToggle: () => {
              // Persist this node's current position as manual before layout recomputes
              const currentPos = { x: typedNode.position.x, y: typedNode.position.y } as XYPosition;
              // Update manual positions map
              setManualPositions(prev => {
                const next = new Map(prev);
                const stored = next.get(typedNode.id);
                if (!stored || stored.x !== currentPos.x || stored.y !== currentPos.y) {
                  next.set(typedNode.id, currentPos);
                }
                return next;
              });
              toggleNodeExpansionById(node.id, depth, childrenCount);
            },
            ...(colorStyle
              ? {
                  backgroundColor: colorStyle.backgroundColor,
                  textColor: colorStyle.textColor,
                  borderColor: colorStyle.borderColor,
                  accentColor: colorStyle.accentColor,
                }
              : {}),
          },
        };
      }),
    [nodesToRender, getIsNodeExpanded, toggleNodeExpansionById, colorAssignments, setManualPositions],
  );

  return {
    availableServices,
    activeServiceId,
    handleServiceSelect,
    nodesWithControls,
    edgesToRender,
    handleNodeDrag,
    handleNodeDragStop,
  };
};
