//node utils
import { LOGO_MAP } from './constants';
import { D3HierarchyNode } from './types';

export function getNodeColor(depth: number): string {
  const colors: Record<number, string> = {
    0: '#fde68a',
    1: '#ffffff',
    2: '#94a3b8',
    3: '#cbd5f5',
    4: '#e2e8f0',
    5: '#f8fafc',
  };
  return colors[depth] || '#e0e0e0';
}

export function getNodeId(d: D3HierarchyNode | any): string {
  if (d?.id) return String(d.id);
  if (d?.data?.name) {
    const name = d.data.name;
    const depth = d.depth;
    const parentName = d.parent?.data?.name || '';
    return `${depth}_${parentName}_${name}`.replace(/\s+/g, '_');
  }
  return 'node_' + Math.random().toString(36).slice(2);
}

export function hasLogo(name: string): boolean {
  return Boolean(LOGO_MAP[name]);
}
