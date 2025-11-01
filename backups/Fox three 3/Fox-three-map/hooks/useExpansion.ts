import { useCallback, useEffect, useState } from 'react';
import { type FoxTreeNode, DEFAULT_MAX_DEPTH } from '../config';

export const useExpansionState = (filteredTree: FoxTreeNode) => {
  const [expandedState, setExpandedState] = useState<Map<string, boolean>>(new Map());

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

  const toggleNodeExpansionById = useCallback(
    (nodeId: string, depth: number, childrenCount: number) => {
      if (childrenCount <= 0) return;
      setExpandedState(prev => {
        const next = new Map(prev);
        const current = next.has(nodeId) ? next.get(nodeId)! : depth < DEFAULT_MAX_DEPTH;
        next.set(nodeId, !current);
        return next;
      });
    },
  []);

  const getIsNodeExpanded = useCallback(
    (nodeId: string, depth: number, childrenCount: number) => {
      if (childrenCount <= 0) return false;
      const value = expandedState.get(nodeId);
      if (value !== undefined) return value;
      return depth < DEFAULT_MAX_DEPTH;
    },
    [expandedState],
  );

  return { expandedState, toggleNodeExpansionById, getIsNodeExpanded } as const;
};

