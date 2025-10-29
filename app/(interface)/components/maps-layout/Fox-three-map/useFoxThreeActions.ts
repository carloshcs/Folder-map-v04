import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Edge, type Node, type XYPosition } from 'reactflow';

import { type IntegrationService } from '@/app/(interface)/components/IntegrationFilter';
import { getPaletteColors, getReadableTextColor, shiftColor } from '@/app/(interface)/lib/utils/colors';

import { type FolderItem, type ServiceId } from '../../right-sidebar/data';
import {
  DEFAULT_MAX_DEPTH,
  SNAP_SIZE,
  VERTICAL_GAP,
  type FoxNodeData,
  type FoxTreeNode,
} from './foxThreeConfig';
import { createFlowLayout, snapPosition } from './foxThreeCompile';
import { SERVICE_DETAILS, buildFoxTree } from './foxThreeOrganization';

const collectDescendantIds = (
  lookup: Map<string, FoxTreeNode[]>,
  nodeId: string,
): string[] => {
  const result: string[] = [];
  const queue = [...(lookup.get(nodeId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current.id);
    const children = lookup.get(current.id);
    if (children && children.length > 0) {
      queue.push(...children);
    }
  }

  return result;
};

const snapUpToGrid = (value: number): number => Math.ceil(value / SNAP_SIZE) * SNAP_SIZE;

const enforceGridAndReflow = (
  nodes: Array<Node<FoxNodeData>>,
): Array<Node<FoxNodeData>> => {
  if (nodes.length === 0) {
    return nodes;
  }

  const snappedNodes = nodes.map(node => {
    const snappedX = snapPosition(node.position.x);
    const snappedY = snapPosition(node.position.y);

    if (snappedX === node.position.x && snappedY === node.position.y) {
      return node;
    }

    return {
      ...node,
      position: { x: snappedX, y: snappedY },
    };
  });

  const columns = new Map<number, Array<Node<FoxNodeData>>>();
  snappedNodes.forEach(node => {
    const columnNodes = columns.get(node.position.x);
    if (columnNodes) {
      columnNodes.push(node);
    } else {
      columns.set(node.position.x, [node]);
    }
  });

  const overrides = new Map<string, { x: number; y: number }>();

  columns.forEach(nodesInColumn => {
    const sorted = [...nodesInColumn].sort(
      (a, b) => a.position.y - b.position.y,
    );

    let previousY: number | null = null;

    sorted.forEach(node => {
      let targetY = snapPosition(node.position.y);

      if (previousY !== null) {
        const minimum = previousY + VERTICAL_GAP;
        if (targetY < minimum) {
          targetY = snapUpToGrid(minimum);
        }
      }

      overrides.set(node.id, { x: node.position.x, y: targetY });
      previousY = targetY;
    });
  });

  return snappedNodes.map(node => {
    const override = overrides.get(node.id);
    if (!override) {
      return node;
    }

    if (
      override.x === node.position.x &&
      override.y === node.position.y
    ) {
      return node;
    }

    return {
      ...node,
      position: override,
    };
  });
};

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

const buildParentLookup = (root: FoxTreeNode): Map<string, string | null> => {
  const map = new Map<string, string | null>();

  const traverse = (node: FoxTreeNode, parentId: string | null) => {
    map.set(node.id, parentId);
    node.children?.forEach(child => traverse(child, node.id));
  };

  traverse(root, null);

  return map;
};

const buildChildrenLookup = (root: FoxTreeNode): Map<string, FoxTreeNode[]> => {
  const map = new Map<string, FoxTreeNode[]>();

  const traverse = (node: FoxTreeNode) => {
    if (node.children && node.children.length > 0) {
      map.set(node.id, node.children);
      node.children.forEach(traverse);
    }
  };

  traverse(root);

  return map;
};

const reorderTreeWithCustomOrder = (
  node: FoxTreeNode,
  orderMap: Map<string, string[]>,
): FoxTreeNode => {
  const children = node.children ?? [];

  if (!children.length) {
    return { ...node };
  }

  const order = orderMap.get(node.id);
  const originalIndex = new Map(children.map((child, index) => [child.id, index]));
  const orderIndex = order
    ? new Map(order.map((childId, index) => [childId, index]))
    : new Map<string, number>();

  const sortedChildren = [...children].sort((a, b) => {
    const orderA = orderIndex.get(a.id);
    const orderB = orderIndex.get(b.id);

    if (orderA !== undefined && orderB !== undefined) {
      return orderA - orderB;
    }

    if (orderA !== undefined) {
      return -1;
    }

    if (orderB !== undefined) {
      return 1;
    }

    return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
  });

  return {
    ...node,
    children: sortedChildren.map(child => reorderTreeWithCustomOrder(child, orderMap)),
  };
};

export const useFoxThreeActions = (
  folders: FolderItem[],
  colorPaletteId?: string | null,
): UseFoxThreeActionsResult => {
  const [flowNodes, setFlowNodes] = useState<Array<Node<FoxNodeData>>>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [expandedState, setExpandedState] = useState<Map<string, boolean>>(new Map());
  const [customOrder, setCustomOrder] = useState<Map<string, string[]>>(new Map());
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(null);

  const tree = useMemo(() => buildFoxTree(folders), [folders]);

  const parentLookup = useMemo(() => buildParentLookup(tree), [tree]);
  const childrenLookup = useMemo(() => buildChildrenLookup(tree), [tree]);

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

  useEffect(() => {
    setCustomOrder(prev => {
      if (prev.size === 0) {
        return prev;
      }

      let mutated = false;
      const next = new Map(prev);

      prev.forEach((order, parentId) => {
        const children = childrenLookup.get(parentId);
        if (!children || children.length === 0) {
          if (next.delete(parentId)) {
            mutated = true;
          }
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
        if (
          currentOrder.length !== updatedOrder.length ||
          currentOrder.some((value, index) => value !== updatedOrder[index])
        ) {
          next.set(parentId, updatedOrder);
          mutated = true;
        }
      });

      return mutated ? next : prev;
    });
  }, [childrenLookup]);

  const colorAssignments = useMemo(
    () => computeColorAssignments(filteredTree, colorPaletteId),
    [filteredTree, colorPaletteId],
  );

  const orderedTree = useMemo(
    () => reorderTreeWithCustomOrder(filteredTree, customOrder),
    [filteredTree, customOrder],
  );

  const layout = useMemo(
    () => createFlowLayout(orderedTree, expandedState),
    [orderedTree, expandedState],
  );

  useEffect(() => {
    setFlowEdges(layout.edges);
  }, [layout]);

  useEffect(() => {
    setFlowNodes(
      enforceGridAndReflow(
        layout.nodes.map(node => ({ ...node, position: { ...node.position } })),
      ),
    );
  }, [layout]);

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

  const getDescendantIds = useCallback(
    (nodeId: string) => collectDescendantIds(childrenLookup, nodeId),
    [childrenLookup],
  );

  const handleNodeDrag = useCallback(
    (id: string, position?: XYPosition | null) => {
      if (!position) {
        return;
      }

      setFlowNodes(nodes => {
        const targetIndex = nodes.findIndex(node => node.id === id);
        if (targetIndex === -1) {
          return nodes;
        }

        const targetNode = nodes[targetIndex];
        const targetData = targetNode.data as FoxNodeData;

        let constrainedPosition = { ...position };

        if (targetData.parentId) {
          const parentNode = nodes.find(node => node.id === targetData.parentId);
          if (parentNode) {
            const minimumY = parentNode.position.y + VERTICAL_GAP;
            if (constrainedPosition.y < minimumY) {
              constrainedPosition = { ...constrainedPosition, y: minimumY };
            }
          }
        }

        const deltaX = constrainedPosition.x - targetNode.position.x;
        const deltaY = constrainedPosition.y - targetNode.position.y;

        if (deltaX === 0 && deltaY === 0) {
          return nodes;
        }

        const descendantIds = getDescendantIds(id);
        if (descendantIds.length === 0) {
          return nodes.map(node =>
            node.id === id ? { ...node, position: { ...constrainedPosition } } : node,
          );
        }

        const branchIds = new Set([id, ...descendantIds]);

        return nodes.map(node => {
          if (!branchIds.has(node.id)) {
            return node;
          }

          if (node.id === id) {
            return { ...node, position: { ...constrainedPosition } };
          }

          return {
            ...node,
            position: {
              x: node.position.x + deltaX,
              y: node.position.y + deltaY,
            },
          };
        });
      });
    },
    [getDescendantIds],
  );

  const handleNodeDragStop = useCallback(
    (id: string, _position?: XYPosition | null) => {
      let updatedNodesSnapshot: Array<Node<FoxNodeData>> = [];

      setFlowNodes(nodes => {
        const existingIndex = nodes.findIndex(node => node.id === id);
        if (existingIndex === -1) {
          updatedNodesSnapshot = nodes;
          return nodes;
        }

        const parentNode = nodes[existingIndex];
        const descendantIds = getDescendantIds(id);
        const branchIds = new Set([id, ...descendantIds]);

        let workingNodes = nodes.map(node => ({
          ...node,
          position: { ...node.position },
        }));

        if (descendantIds.length > 0) {
          const snappedParent = {
            x: snapPosition(parentNode.position.x),
            y: snapPosition(parentNode.position.y),
          };
          const deltaSnap = {
            x: snappedParent.x - parentNode.position.x,
            y: snappedParent.y - parentNode.position.y,
          };

          workingNodes = workingNodes.map(node => {
            if (!branchIds.has(node.id)) {
              return node;
            }

            if (node.id === id) {
              return {
                ...node,
                position: snappedParent,
              };
            }

            return {
              ...node,
              position: {
                x: snapPosition(node.position.x + deltaSnap.x),
                y: snapPosition(node.position.y + deltaSnap.y),
              },
            };
          });
        } else {
          workingNodes = workingNodes.map(node =>
            node.id === id
              ? {
                  ...node,
                  position: {
                    x: snapPosition(node.position.x),
                    y: snapPosition(node.position.y),
                  },
                }
              : node,
          );
        }

        const reflowed = enforceGridAndReflow(workingNodes);
        updatedNodesSnapshot = reflowed;
        return reflowed;
      });

      const parentId = parentLookup.get(id);
      if (!parentId) {
        return;
      }

      const siblings = childrenLookup.get(parentId);
      if (!siblings || siblings.length <= 1) {
        return;
      }

      setCustomOrder(prev => {
        const siblingIds = siblings.map(child => child.id);
        if (!siblingIds.includes(id)) {
          return prev;
        }

        const baseOrder = prev.get(parentId) ?? siblingIds;

        const visibleSiblings = updatedNodesSnapshot
          .filter(node => {
            const data = node.data as FoxNodeData;
            return (data.parentId ?? null) === parentId && siblingIds.includes(node.id);
          })
          .map(node => ({ id: node.id, y: node.position.y }));

        if (visibleSiblings.length <= 1) {
          return prev;
        }

        const sortedVisibleIds = visibleSiblings
          .slice()
          .sort((a, b) => a.y - b.y)
          .map(item => item.id);

        const visibleSet = new Set(sortedVisibleIds);
        const sanitizedBase = baseOrder.filter(childId => siblingIds.includes(childId));
        const completeBase =
          sanitizedBase.length === siblingIds.length
            ? sanitizedBase
            : [
                ...sanitizedBase,
                ...siblingIds.filter(childId => !sanitizedBase.includes(childId)),
              ];

        const mergedOrder: string[] = [];
        const remainingVisible = [...sortedVisibleIds];

        completeBase.forEach(childId => {
          if (visibleSet.has(childId)) {
            const nextVisible = remainingVisible.shift();
            if (nextVisible) {
              mergedOrder.push(nextVisible);
            }
          } else {
            mergedOrder.push(childId);
          }
        });

        mergedOrder.push(...remainingVisible);

        const changed =
          mergedOrder.length !== completeBase.length ||
          mergedOrder.some((value, index) => value !== completeBase[index]);

        if (!changed) {
          return prev;
        }

        const next = new Map(prev);
        next.set(parentId, mergedOrder);
        return next;
      });
    },
    [getDescendantIds, parentLookup, childrenLookup],
  );

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
