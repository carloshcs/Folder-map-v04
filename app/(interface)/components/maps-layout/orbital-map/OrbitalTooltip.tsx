'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  EyeOff,
  Info,
} from 'lucide-react';

import { HoveredNodeInfo } from './types';
import { formatBytes, formatDate, numberFormatter } from '../utils/formatting';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { cn } from '../../ui/utils';

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
  isVisible: boolean;
}

const getActionButtonClasses = (disabled?: boolean) =>
  cn(
    'inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-slate-600 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300',
    disabled &&
      'pointer-events-none cursor-not-allowed opacity-45 hover:-translate-y-0 hover:border-neutral-200 hover:text-slate-600 hover:shadow-md dark:hover:border-neutral-700',
  );

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
  isVisible,
}) => {
  const hasMetrics =
    typeof hoveredNode.metrics?.folderCount === 'number' ||
    typeof hoveredNode.metrics?.fileCount === 'number' ||
    typeof hoveredNode.metrics?.totalSize === 'number';
  const hasDates = Boolean(hoveredNode.modifiedDate || hoveredNode.createdDate);
  const hasPath =
    (hoveredNode.pathSegments?.length ?? hoveredNode.lineage.length) > 0;
  const hasExtraInfo = Boolean(hasMetrics || hasDates || hasPath);
  const showExtraInfo = hasExtraInfo && isDetailsExpanded;
  const canHideFromTooltip = Boolean(onHide);

  const pathDisplay =
    hoveredNode.pathSegments?.length
      ? hoveredNode.pathSegments.join(' / ')
      : hoveredNode.lineage.join(' / ');

  const tooltipTopOffset = (hoveredNode.screenRadius || 0) + 36;

  return (
    <div
      className={cn(
        'pointer-events-auto fixed z-50 max-w-[320px] -translate-x-1/2 transform transition-all duration-300 ease-out',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'pointer-events-none opacity-0 translate-y-2',
      )}
      style={{
        left: hoveredNode.position.x,
        top: hoveredNode.position.y - tooltipTopOffset,
      }}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <TooltipProvider delayDuration={200}>
        <div className="rounded-2xl border border-neutral-200 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur-md dark:border-neutral-700 dark:bg-neutral-900/90">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={getActionButtonClasses(!hasExtraInfo)}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (hasExtraInfo) onToggleDetails();
                  }}
                  aria-label="Show info"
                  disabled={!hasExtraInfo}
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Details</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                {canHideFromTooltip ? (
                  <button
                    type="button"
                    className={getActionButtonClasses(hideButtonDisabled)}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!hideButtonDisabled) onHide?.(event);
                    }}
                    aria-label={hideButtonLabel}
                    disabled={hideButtonDisabled}
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                ) : (
                  <span
                    className={getActionButtonClasses(true)}
                    aria-disabled
                  >
                    <EyeOff className="h-4 w-4" />
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">{hideButtonLabel}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                {hoveredNode.canExpand ? (
                  <button
                    type="button"
                    className={getActionButtonClasses(false)}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleExpand?.();
                    }}
                    aria-label={hoveredNode.isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {hoveredNode.isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <span className={getActionButtonClasses(true)} aria-disabled>
                    <ChevronDown className="h-4 w-4" />
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {hoveredNode.isExpanded ? 'Collapse' : 'Expand'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                {hoveredNode.link ? (
                  <a
                    href={hoveredNode.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={getActionButtonClasses(false)}
                    onClick={event => {
                      event.stopPropagation();
                    }}
                    aria-label="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className={getActionButtonClasses(true)} aria-disabled>
                    <ExternalLink className="h-4 w-4" />
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">Open link</TooltipContent>
            </Tooltip>
          </div>

          {showExtraInfo && (
            <div className="mt-3 space-y-3 rounded-xl border border-neutral-200/70 bg-white/95 p-4 text-[12px] shadow-inner dark:border-neutral-700/60 dark:bg-neutral-900/80">
              <div>
                {hoveredNode.serviceName && (
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                    {hoveredNode.serviceName}
                  </p>
                )}
                <p className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {hoveredNode.name}
                </p>
              </div>

              <div className="space-y-2 text-xs text-slate-600 dark:text-neutral-200">
                {typeof hoveredNode.metrics?.totalSize === 'number' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Storage</span>
                    <span className="font-semibold text-slate-900 dark:text-neutral-50">
                      {formatBytes(hoveredNode.metrics.totalSize)}
                    </span>
                  </div>
                )}
                {typeof hoveredNode.metrics?.folderCount === 'number' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Folders</span>
                    <span className="font-semibold text-slate-900 dark:text-neutral-50">
                      {numberFormatter.format(hoveredNode.metrics.folderCount)}
                    </span>
                  </div>
                )}
                {typeof hoveredNode.metrics?.fileCount === 'number' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Files</span>
                    <span className="font-semibold text-slate-900 dark:text-neutral-50">
                      {numberFormatter.format(hoveredNode.metrics.fileCount)}
                    </span>
                  </div>
                )}
                {hoveredNode.createdDate && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Created</span>
                    <span className="font-semibold text-slate-900 dark:text-neutral-50">
                      {formatDate(hoveredNode.createdDate)}
                    </span>
                  </div>
                )}
                {hoveredNode.modifiedDate && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Modified</span>
                    <span className="font-semibold text-slate-900 dark:text-neutral-50">
                      {formatDate(hoveredNode.modifiedDate)}
                    </span>
                  </div>
                )}
                {pathDisplay && (
                  <div>
                    <span className="block font-medium">Path</span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-slate-500 dark:text-neutral-400">
                      {pathDisplay}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
};
