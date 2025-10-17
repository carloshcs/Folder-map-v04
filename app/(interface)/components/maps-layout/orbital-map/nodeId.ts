// app/(interface)/components/maps-layout/orbital-map/nodeId.ts

/**
 * Minimal, safe version of getNodeId
 * - Always returns a string
 * - No hashing needed
 * - Works even if data is partial
 */

export type IdLike = string | number;

export interface IdSource {
  id?: IdLike;
  name?: string;
  parentId?: IdLike | null;
}

/**
 * Get a simple deterministic id for any node-like object.
 * Priority:
 * 1. explicit id
 * 2. name
 * 3. auto-generated random fallback
 */
export function getNodeId<T extends IdSource>(node: T): string {
  if (node?.id !== undefined && node?.id !== null) {
    return String(node.id);
  }
  if (node?.name) {
    return node.name.toString().replace(/\s+/g, '_');
  }
  // fallback for anonymous nodes
  return 'node_' + Math.random().toString(36).slice(2);
}

/**
 * Ensure each item in an array has a valid id
 */
export function ensureIds<T extends IdSource>(items: T[]): (T & { id: string })[] {
  return items.map(it => ({
    ...it,
    id: getNodeId(it),
  }));
}
