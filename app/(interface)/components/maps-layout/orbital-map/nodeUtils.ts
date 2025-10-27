//node utils
import { LOGO_MAP } from './constants';
import { D3HierarchyNode } from './types';

const sanitizeSegment = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const hashString = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

export const getNodeLineage = (d: D3HierarchyNode | any): string[] => {
  const lineage: string[] = [];
  let current: D3HierarchyNode | null = d ?? null;

  while (current) {
    const name = current.data?.name ?? current.data?.item?.name ?? current.name ?? '';
    if (name) {
      lineage.push(String(name));
    }
    current = current.parent ?? null;
  }

  return lineage.reverse();
};

export function getNodeColor(depth: number): string {
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

export function getNodeId(d: D3HierarchyNode | any): string {
  const dataId = d?.data?.item?.id ?? d?.data?.id;
  const serviceId = d?.data?.item?.serviceId ?? d?.data?.serviceId ?? d?.data?.service;

  if (dataId) {
    if (serviceId) {
      return `${serviceId}__${String(dataId)}`;
    }
    return String(dataId);
  }

  if (d?.id) return String(d.id);

  const path = d?.data?.path ?? d?.data?.item?.path;
  if (typeof path === 'string' && path.trim().length > 0) {
    const normalized = path.trim();
    const sanitized = normalized
      .split(/[\\/]+/)
      .map(segment => sanitizeSegment(segment))
      .filter(Boolean)
      .join('__');
    const hashed = hashString(`${serviceId ?? ''}|${normalized}`);
    if (sanitized) {
      return `path__${sanitized}__${hashed}`;
    }
    return `path__${hashed}`;
  }

  const lineage = getNodeLineage(d);
  if (lineage.length > 0) {
    const sanitizedLineage = lineage.map(segment => sanitizeSegment(segment)).filter(Boolean);
    const hashed = hashString(`${serviceId ?? ''}|${lineage.join('>')}`);
    if (sanitizedLineage.length > 0) {
      const composite = sanitizedLineage.join('__');
      return `${serviceId ? `${serviceId}__` : ''}${composite}__${hashed}`;
    }
    return `lineage__${hashed}`;
  }

  return 'node_' + Math.random().toString(36).slice(2);
}

export function hasLogo(name: string): boolean {
  return Boolean(LOGO_MAP[name]);
}
