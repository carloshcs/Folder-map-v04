import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Edge, type Node, type XYPosition } from 'reactflow';

import { type IntegrationService } from '@/app/(interface)/components/IntegrationFilter';
import { getPaletteColors, getReadableTextColor, shiftColor } from '@/app/(interface)/lib/utils/colors';

import { type FolderItem, type ServiceId } from '../../right-sidebar/data';
import {
  DEFAULT_MAX_DEPTH,
  HORIZONTAL_GAP,
  VERTICAL_GAP,
  type FoxNodeData,
  type FoxTreeNode,
} from './foxThreeConfig';
import { createFlowLayout, snapPosition } from './foxThreeCompile';
import { SERVICE_DETAILS, buildFoxTree } from './foxThreeOrganization';

interface UseFoxThreeActionsResult {
  availableServices: IntegrationService[];
  activeServiceId: ServiceId | null;
  handleServiceSelect: (serviceId: ServiceId | null) => void;
  nodesWithControls: Array<Node<FoxNodeData>>;
  edgesToRender: Edge[];
  handleNodeDrag: (id: string, position?: XYPosition | null) => void;
  handleNodeDragStop: (id: string, position?: XYPosition | null) => void;
}

const collectVisibleNodeIds = (
  root: FoxTreeNode,
  expandedState: Map<string, boolean>,
): Set<string> => {
  const visible = new Set<string>();

  const traverse = (node: FoxTreeNode, depth: number) => {
    visible.add(node.id);

    if (!node.children || node.children.length === 0) {
      return;
    }

    const explicit = expandedState.get(node.id);
    const isExpanded = explicit !== undefined ? explicit : depth < DEFAULT_MAX_DEPTH;

    if (!isExpanded) {
      return;
    }

    node.children.forEach(child => traverse(child, depth + 1));
  };

  traverse(root, 0);

  return visible;
};

type NodeColorAssignment = {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
};

const MAX_LIGHTENING = 0.75;
const DESCENDANT_LIGHTEN_STEP = 0.18;
const FIRST_DESCENDANT_LIGHTEN = 0.24;
const TOP_LEVEL_LIGHTEN = 0.08;
const ROOT_DARKEN = -0.12;
const BORDER_DARKEN = -0.35;

const computeColorAssignments = (
  root: FoxTreeNode,
  paletteId?: string | null,
): Map<string, NodeColorAssignment> => {
  const palette = getPaletteColors(paletteId);
  if (!palette.length) {
    return new Map();
  }

  const assignments = new Map<string, NodeColorAssignment>();
  const setAssignment = (node: FoxTreeNode, baseColor: string, lightAmount: number) => {
    const backgroundColor = shiftColor(baseColor, lightAmount);
    const textColor = getReadableTextColor(backgroundColor);
    const borderColor = shiftColor(backgroundColor, BORDER_DARKEN);
    assignments.set(node.id, {
      backgroundColor,
      textColor,
      borderColor,
      accentColor: baseColor,
    });
  };

  const getLightenAmount = (depth: number): number => {
    if (depth <= 0) {
      return ROOT_DARKEN;
    }

    if (depth === 1) {
      return TOP_LEVEL_LIGHTEN;
    }

    const relativeDepth = depth - 1;
    return Math.min(
      MAX_LIGHTENING,
      FIRST_DESCENDANT_LIGHTEN + Math.max(relativeDepth - 1, 0) * DESCENDANT_LIGHTEN_STEP,
    );
  };

  const assignBranch = (node: FoxTreeNode, depth: number, branchColor: string) => {
    setAssignment(node, branchColor, getLightenAmount(depth));
    node.children?.forEach(child => assignBranch(child, depth + 1, branchColor));
  };

  if (root) {
    const rootBase = palette[0];
    setAssignment(root, rootBase, getLightenAmount(0));
  }

  let paletteIndex = palette.length > 1 ? 1 : 0;
  root.children?.forEach(child => {
    const baseColor = palette[paletteIndex % palette.length];
    paletteIndex += 1;
    assignBranch(child, 1, baseColor);
  });

  return assignments;
};

export const useFoxThreeActions = (
  folders: FolderItem[],
  colorPaletteId?: string | null,
): UseFoxThreeActionsResult => {
  const [flowNodes, setFlowNodes] = useState<Array<Node<FoxNodeData>>>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [expandedState, setExpandedState] = useState<Map<string, boolean>>(new Map());
  const [customPositions, setCustomPositions] = useState<Map<string, XYPosition>>(new Map());
  const [customOrder, setCustomOrder] = useState<Map<string, string[]>>(new Map());
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(null);

  const tree = useMemo(() => buildFoxTree(folders), [folders]);

  useEffect(() => {
    setCustomOrder(prev => {
      const next = new Map(prev);
      let mutated = false;
      const encountered = new Set<string>();

      const traverse = (node: FoxTreeNode) => {
        if (!node.children || node.children.length === 0) {
          return;
        }

        encountered.add(node.id);
        const childIds = node.children.map(child => child.id);
        const existingOrder = next.get(node.id);

        if (existingOrder) {
          const preserved = existingOrder.filter(id => childIds.includes(id));
          const additions = childIds.filter(id => !preserved.includes(id));
          const combined = [...preserved, ...additions];
          const isSame =
            existingOrder.length === combined.length &&
            existingOrder.every((value, index) => value === combined[index]);

          if (!isSame) {
            next.set(node.id, combined);
            mutated = true;
          }
        } else {
          next.set(node.id, childIds);
          mutated = true;
        }

        node.children.forEach(traverse);
      };

      traverse(tree);

      Array.from(next.keys()).forEach(key => {
        if (!encountered.has(key)) {
          next.delete(key);
          mutated = true;
        }
      });

      return mutated ? next : prev;
    });
  }, [tree]);

  const availableServices = useMemo<IntegrationService[]>(() => {
    const services: IntegrationService[] = [];

    tree.children?.forEach(child => {
      if (!child.serviceId) {
        return;
      }

      if ((child.children?.length ?? 0) === 0) {
        return;
      }

      const details = SERVICE_DETAILS[child.serviceId];
      services.push({ id: child.serviceId, ...details });
    });

    return services;
  }, [tree]);

  const handleServiceSelect = useCallback((serviceId: ServiceId | null) => {
    setActiveServiceId(current => {
      if (serviceId === null) {
        return null;
      }

      if (current === serviceId) {
        return null;
      }

      return serviceId;
    });
  }, []);

  useEffect(() => {
    if (activeServiceId && !availableServices.some(service => service.id === activeServiceId)) {
      setActiveServiceId(null);
    }
  }, [activeServiceId, availableServices]);

  const filteredTree = useMemo(() => {
    if (!activeServiceId) {
      return tree;
    }

    return {
      ...tree,
      children: tree.children?.filter(child => child.serviceId === activeServiceId) ?? [],
    };
  }, [tree, activeServiceId]);

  const colorAssignments = useMemo(
    () => computeColorAssignments(filteredTree, colorPaletteId),
    [filteredTree, colorPaletteId],
  );

  const layout = useMemo(
    () => createFlowLayout(filteredTree, expandedState, customOrder),
    [filteredTree, expandedState, customOrder],
  );

  useEffect(() => {
    setFlowEdges(layout.edges);
  }, [layout]);

  useEffect(() => {
    const layoutNodeIds = new Set(layout.nodes.map(node => node.id));
    setCustomPositions(prev => {
      if (prev.size === 0) {
        return prev;
      }

      let mutated = false;
      const next = new Map(prev);

      Array.from(prev.keys()).forEach(key => {
        if (!layoutNodeIds.has(key)) {
          next.delete(key);
          mutated = true;
        }
      });

      return mutated ? next : prev;
    });
  }, [layout]);

  useEffect(() => {
    setFlowNodes(
      layout.nodes.map(node => {
        const custom = customPositions.get(node.id);
        return custom ? { ...node, position: custom } : node;
      }),
    );
  }, [layout, customPositions]);

  useEffect(() => {
    setExpandedState(prevState => {
      const nextState = new Map(prevState);
      const encountered = new Set<string>();

      const traverse = (node: FoxTreeNode, depth: number) => {
        if (node.children && node.children.length > 0) {
          const defaultExpanded = depth < DEFAULT_MAX_DEPTH;
          if (!nextState.has(node.id)) {
            nextState.set(node.id, defaultExpanded);
          }
          encountered.add(node.id);
          node.children.forEach(child => traverse(child, depth + 1));
        }
      };

      traverse(filteredTree, 0);

      Array.from(nextState.keys()).forEach(key => {
        if (!encountered.has(key)) {
          nextState.delete(key);
        }
      });

      return nextState;
    });
  }, [filteredTree]);

  const handleNodeDrag = useCallback((id: string, position?: XYPosition | null) => {
    if (!position) {
      return;
    }

    setFlowNodes(nodes => nodes.map(node => (node.id === id ? { ...node, position } : node)));
  }, []);

  const handleNodeDragStop = useCallback((id: string, position?: XYPosition | null) => {
    if (!position) {
      return;
    }

    const snappedPosition: XYPosition = { x: snapPosition(position.x), y: position.y };
    const positionUpdates = new Map<string, XYPosition>();
    let orderUpdate: { parentId: string; order: string[] } | null = null;

    setFlowNodes(prevNodes => {
      if (prevNodes.length === 0) {
        return prevNodes;
      }

      const nextNodes = prevNodes.map(node => ({ ...node }));
      let mutated = false;

      const updatePosition = (nodeId: string, nextPosition: XYPosition) => {
        const index = nextNodes.findIndex(node => node.id === nodeId);
        if (index === -1) {
          return;
        }

        const current = nextNodes[index].position;
        if (current.x === nextPosition.x && current.y === nextPosition.y) {
          return;
        }

        nextNodes[index] = { ...nextNodes[index], position: nextPosition };
        positionUpdates.set(nodeId, nextPosition);
        mutated = true;
      };

      updatePosition(id, snappedPosition);

      const draggedNode = nextNodes.find(node => node.id === id) as Node<FoxNodeData> | undefined;
      const parentId = draggedNode?.data.parentId;

      if (draggedNode && parentId) {
        const siblings = nextNodes.filter(
          node => (node as Node<FoxNodeData>).data.parentId === parentId,
        );

        if (siblings.length > 1) {
          const parentNode = nextNodes.find(node => node.id === parentId);
          const baseX =
            parentNode !== undefined
              ? parentNode.position.x + HORIZONTAL_GAP
              : draggedNode.position.x;
          const baseY =
            parentNode !== undefined
              ? parentNode.position.y + VERTICAL_GAP
              : Math.min(...siblings.map(sibling => sibling.position.y));

          const sorted = [...siblings].sort((a, b) => a.position.y - b.position.y);
          orderUpdate = { parentId, order: sorted.map(node => node.id) };

          sorted.forEach((sibling, index) => {
            const nextPosition: XYPosition = {
              x: baseX,
              y: baseY + index * VERTICAL_GAP,
            };
            updatePosition(sibling.id, nextPosition);
          });
        }
      }

      return mutated ? nextNodes : prevNodes;
    });

    if (positionUpdates.size > 0) {
      setCustomPositions(prev => {
        const next = new Map(prev);
        let mutated = false;

        positionUpdates.forEach((pos, nodeId) => {
          const existing = next.get(nodeId);
          if (!existing || existing.x !== pos.x || existing.y !== pos.y) {
            next.set(nodeId, pos);
            mutated = true;
          }
        });

        return mutated ? next : prev;
      });
    }

    if (orderUpdate) {
      const { parentId, order } = orderUpdate;
      setCustomOrder(prev => {
        const existing = prev.get(parentId);
        const desired = order;

        if (
          existing &&
          existing.length === desired.length &&
          existing.every((value, index) => value === desired[index])
        ) {
          return prev;
        }

        const next = new Map(prev);
        next.set(parentId, desired);
        return next;
      });
    }
  }, []);

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

  const toggleNodeExpansionById = useCallback(
    (nodeId: string, depth: number, childrenCount: number) => {
      if (childrenCount <= 0) {
        return;
      }

      setExpandedState(prev => {
        const next = new Map(prev);
        const current = next.has(nodeId)
          ? next.get(nodeId)!
          : depth < DEFAULT_MAX_DEPTH;
        next.set(nodeId, !current);
        return next;
      });
    },
    [],
  );

  const getIsNodeExpanded = useCallback(
    (nodeId: string, depth: number, childrenCount: number) => {
      if (childrenCount <= 0) {
        return false;
      }

      const value = expandedState.get(nodeId);
      if (value !== undefined) {
        return value;
      }

      return depth < DEFAULT_MAX_DEPTH;
    },
    [expandedState],
  );

  const nodesWithControls = useMemo(
    () =>
      nodesToRender.map(node => {
        const typedNode = node as Node<FoxNodeData>;
        const { depth, childrenCount } = typedNode.data;
        const isExpanded = getIsNodeExpanded(node.id, depth, childrenCount);
        const colorStyle = colorAssignments.get(node.id);

        return {
          ...typedNode,
          data: {
            ...typedNode.data,
            isExpanded,
            onToggle: () => toggleNodeExpansionById(node.id, depth, childrenCount),
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
    [
      nodesToRender,
      getIsNodeExpanded,
      toggleNodeExpansionById,
      colorAssignments,
    ],
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
