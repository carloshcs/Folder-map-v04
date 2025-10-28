'use client';

import React, { useEffect, useRef } from 'react';
import ReactFlow, { type Node } from 'reactflow';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Folder as FolderIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  type LucideIcon,
} from 'lucide-react';

import { IntegrationFilter } from '@/app/(interface)/components/IntegrationFilter';

import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, type FoxNodeData, type FoxThreeMapProps } from './foxThreeConfig';
import { useFoxThreeActions } from './useFoxThreeActions';

const determineNodeIcon = (data: FoxNodeData): LucideIcon => {
  if (data.childrenCount > 0) {
    return FolderIcon;
  }

  const normalized = data.label.toLowerCase();

  if (IMAGE_EXTENSIONS.some(extension => normalized.endsWith(extension))) {
    return ImageIcon;
  }

  if (VIDEO_EXTENSIONS.some(extension => normalized.endsWith(extension))) {
    return VideoIcon;
  }

  return FileText;
};

const FoxThreeNode: React.FC<{
  data: FoxNodeData;
  dragging: boolean;
  isMinimalPalette: boolean;
}> = ({ data, dragging, isMinimalPalette }) => {
  const Icon = determineNodeIcon(data);
  const isExpandable = data.childrenCount > 0;

  const handleToggleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    data.onToggle?.();
  };

  const handleOpenLink = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();

    if (!data.link) {
      return;
    }

    if (typeof window !== 'undefined') {
      window.open(data.link, '_blank', 'noopener,noreferrer');
    }
  };

  const expandButtonClasses = data.isExpanded
    ? isMinimalPalette
      ? 'border-black bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      : 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-100'
    : isMinimalPalette
      ? 'border-black text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      : 'border-slate-200 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600';

  const externalButtonClasses = isMinimalPalette
    ? 'border-black text-slate-700 hover:bg-slate-100 hover:text-slate-900'
    : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700';

  return (
    <div
      className={`group flex h-full w-full items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_6px_12px_rgba(111,125,255,0.12)] transition-transform duration-300 ${
        dragging ? 'scale-[1.02] shadow-[0_8px_16px_rgba(111,125,255,0.16)]' : 'group-hover:scale-[1.01]'
      }`}
      style={{
        boxShadow:
          '0 4px 9px rgba(111, 125, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <p className="truncate text-sm font-medium leading-5 text-slate-800">{data.label}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {isExpandable ? (
          <button
            type="button"
            onPointerDown={event => event.stopPropagation()}
            onClick={handleToggleClick}
            className={`nodrag inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${expandButtonClasses}`}
            aria-label={`${data.isExpanded ? 'Collapse' : 'Expand'} ${data.label}`}
          >
            {data.isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        ) : null}
        {data.link ? (
          <button
            type="button"
            onPointerDown={event => event.stopPropagation()}
            onClick={handleOpenLink}
            className={`nodrag inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${externalButtonClasses}`}
            aria-label={`Open ${data.label}`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export const FoxThreeMap: React.FC<FoxThreeMapProps> = ({ folders, colorPaletteId }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    availableServices,
    activeServiceId,
    handleServiceSelect,
    nodesWithControls,
    edgesToRender,
    handleNodeDrag,
    handleNodeDragStop,
  } = useFoxThreeActions(folders);

  const isMinimalPalette = colorPaletteId?.startsWith('minimal') ?? false;

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const reactFlowRoot = container.querySelector('.react-flow');
    if (!reactFlowRoot) {
      return;
    }

    const removeTitleAttributes = () => {
      reactFlowRoot
        .querySelectorAll<HTMLElement>('[title]')
        .forEach(element => element.removeAttribute('title'));
    };

    removeTitleAttributes();

    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'attributes')) {
        removeTitleAttributes();
      }
    });

    observer.observe(reactFlowRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title'],
    });

    return () => observer.disconnect();
  }, [nodesWithControls]);

  return (
    <div ref={containerRef} className="fox-three-map relative h-full w-full">
      <IntegrationFilter
        services={availableServices}
        activeServiceId={activeServiceId}
        onServiceSelect={handleServiceSelect}
        allowClear
      />
      <ReactFlow
        nodes={nodesWithControls}
        edges={edgesToRender}
        nodeTypes={{
          'fox-folder': ({ data, dragging }) => (
            <FoxThreeNode
              data={data as FoxNodeData}
              dragging={dragging}
              isMinimalPalette={isMinimalPalette}
            />
          ),
        }}
        className="bg-transparent"
        style={{ background: 'transparent', overflow: 'visible' }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        selectionOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        onNodeDrag={(_, node) => handleNodeDrag(node.id, node.position)}
        onNodeDragStop={(_, node) => {
          handleNodeDragStop(node.id, node.position);
        }}
        onNodeDoubleClick={(_, node) => {
          const typedNode = node as Node<FoxNodeData>;
          typedNode.data.onToggle?.();
        }}
      />
    </div>
  );
};

export default FoxThreeMap;
