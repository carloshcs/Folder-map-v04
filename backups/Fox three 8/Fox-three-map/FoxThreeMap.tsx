'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import ReactFlow, { type Node, type ReactFlowInstance } from 'reactflow';
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

import {
  IMAGE_EXTENSIONS,
  NODE_HEIGHT,
  NODE_WIDTH,
  SNAP_SIZE,
  VIDEO_EXTENSIONS,
  type FoxNodeData,
  type FoxThreeMapProps,
  HORIZONTAL_GAP,
  VERTICAL_GAP,
} from './config';
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
  const ICON_SCALE = 1.2;
  const baseContainerSize = 28; // Tailwind h-7/w-7
  const baseIconSize = 16; // Tailwind h-4/w-4
  const iconContainerSize = baseContainerSize * ICON_SCALE;
  const iconSize = baseIconSize * ICON_SCALE;

  const renderIcon = () => {
    if (data.logoSrc) {
      const logoAlt = `${data.serviceName ?? data.label} logo`;
      return (
        <img
          src={data.logoSrc}
          alt={logoAlt}
          className="object-contain"
          style={{ width: iconSize, height: iconSize }}
          draggable={false}
        />
      );
    }

    const IconComponent = determineNodeIcon(data);
    return <IconComponent aria-hidden style={{ width: iconSize, height: iconSize }} />;
  };

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
          className="flex flex-shrink-0 items-center justify-center rounded-lg shadow-sm"
          style={{
            width: iconContainerSize,
            height: iconContainerSize,
            backgroundColor: iconBackgroundColor,
            color: iconColor,
            boxShadow: `0 2px 6px ${iconShadowColor}`,
          }}
        >
          {renderIcon()}
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
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const hasCenteredRef = useRef(false);
  const {
    availableServices,
    activeServiceId,
    handleServiceSelect,
    nodesWithControls,
    edgesToRender,
    handleNodeDrag,
    handleNodeDragStop,
  } = useFoxThreeActions(folders, colorPaletteId);

  const handleFlowInit = React.useCallback((instance: ReactFlowInstance) => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 0;
    const h = container.clientHeight || 0;
    // Center world origin (0,0) so that the root node (NODE_WIDTH x NODE_HEIGHT)
    // appears centered on screen.
    instance.setViewport({ x: w / 2 - NODE_WIDTH / 2, y: h / 2 - NODE_HEIGHT / 2, zoom: 1 });
    flowInstanceRef.current = instance;
  }, []);

  // Ensure root node appears centered after nodes mount
  useEffect(() => {
    if (hasCenteredRef.current) return;
    const root = nodesWithControls.find(n => n.id === 'fox-root');
    if (!root) return;
    const cx = (root.position?.x ?? 0) + (root.width ?? NODE_WIDTH) / 2;
    const cy = (root.position?.y ?? 0) + (root.height ?? NODE_HEIGHT) / 2;
    try {
      flowInstanceRef.current?.setCenter?.(cx, cy, { zoom: 1, duration: 200 });
      hasCenteredRef.current = true;
    } catch {}
  }, [nodesWithControls]);

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

  const rootNode = useMemo(
    () => nodesWithControls.find(node => node.id === 'fox-root'),
    [nodesWithControls],
  );

  const rootOrigin = useMemo(() => {
    const width = rootNode?.width ?? NODE_WIDTH;
    const height = rootNode?.height ?? NODE_HEIGHT;
    const { x, y } = rootNode?.position ?? { x: 0, y: 0 };

    return {
      x: x + width / 2,
      y: y + height / 2,
    };
  }, [rootNode]);

  const quadrantStyles = useMemo(() => {
    const CANVAS_EXTENT = SNAP_SIZE * 600;

    const createGridStyle = (offsetX: number, offsetY: number): React.CSSProperties => ({
      backgroundImage:
        'radial-gradient(circle, rgba(148, 163, 184, 0.85) 0, rgba(148, 163, 184, 0.85) 1.5px, transparent 1.5px)',
      backgroundSize: `${SNAP_SIZE}px ${SNAP_SIZE}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
      backgroundColor: 'rgba(15, 23, 42, 0.03)',
    });

    return {
      topLeft: {
        top: rootOrigin.y - CANVAS_EXTENT,
        left: rootOrigin.x - CANVAS_EXTENT,
        width: CANVAS_EXTENT,
        height: CANVAS_EXTENT,
        ...createGridStyle(CANVAS_EXTENT, CANVAS_EXTENT),
      } satisfies React.CSSProperties,
      topRight: {
        top: rootOrigin.y - CANVAS_EXTENT,
        left: rootOrigin.x,
        width: CANVAS_EXTENT,
        height: CANVAS_EXTENT,
        ...createGridStyle(0, CANVAS_EXTENT),
      } satisfies React.CSSProperties,
      bottomLeft: {
        top: rootOrigin.y,
        left: rootOrigin.x - CANVAS_EXTENT,
        width: CANVAS_EXTENT,
        height: CANVAS_EXTENT,
        ...createGridStyle(CANVAS_EXTENT, 0),
      } satisfies React.CSSProperties,
      bottomRight: {
        top: rootOrigin.y,
        left: rootOrigin.x,
        width: CANVAS_EXTENT,
        height: CANVAS_EXTENT,
        ...createGridStyle(0, 0),
      } satisfies React.CSSProperties,
    };
  }, [rootOrigin.x, rootOrigin.y]);

  const axisThickness = 2;
  const axisColor = 'rgba(148, 163, 184, 0.45)';
  const axisGlow = 'rgba(148, 163, 184, 0.3)';
  const centerMarkerSize = Math.max(10, SNAP_SIZE / 2);

  // TEMP: Non-rest zone boundary positions; edit here if needed later
  const nonRestConfig = useMemo(() => {
    return {
      xMin: rootOrigin.x - HORIZONTAL_GAP,
      xMax: rootOrigin.x + HORIZONTAL_GAP,
      yMin: rootOrigin.y - VERTICAL_GAP,
      yMax: rootOrigin.y + VERTICAL_GAP,
    };
  }, [rootOrigin.x, rootOrigin.y]);
  const nonRestLineColor = 'rgba(239, 68, 68, 0.7)';
  const nonRestLineThickness = 2;
  // Large extent to simulate "infinite" lines
  const NON_REST_EXTENT = SNAP_SIZE * 600;

  return (
    <div ref={containerRef} className="fox-three-map relative h-full w-full">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute" style={quadrantStyles.topLeft} />
        <div className="absolute" style={quadrantStyles.topRight} />
        <div className="absolute" style={quadrantStyles.bottomLeft} />
        <div className="absolute" style={quadrantStyles.bottomRight} />
        {/* TEMP: Non-rest zone boundary lines (horizontal at yMin/yMax, vertical at xMin/xMax) */}
        <div
          className="absolute"
          style={{
            top: nonRestConfig.yMin - nonRestLineThickness / 2,
            left: rootOrigin.x - NON_REST_EXTENT,
            width: NON_REST_EXTENT * 2,
            height: nonRestLineThickness,
            borderTop: `${nonRestLineThickness}px dashed ${nonRestLineColor}`,
          }}
        />
        <div
          className="absolute"
          style={{
            top: nonRestConfig.yMax - nonRestLineThickness / 2,
            left: rootOrigin.x - NON_REST_EXTENT,
            width: NON_REST_EXTENT * 2,
            height: nonRestLineThickness,
            borderTop: `${nonRestLineThickness}px dashed ${nonRestLineColor}`,
          }}
        />
        <div
          className="absolute"
          style={{
            left: nonRestConfig.xMin - nonRestLineThickness / 2,
            top: rootOrigin.y - NON_REST_EXTENT,
            height: NON_REST_EXTENT * 2,
            width: nonRestLineThickness,
            borderLeft: `${nonRestLineThickness}px dashed ${nonRestLineColor}`,
          }}
        />
        <div
          className="absolute"
          style={{
            left: nonRestConfig.xMax - nonRestLineThickness / 2,
            top: rootOrigin.y - NON_REST_EXTENT,
            height: NON_REST_EXTENT * 2,
            width: nonRestLineThickness,
            borderLeft: `${nonRestLineThickness}px dashed ${nonRestLineColor}`,
          }}
        />
        <div
          className="absolute inset-y-0"
          style={{
            left: rootOrigin.x - axisThickness / 2,
            width: axisThickness,
            backgroundColor: axisColor,
            boxShadow: `0 0 12px ${axisGlow}`,
          }}
        />
        <div
          className="absolute inset-x-0"
          style={{
            top: rootOrigin.y - axisThickness / 2,
            height: axisThickness,
            backgroundColor: axisColor,
            boxShadow: `0 0 12px ${axisGlow}`,
          }}
        />
        <div
          className="absolute rounded-full border border-slate-400/60 bg-white/60 shadow-[0_0_10px_rgba(148,163,184,0.45)]"
          style={{
            width: centerMarkerSize,
            height: centerMarkerSize,
            left: rootOrigin.x - centerMarkerSize / 2,
            top: rootOrigin.y - centerMarkerSize / 2,
          }}
        />
      </div>
      <IntegrationFilter
        services={availableServices}
        activeServiceId={activeServiceId}
        onServiceSelect={handleServiceSelect}
        allowClear
      />
      <ReactFlow
        nodes={nodesWithControls}
        edges={edgesToRender}
        onInit={handleFlowInit}
        nodeTypes={{
          'fox-folder': ({ data, dragging }) => (
            <FoxThreeNode data={data as FoxNodeData} dragging={dragging} />
          ),
        }}
        className="relative z-[1] bg-transparent"
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
