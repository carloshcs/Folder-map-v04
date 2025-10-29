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
import { getReadableTextColor, shiftColor } from '@/app/(interface)/lib/utils/colors';

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

const toRGBA = (color: string, alpha: number): string => {
  if (!color) {
    return `rgba(15, 23, 42, ${alpha})`;
  }

  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(char => `${char}${char}`).join('');
    }

    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return color;
};

const FoxThreeNode: React.FC<{ data: FoxNodeData; dragging: boolean }> = ({ data, dragging }) => {
  const Icon = determineNodeIcon(data);
  const isExpandable = data.childrenCount > 0;

  const backgroundColor = data.backgroundColor ?? 'rgba(255, 255, 255, 0.95)';
  const textColor = data.textColor ?? '#1e293b';
  const borderColor = data.borderColor ?? 'rgba(148, 163, 184, 0.35)';
  const accentColor = data.accentColor ?? '#6366f1';
  const normalizedAccent = accentColor.trim().toLowerCase();
  const isMinimalAccent = (() => {
    if (normalizedAccent === '#ffffff' || normalizedAccent === '#fff') {
      return true;
    }

    const rgbMatch = normalizedAccent.match(/rgba?\(([^)]+)\)/);
    if (rgbMatch) {
      const channels = rgbMatch[1]
        .split(',')
        .map(value => Number(value.trim()))
        .slice(0, 3);
      return channels.length === 3 && channels.every(channel => channel === 255);
    }

    return false;
  })();

  const iconBackgroundColor = shiftColor(accentColor, 0.7);
  const iconColor = getReadableTextColor(iconBackgroundColor);
  const buttonSurface = isMinimalAccent ? '#ffffff' : shiftColor(accentColor, 0.82);
  const buttonBorder = isMinimalAccent ? '#0f172a' : shiftColor(accentColor, 0.55);
  const buttonTextColor = isMinimalAccent ? '#0f172a' : accentColor;
  const expandedButtonSurface = isMinimalAccent ? '#f8fafc' : shiftColor(accentColor, 0.55);
  const expandedButtonBorder = isMinimalAccent ? '#0f172a' : shiftColor(accentColor, 0.3);
  const expandedButtonText = getReadableTextColor(expandedButtonSurface);
  const cardShadowColor = dragging
    ? toRGBA(shiftColor(accentColor, 0.3), 0.26)
    : toRGBA(shiftColor(accentColor, 0.45), 0.2);
  const iconShadowColor = toRGBA(accentColor, 0.2);

  const toggleButtonStyle: React.CSSProperties = data.isExpanded
    ? {
        backgroundColor: expandedButtonSurface,
        borderColor: expandedButtonBorder,
        color: expandedButtonText,
      }
    : {
        backgroundColor: buttonSurface,
        borderColor: buttonBorder,
        color: buttonTextColor,
      };

  const linkButtonStyle: React.CSSProperties = {
    backgroundColor: buttonSurface,
    borderColor: buttonBorder,
    color: buttonTextColor,
  };

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

  return (
    <div
      className={`group flex h-full w-full items-center justify-between rounded-2xl border px-3 py-2 transition-transform duration-300 ${
        dragging ? 'scale-[1.02]' : 'group-hover:scale-[1.01]'
      }`}
      style={{
        backgroundColor,
        color: textColor,
        borderColor,
        boxShadow: `${dragging ? '0 9px 18px' : '0 6px 12px'} ${cardShadowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.35)`,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg shadow-sm"
          style={{
            backgroundColor: iconBackgroundColor,
            color: iconColor,
            boxShadow: `0 2px 6px ${iconShadowColor}`,
          }}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <p className="truncate text-sm font-medium leading-5" style={{ color: textColor }}>
          {data.label}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {isExpandable ? (
          <button
            type="button"
            onPointerDown={event => event.stopPropagation()}
            onClick={handleToggleClick}
            className="nodrag inline-flex h-7 w-7 items-center justify-center rounded-full border transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            style={toggleButtonStyle}
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
            className="nodrag inline-flex h-7 w-7 items-center justify-center rounded-full border transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            style={linkButtonStyle}
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
  } = useFoxThreeActions(folders, colorPaletteId);

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
            <FoxThreeNode data={data as FoxNodeData} dragging={dragging} />
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
          handleNodeDragStop(node.id);
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
