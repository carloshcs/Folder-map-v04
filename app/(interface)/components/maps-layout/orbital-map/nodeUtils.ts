//node utils
import { LOGO_MAP } from './constants';
import { D3HierarchyNode } from './types';

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
  if (dataId) return String(dataId);
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
