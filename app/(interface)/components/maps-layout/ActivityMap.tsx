import React, { useMemo } from 'react';

import type { FolderItem } from '../right-sidebar/data';
import { buildHierarchyTree } from './utils';

interface ActivityEntry {
  id: string;
  name: string;
  path: string;
  totalSize: number;
  fileCount: number;
  folderCount: number;
  activityScore: number;
}

interface ActivityMapProps {
  folders: FolderItem[];
}

const formatSize = (bytes: number): string => {
  if (bytes <= 0) {
    return '0 KB';
  }

  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formatted = size >= 10 ? Math.round(size) : Number(size.toFixed(1));
  return `${formatted} ${units[unitIndex]}`;
};

const buildActivityScore = (totalSize: number, fileCount: number, folderCount: number): number => {
  if (totalSize > 0) {
    return totalSize;
  }

  if (fileCount > 0) {
    return fileCount * 1024;
  }

  return Math.max(folderCount, 1);
};

export const ActivityMap: React.FC<ActivityMapProps> = ({ folders }) => {
  const entries = useMemo<ActivityEntry[]>(() => {
    const hierarchy = buildHierarchyTree(folders);

    const nodes: ActivityEntry[] = [];

    const traverse = (node = hierarchy, path: string[] = []) => {
      if (node.id !== 'root') {
        const { totalSize, fileCount, folderCount } = node.metrics;
        nodes.push({
          id: node.id,
          name: node.name,
          path: path.concat(node.name).join(' / '),
          totalSize,
          fileCount,
          folderCount,
          activityScore: buildActivityScore(totalSize, fileCount, folderCount),
        });
      }

      node.children?.forEach(child => {
        const nextPath = node.id === 'root' ? [] : path.concat(node.name);
        traverse(child, nextPath);
      });
    };

    traverse();

    return nodes
      .filter(entry => entry.totalSize > 0 || entry.fileCount > 0 || entry.folderCount > 0)
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 12);
  }, [folders]);

  const maxScore = useMemo(() => entries.reduce((max, entry) => Math.max(max, entry.activityScore), 0), [entries]);

  return (
    <div className="w-full h-full overflow-auto bg-white">
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Activity Overview</h2>
            <p className="text-sm text-gray-600 mt-1">
              Highlights the most active folders based on storage usage and document volume.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
              <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden />
              Storage weight
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
              Document count
            </span>
          </div>
        </header>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map(entry => {
            const storageRatio = maxScore > 0 ? entry.activityScore / maxScore : 0;
            const fileRatio = maxScore > 0 ? (entry.fileCount * 1024) / maxScore : 0;

            return (
              <article
                key={entry.id}
                className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900 truncate" title={entry.name}>
                    {entry.name}
                  </h3>
                  <p className="text-xs text-gray-500 truncate" title={entry.path}>
                    {entry.path}
                  </p>
                </div>

                <div className="px-5 py-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                      <span>Storage usage</span>
                      <span>{formatSize(entry.totalSize)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300"
                        style={{ width: `${Math.max(storageRatio * 100, 4)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 rounded-xl bg-blue-50">
                      <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold">Files</div>
                      <div className="mt-1 text-lg font-semibold text-blue-900">
                        {entry.fileCount.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50">
                      <div className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Folders</div>
                      <div className="mt-1 text-lg font-semibold text-emerald-900">
                        {entry.folderCount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Document volume</span>
                      <span>{entry.fileCount.toLocaleString()} documents</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300"
                        style={{ width: `${Math.max(fileRatio * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {entries.length === 0 && (
            <div className="col-span-full flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
              <div className="text-center">
                <p className="text-base font-medium text-gray-800">No activity metrics available yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Connect a workspace to see live activity insights for your folders.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
