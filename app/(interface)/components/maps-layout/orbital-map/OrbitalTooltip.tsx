'use client';

import React from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

import { HoveredNodeInfo } from './types';
import { formatBytes, formatDate, numberFormatter } from '../utils/formatting';

const HOVER_TOOLTIP_WIDTH = 320;

interface OrbitalTooltipProps {
  hoveredNode: HoveredNodeInfo;
  isDetailsExpanded: boolean;
  onToggleDetails: () => void;
  onToggleExpand?: () => void;
  onHide?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  hideButtonDisabled?: boolean;
  hideButtonLabel?: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export const OrbitalTooltip: React.FC<OrbitalTooltipProps> = ({
  hoveredNode,
  isDetailsExpanded,
  onToggleDetails,
  onToggleExpand,
  onHide,
  hideButtonDisabled = false,
  hideButtonLabel = 'Hide',
  onPointerEnter,
  onPointerLeave,
}) => {
  const hasMetrics =
    typeof hoveredNode.metrics?.folderCount === 'number' ||
    typeof hoveredNode.metrics?.fileCount === 'number' ||
    typeof hoveredNode.metrics?.totalSize === 'number' ||
    typeof hoveredNode.activityScore === 'number';
  const hasDates = Boolean(hoveredNode.modifiedDate || hoveredNode.createdDate);
  const hasExtraInfo = hasMetrics || hasDates;
  const showExtraInfo = hasExtraInfo && isDetailsExpanded;
  const canHideFromTooltip = Boolean(onHide);

  return (
    <div
      className="pointer-events-auto fixed left-1/2 top-24 z-50 w-full max-w-[320px] -translate-x-1/2 text-sm"
      style={{
        width: HOVER_TOOLTIP_WIDTH,
      }}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-sm transition-shadow dark:border-neutral-700 dark:bg-neutral-900/90">
        <div className="border-b border-neutral-200 bg-white/70 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {hoveredNode.lineage.length > 1 && (
                <p className="mb-1 truncate text-[11px] text-slate-400 dark:text-neutral-500">
                  {hoveredNode.lineage.join(' › ')}
                </p>
              )}
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg leading-none">
                  📁
                </span>
                <p className="truncate text-base font-semibold text-slate-900 dark:text-neutral-100">
                  {hoveredNode.name}
                </p>
              </div>
              {hoveredNode.serviceName && (
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                  {hoveredNode.serviceName}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hoveredNode.canExpand && (
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleExpand?.();
                  }}
                >
                  {hoveredNode.isExpanded ? 'Collapse' : 'Expand'}
                  {hoveredNode.isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {hoveredNode.link && (
                <a
                  href={hoveredNode.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
                  onClick={event => {
                    event.stopPropagation();
                  }}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {hasExtraInfo && (
          <div className="px-5 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl bg-slate-100/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-neutral-800/60 dark:text-neutral-200 dark:hover:bg-neutral-800"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onToggleDetails();
              }}
            >
              <span>Details</span>
              {isDetailsExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showExtraInfo && (
              <div className="mt-3 space-y-4 rounded-2xl border border-neutral-200/70 bg-white/90 px-4 py-4 text-[12px] shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900/60">
                {hasMetrics && (
                  <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-neutral-200 sm:grid-cols-2">
                    {typeof hoveredNode.metrics?.folderCount === 'number' && (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                        <span className="font-medium text-slate-500 dark:text-neutral-200">Folders</span>
                        <span className="font-semibold text-slate-900 dark:text-neutral-50">
                          {numberFormatter.format(hoveredNode.metrics?.folderCount ?? 0)}
                        </span>
                      </div>
                    )}
                    {typeof hoveredNode.metrics?.fileCount === 'number' && (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                        <span className="font-medium text-slate-500 dark:text-neutral-200">Files</span>
                        <span className="font-semibold text-slate-900 dark:text-neutral-50">
                          {numberFormatter.format(hoveredNode.metrics?.fileCount ?? 0)}
                        </span>
                      </div>
                    )}
                    {typeof hoveredNode.metrics?.totalSize === 'number' && (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                        <span className="font-medium text-slate-500 dark:text-neutral-200">Storage</span>
                        <span className="font-semibold text-slate-900 dark:text-neutral-50">
                          {formatBytes(hoveredNode.metrics?.totalSize ?? undefined)}
                        </span>
                      </div>
                    )}
                    {typeof hoveredNode.activityScore === 'number' && (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                        <span className="font-medium text-slate-500 dark:text-neutral-200">Activity</span>
                        <span className="font-semibold text-slate-900 dark:text-neutral-50">
                          {numberFormatter.format(hoveredNode.activityScore)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {hasDates && (
                  <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-neutral-200 sm:grid-cols-2">
                    {hoveredNode.modifiedDate && (
                      <div className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                          Modified
                        </p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-neutral-100">
                          {formatDate(hoveredNode.modifiedDate)}
                        </p>
                      </div>
                    )}
                    {hoveredNode.createdDate && (
                      <div className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800/60">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                          Created
                        </p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-neutral-100">
                          {formatDate(hoveredNode.createdDate)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {canHideFromTooltip && (
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-100 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-400"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      onHide?.(event);
                    }}
                    disabled={hideButtonDisabled}
                  >
                    {hideButtonLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
