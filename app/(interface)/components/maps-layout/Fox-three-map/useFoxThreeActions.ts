import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Edge, type Node, type XYPosition } from 'reactflow';

import { type IntegrationService } from '@/app/(interface)/components/IntegrationFilter';

import { type FolderItem, type ServiceId } from '../../right-sidebar/data';
import {
  DEFAULT_MAX_DEPTH,
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

export const useFoxThreeActions = (folders: FolderItem[]): UseFoxThreeActionsResult => {
  const [flowNodes, setFlowNodes] = useState<Array<Node<FoxNodeData>>>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [expandedState, setExpandedState] = useState<Map<string, boolean>>(new Map());
  const [customPositions, setCustomPositions] = useState<Map<string, XYPosition>>(new Map());
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(null);

  const tree = useMemo(() => buildFoxTree(folders), [folders]);

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

  const layout = useMemo(() => createFlowLayout(filteredTree, expandedState), [filteredTree, expandedState]);

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

    const snapped = { x: snapPosition(position.x), y: snapPosition(position.y) };
    setFlowNodes(nodes => nodes.map(node => (node.id === id ? { ...node, position: snapped } : node)));
    setCustomPositions(prev => {
      const next = new Map(prev);
      next.set(id, snapped);
      return next;
    });
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

        return {
          ...typedNode,
          data: {
            ...typedNode.data,
            isExpanded,
            onToggle: () => toggleNodeExpansionById(node.id, depth, childrenCount),
          },
        };
      }),
    [nodesToRender, getIsNodeExpanded, toggleNodeExpansionById],
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
