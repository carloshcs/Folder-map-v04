'use client';

import Image from 'next/image';
import React, { useMemo, useState } from 'react';

import type { FolderItem, ServiceId } from '../../right-sidebar/data';
import { SERVICE_ORDER, isServiceId } from '../../right-sidebar/data';

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
  { name: string; logo: string; accent: string; darkAccent: string; color: string }
> = {
  notion: {
    name: 'Notion',
    logo: '/assets/notion-logo.png',
    accent: 'bg-slate-100',
    darkAccent: 'dark:bg-neutral-800/60',
    color: '#64748b',
  },
  onedrive: {
    name: 'OneDrive',
    logo: '/assets/onedrive-logo.png',
    accent: 'bg-sky-100',
    darkAccent: 'dark:bg-neutral-800/60',
    color: '#0ea5e9',
  },
  dropbox: {
    name: 'Dropbox',
    logo: '/assets/dropbox-logo.png',
    accent: 'bg-blue-100',
    darkAccent: 'dark:bg-neutral-800/60',
    color: '#3b82f6',
  },
  googledrive: {
    name: 'Google Drive',
    logo: '/assets/google-drive-logo.png',
    accent: 'bg-amber-100',
    darkAccent: 'dark:bg-neutral-800/60',
    color: '#f59e0b',
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
  const [activeService, setActiveService] = useState<ServiceId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const serviceStats = useMemo(() => {
    const stats: Record<ServiceId, { totalSize: number; totalFiles: number; maxActivity: number }> = {
      notion: { totalSize: 0, totalFiles: 0, maxActivity: 0 },
      onedrive: { totalSize: 0, totalFiles: 0, maxActivity: 0 },
      dropbox: { totalSize: 0, totalFiles: 0, maxActivity: 0 },
      googledrive: { totalSize: 0, totalFiles: 0, maxActivity: 0 },
    };

    SERVICE_ORDER.forEach(serviceId => {
      const entries = sortedEntriesByService[serviceId];
      stats[serviceId].totalSize = entries.reduce((sum, e) => sum + e.totalSize, 0);
      stats[serviceId].totalFiles = entries.reduce((sum, e) => sum + e.fileCount, 0);
      stats[serviceId].maxActivity = Math.max(...entries.map(e => e.activityScore), 0);
    });

    return stats;
  }, [sortedEntriesByService]);

  const handleToggleDirection = () => {
    setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleServiceClick = (serviceId: ServiceId) => {
    setActiveService(activeService === serviceId ? null : serviceId);
    setSearchQuery('');
  };

  const filteredEntries = useMemo(() => {
    if (!activeService || !searchQuery.trim()) {
      return activeService ? sortedEntriesByService[activeService] : [];
    }

    const query = searchQuery.toLowerCase();
    return sortedEntriesByService[activeService].filter(
      entry =>
        entry.name.toLowerCase().includes(query) ||
        entry.path.toLowerCase().includes(query)
    );
  }, [activeService, sortedEntriesByService, searchQuery]);

  return (
    <div className="w-full h-full overflow-auto bg-white dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-8 py-10 space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Activity Dashboard</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Monitor your workspace activity with real-time insights and metrics
            </p>
          </div>
        </header>

        {/* Service Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICE_ORDER.map(serviceId => {
            const entries = sortedEntriesByService[serviceId];
            if (!entries || entries.length === 0) {
              return null;
            }

            const details = SERVICE_DETAILS[serviceId];
            const stats = serviceStats[serviceId];
            const isActive = activeService === serviceId;

            return (
              <button
                key={serviceId}
                onClick={() => handleServiceClick(serviceId)}
                className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-md transition-all hover:shadow-xl hover:scale-105 border-2 ${
                  isActive ? 'border-gray-900 dark:border-neutral-300' : 'border-gray-200 dark:border-neutral-800'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${details.accent} ${details.darkAccent} shadow-sm`}>
                    <Image
                      src={details.logo}
                      alt={`${details.name} logo`}
                      width={32}
                      height={32}
                    />
                  </div>
                  {isActive && (
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-left">{details.name}</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Folders</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{entries.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Size</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatSize(stats.totalSize)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Files</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{stats.totalFiles.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="h-2 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((stats.maxActivity / Math.max(...SERVICE_ORDER.map(s => serviceStats[s].maxActivity))) * 100, 100)}%`,
                          backgroundColor: details.color,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-5 rounded-full -mr-16 -mt-16" style={{ backgroundColor: details.color }} />
              </button>
            );
          })}
        </div>

        {/* Active Service Details */}
        {activeService && (
          <div className="animate-fadeIn">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg overflow-hidden border-2 border-gray-900 dark:border-neutral-300">
              <div className="bg-gray-50 dark:bg-neutral-950 px-6 py-5 border-b border-gray-200 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${SERVICE_DETAILS[activeService].accent} ${SERVICE_DETAILS[activeService].darkAccent}`}>
                      <Image
                        src={SERVICE_DETAILS[activeService].logo}
                        alt={`${SERVICE_DETAILS[activeService].name} logo`}
                        width={28}
                        height={28}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{SERVICE_DETAILS[activeService].name} Folders</h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {filteredEntries.length} {filteredEntries.length !== sortedEntriesByService[activeService].length && `of ${sortedEntriesByService[activeService].length}`} folders
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label htmlFor="service-sort-key" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Sort by
                    </label>
                    <select
                      id="service-sort-key"
                      value={sortKey}
                      onChange={event => setSortKey(event.target.value as SortKey)}
                      className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition hover:bg-gray-50 dark:hover:bg-neutral-800"
                    >
                      {sortDirection === 'desc' ? '↓ High → Low' : '↑ Low → High'}
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search folders by name or path..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[655px] overflow-y-auto">
                {filteredEntries.length === 0 ? (
                  <div className="flex items-center justify-center h-48">
                    <p className="text-gray-500 dark:text-gray-400">No folders found matching "{searchQuery}"</p>
                  </div>
                ) : (
                  <>
                    {/* Table Header */}
                    <div className="sticky top-0 bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 px-6 py-3 z-10">
                      <div className="flex items-center gap-5">
                        <div className="flex-shrink-0 w-8 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          #
                        </div>
                        <div className="flex-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Folder
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="w-20 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">
                            Size
                          </div>
                          <div className="w-16 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">
                            Files
                          </div>
                          <div className="w-24 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">
                            Created
                          </div>
                          <div className="w-24 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">
                            Modified
                          </div>
                          <div className="w-32 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
                            Activity
                          </div>
                          <div className="w-24">
                            {/* Spacer for button */}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {filteredEntries.map((entry, index) => {
                        const maxActivity = Math.max(...sortedEntriesByService[activeService].map(e => e.activityScore));
                        const activityPercent = (entry.activityScore / maxActivity) * 100;
                        
                        return (
                          <div
                            key={`${activeService}-${entry.id}`}
                            className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <div className="flex items-center gap-5">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center font-semibold text-sm text-gray-600 dark:text-gray-300">
                                {searchQuery ? '•' : index + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{entry.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.path}</p>
                              </div>

                              <div className="flex items-center gap-6">
                                <div className="w-20 text-right">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatSize(entry.totalSize)}</p>
                                </div>
                                <div className="w-16 text-right">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.fileCount.toLocaleString()}</p>
                                </div>
                                <div className="w-24 text-right">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{formatDate(entry.createdDate)}</p>
                                </div>
                                <div className="w-24 text-right">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{formatDate(entry.modifiedDate)}</p>
                                </div>
                                
                                <div className="w-32 flex items-center justify-center gap-2">
                                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                                    <circle
                                      cx="18"
                                      cy="18"
                                      r="14"
                                      fill="none"
                                      stroke="#d1d5db"
                                      className="dark:stroke-neutral-500"
                                      strokeWidth="3"
                                    />
                                    <circle
                                      cx="18"
                                      cy="18"
                                      r="14"
                                      fill="none"
                                      stroke="#8b5cf6"
                                      strokeWidth="3"
                                      strokeDasharray={`${activityPercent} 100`}
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-10">
                                    {Math.round(activityPercent)}%
                                  </p>
                                </div>

                                <div className="w-24">
                                  <button
                                    type="button"
                                    className="w-full px-3 py-1.5 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-xs font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                                  >
                                    Go to link
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {totalEntries === 0 && (
          <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                No activity data available
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Connect an integration to start tracking your workspace activity
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};