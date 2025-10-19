'use client';

import Image from 'next/image';
import React, { useMemo, useState } from 'react';

import type { FolderItem, ServiceId } from '../right-sidebar/data';
import { SERVICE_ORDER, isServiceId } from '../right-sidebar/data';

interface ActivityMapProps {
  folders: FolderItem[];
}

interface ActivityEntry {
  id: string;
  name: string;
  path: string;
  serviceId: ServiceId;
  totalSize: number;
  fileCount: number;
  folderCount: number;
  createdDate: Date | null;
  modifiedDate: Date | null;
  activityScore: number;
}

type SortKey = 'activityScore' | 'totalSize' | 'fileCount' | 'createdDate' | 'modifiedDate';

type SortDirection = 'asc' | 'desc';

const SORT_LABELS: Record<SortKey, string> = {
  activityScore: 'Activity score',
  totalSize: 'Storage size',
  fileCount: 'File count',
  createdDate: 'Created date',
  modifiedDate: 'Modified date',
};

const SERVICE_DETAILS: Record<
  ServiceId,
  { name: string; logo: string; accent: string }
> = {
  notion: {
    name: 'Notion',
    logo: '/assets/notion-logo.png',
    accent: 'bg-slate-100',
  },
  onedrive: {
    name: 'OneDrive',
    logo: '/assets/onedrive-logo.png',
    accent: 'bg-sky-100',
  },
  dropbox: {
    name: 'Dropbox',
    logo: '/assets/dropbox-logo.png',
    accent: 'bg-blue-100',
  },
  googledrive: {
    name: 'Google Drive',
    logo: '/assets/google-drive-logo.png',
    accent: 'bg-amber-100',
  },
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const createEmptyEntryRecord = (): Record<ServiceId, ActivityEntry[]> => ({
  notion: [],
  onedrive: [],
  dropbox: [],
  googledrive: [],
});

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

const formatDate = (value: Date | null): string => {
  if (!value || Number.isNaN(value.getTime())) {
    return '—';
  }

  return dateFormatter.format(value);
};

const buildActivityScore = (
  totalSize: number,
  fileCount: number,
  folderCount: number
): number => {
  if (totalSize > 0) {
    return totalSize;
  }

  if (fileCount > 0) {
    return fileCount * 1024;
  }

  return Math.max(folderCount, 1);
};

const getServiceIdFromFolder = (folder: FolderItem): ServiceId | null => {
  if (folder.serviceId && isServiceId(folder.serviceId)) {
    return folder.serviceId;
  }

  if (isServiceId(folder.id)) {
    return folder.id;
  }

  return null;
};

export const ActivityMap: React.FC<ActivityMapProps> = ({ folders }) => {
  const [sortKey, setSortKey] = useState<SortKey>('activityScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const entriesByService = useMemo<Record<ServiceId, ActivityEntry[]>>(() => {
    const serviceEntries = createEmptyEntryRecord();

    const traverse = (
      items: FolderItem[],
      serviceId: ServiceId,
      ancestors: string[]
    ) => {
      items.forEach(item => {
        const metrics = item.metrics ?? {};
        const totalSize = metrics.totalSize ?? 0;
        const fileCount = metrics.fileCount ?? 0;
        const folderCount = metrics.folderCount ?? 0;
        const createdDate = item.createdDate ? new Date(item.createdDate) : null;
        const modifiedDate = item.modifiedDate ? new Date(item.modifiedDate) : null;
        const activityScore =
          item.activityScore ?? buildActivityScore(totalSize, fileCount, folderCount);

        const path = item.path?.trim()
          ? item.path
          : ancestors.concat(item.name).join(' / ');

        const hasMeaningfulMetrics =
          totalSize > 0 || fileCount > 0 || folderCount > 0 || activityScore > 0;

        if (hasMeaningfulMetrics) {
          serviceEntries[serviceId].push({
            id: item.id,
            name: item.name,
            path,
            serviceId,
            totalSize,
            fileCount,
            folderCount,
            createdDate,
            modifiedDate,
            activityScore,
          });
        }

        if (item.children && item.children.length > 0) {
          traverse(item.children, serviceId, ancestors.concat(item.name));
        }
      });
    };

    folders.forEach(root => {
      const serviceId = getServiceIdFromFolder(root);
      if (!serviceId) {
        return;
      }

      const basePath = [SERVICE_DETAILS[serviceId].name];
      if (root.children && root.children.length > 0) {
        traverse(root.children, serviceId, basePath);
      }
    });

    return serviceEntries;
  }, [folders]);

  const sortedEntriesByService = useMemo<Record<ServiceId, ActivityEntry[]>>(() => {
    const sorted = createEmptyEntryRecord();
    const fallbackValue =
      sortDirection === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    const getSortValue = (entry: ActivityEntry): number => {
      switch (sortKey) {
        case 'totalSize':
          return entry.totalSize;
        case 'fileCount':
          return entry.fileCount;
        case 'createdDate':
          return entry.createdDate ? entry.createdDate.getTime() : fallbackValue;
        case 'modifiedDate':
          return entry.modifiedDate ? entry.modifiedDate.getTime() : fallbackValue;
        case 'activityScore':
        default:
          return entry.activityScore;
      }
    };

    SERVICE_ORDER.forEach(serviceId => {
      const entries = [...entriesByService[serviceId]];

      entries.sort((a, b) => {
        const valueA = getSortValue(a);
        const valueB = getSortValue(b);

        if (valueA === valueB) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }

        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      });

      sorted[serviceId] = entries;
    });

    return sorted;
  }, [entriesByService, sortDirection, sortKey]);

  const totalEntries = useMemo(
    () =>
      SERVICE_ORDER.reduce(
        (count, serviceId) => count + sortedEntriesByService[serviceId].length,
        0
      ),
    [sortedEntriesByService]
  );

  const handleToggleDirection = () => {
    setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="w-full h-full overflow-auto bg-white">
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Activity Overview</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review folder activity across each integration, including size, file volume,
              and freshness indicators.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <label
                htmlFor="activity-sort-key"
                className="text-sm font-medium text-gray-700"
              >
                Sort by
              </label>
              <select
                id="activity-sort-key"
                value={sortKey}
                onChange={event => setSortKey(event.target.value as SortKey)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleToggleDirection}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-400 hover:text-gray-900"
              >
                {sortDirection === 'desc' ? 'High → Low' : 'Low → High'}
              </button>
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {totalEntries.toLocaleString()} folders
            </span>
          </div>
        </header>

        {SERVICE_ORDER.map(serviceId => {
          const entries = sortedEntriesByService[serviceId];
          if (!entries || entries.length === 0) {
            return null;
          }

          const details = SERVICE_DETAILS[serviceId];

          return (
            <section key={serviceId} className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${details.accent}`}
                  >
                    <Image
                      src={details.logo}
                      alt={`${details.name} logo`}
                      width={28}
                      height={28}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{details.name}</h3>
                    <p className="text-sm text-gray-500">
                      {entries.length.toLocaleString()} tracked folders
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                    Size
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                    Files
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-purple-500" aria-hidden />
                    Activity
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="hidden grid-cols-[minmax(0,1.8fr)_repeat(5,minmax(0,1fr))] items-center gap-4 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
                  <span>Folder</span>
                  <span>Size</span>
                  <span>Files</span>
                  <span>Created</span>
                  <span>Modified</span>
                  <span>Activity</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {entries.map(entry => (
                    <li key={`${serviceId}-${entry.id}`} className="px-4 py-4 md:px-6">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1.8fr)_repeat(5,minmax(0,1fr))] md:items-center">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
                          <p className="mt-1 break-all text-xs text-gray-500">{entry.path}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-gray-500 md:hidden">Size</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatSize(entry.totalSize)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-gray-500 md:hidden">Files</p>
                          <p className="text-sm font-medium text-gray-900">
                            {entry.fileCount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-gray-500 md:hidden">Created</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(entry.createdDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-gray-500 md:hidden">Modified</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(entry.modifiedDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-gray-500 md:hidden">
                            Activity
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {entry.activityScore.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}

        {totalEntries === 0 && (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
            <div className="text-center">
              <p className="text-base font-medium text-gray-800">
                No activity metrics available yet
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Connect an integration to see folders and their activity insights.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
