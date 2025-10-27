"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "./components/Sidebar";
import { RightSidebar, FolderSelectionActions } from "./components/RightSidebar";
import { TopNavigation } from "./components/TopNavigation";
import { TextBox } from "./components/TextBox";
import { TextToolbar } from "./components/TextToolbar";
import { TextFormat } from "./components/TextFormatDialog";
import { CommentBox, Comment } from "./components/CommentBox";
import { GridOverlay } from "./components/GridOverlay";
import { BoxType } from "@/lib/mapTypes";
import { FolderItem } from "./components/right-sidebar/data";

interface TextElement {
  id: string;
  x: number;
  y: number;
  text: string;
  format: TextFormat;
  type: 'text';
}

interface CommentElement {
  id: string;
  x: number;
  y: number;
  comments: Comment[];
  isExpanded: boolean;
}

const SIDEBAR_OFFSET = 64;
const ZOOM_MIN = 25;
const ZOOM_MAX = 300;
const ZOOM_BUTTON_STEP = 25;
const ZOOM_WHEEL_STEP = 10;

const MapLayoutFallback = () => (
  <div className="flex h-full items-center justify-center text-muted-foreground">
    Loading layout...
  </div>
);

const ActivityMap = dynamic(
  () =>
    import("./components/maps-layout/Activity-Map/ActivityMap").then(
      mod => mod.ActivityMap,
    ),
  {
    loading: MapLayoutFallback,
    ssr: false,
  },
);

const BubbleSizeMap = dynamic(
  () =>
    import("./components/maps-layout/BubbleSize-map/BubbleSizeMap").then(
      mod => mod.BubbleSizeMap,
    ),
  {
    loading: MapLayoutFallback,
    ssr: false,
  },
);

const FoxThreeMap = dynamic(
  () =>
    import("./components/maps-layout/Fox-three-map/FoxThreeMap").then(
      mod => mod.FoxThreeMap,
    ),
  {
    loading: MapLayoutFallback,
    ssr: false,
  },
);

const OrbitalMap = dynamic(
  () =>
    import("./components/maps-layout/orbital-map/OrbitalMap").then(
      mod => mod.OrbitalMap,
    ),
  {
    loading: MapLayoutFallback,
    ssr: false,
  },
);

const RadialTreeMap = dynamic(
  () =>
    import("./components/maps-layout/Radial-three-map/RadialTreeMap").then(
      mod => mod.RadialTreeMap,
    ),
  {
    loading: MapLayoutFallback,
    ssr: false,
  },
);

const SunBurstMap = dynamic(
  () =>
    import("./components/maps-layout/SunBurst-map/SunBurstMap").then(
      mod => mod.SunBurstMap,
    ),
  {
    loading: MapLayoutFallback,
    ssr: false,
  },
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [mapPosition, setMapPosition] = useState({
    x: 0,
    y: 0,
  });
  const [showGrid, setShowGrid] = useState(true);
  const [gridThickness, setGridThickness] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastDragPosition, setLastDragPosition] = useState({
    x: 0,
    y: 0,
  });
  const [folderData, setFolderData] = useState<FolderItem[]>([]);
  const [isTextMode, setIsTextMode] = useState(false);
  const [isBoxMode, setIsBoxMode] = useState(false);
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [selectedBoxType, setSelectedBoxType] = useState<BoxType>('box');
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [commentElements, setCommentElements] = useState<CommentElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [isTextDragging, setIsTextDragging] = useState(false);
  const [isCommentDragging, setIsCommentDragging] = useState(false);
  const [currentMap, setCurrentMap] = useState('My Project Map');
  const [existingMaps, setExistingMaps] = useState(['My Project Map', 'Team Workspace', 'Design System', 'Marketing Campaign']);
  const [selectedLayout, setSelectedLayout] = useState<string | null>('orbital');
  const [selectedPaletteId, setSelectedPaletteId] = useState<string>("blue");
  const mapRef = useRef<HTMLDivElement>(null);
  const folderSelectionHandlerRef = useRef<FolderSelectionActions['setFolderSelection'] | null>(null);
  const isCanvasLayout = selectedLayout !== "activity-map";

  // Check for saved theme preference or default to light mode
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDark(previous => {
      const newIsDark = !previous;

      if (newIsDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }

      return newIsDark;
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => clamp(prev + ZOOM_BUTTON_STEP, ZOOM_MIN, ZOOM_MAX));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => clamp(prev - ZOOM_BUTTON_STEP, ZOOM_MIN, ZOOM_MAX));
  }, []);

  const handleCenterMap = useCallback(() => {
    setMapPosition({ x: 0, y: 0 });
    setZoom(100);
  }, []);

  const toggleGrid = useCallback(() => {
    setShowGrid(previous => !previous);
  }, []);

  const handleGridThicknessChange = useCallback((thickness: number) => {
    setGridThickness(thickness);
  }, []);

  const handleFolderDataChange = useCallback((folders: FolderItem[]) => {
    setFolderData(folders);
  }, []);

  const handleFolderSelectionChange = useCallback(
    (folderId: string, isSelected: boolean) => {
      folderSelectionHandlerRef.current?.(folderId, isSelected);
    },
    [],
  );

  const handleFolderActionsChange = useCallback((actions: FolderSelectionActions) => {
    folderSelectionHandlerRef.current = actions.setFolderSelection;
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedTextId(null);
    setSelectedCommentId(null);
  }, []);

  const resetModes = useCallback(() => {
    setIsTextMode(false);
    setIsBoxMode(false);
    setIsCommentMode(false);
    clearSelections();
  }, [clearSelections]);

  const handleLayoutSelect = useCallback((layoutId: string) => {
    setSelectedLayout(previous => (previous === layoutId ? null : layoutId));
    resetModes();
  }, [resetModes]);

  // Default text format
  const defaultTextFormat: TextFormat = useMemo(() => ({
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 16,
    textColor: isDark ? '#ffffff' : '#000000',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderThickness: 1,
    borderColor: isDark ? '#444444' : '#cccccc',
    boxType: 'box',
    width: 150,
    height: 60,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    textAlign: 'center',
    link: undefined,
  }), [isDark]);

  const handleTextModeToggle = useCallback(() => {
    setIsTextMode(previous => !previous);
    setIsBoxMode(false);
    setIsCommentMode(false);
    clearSelections();
  }, [clearSelections]);

  const handleCreateBox = useCallback((boxType: BoxType) => {
    setSelectedBoxType(boxType);
    setIsBoxMode(true);
    setIsTextMode(false);
    setIsCommentMode(false);
    clearSelections();
  }, [clearSelections]);

  const handleCommentModeToggle = useCallback(() => {
    setIsCommentMode(previous => !previous);
    setIsTextMode(false);
    setIsBoxMode(false);
    clearSelections();
  }, [clearSelections]);

  const toMapCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!mapRef.current) return null;

    const rect = mapRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - SIDEBAR_OFFSET - mapPosition.x) / (zoom / 100);
    const y = (clientY - rect.top - mapPosition.y) / (zoom / 100);

    return { x, y };
  }, [mapPosition, zoom]);

  const createTextElement = useCallback((clientX: number, clientY: number) => {
    const coordinates = toMapCoordinates(clientX, clientY);
    if (!coordinates) return;

    const newText: TextElement = {
      id: `text-${Date.now()}`,
      x: coordinates.x,
      y: coordinates.y,
      text: currentMap, // Default to current map name
      format: defaultTextFormat,
      type: 'text',
    };

    setTextElements(prev => [...prev, newText]);
    setSelectedTextId(newText.id);
    setIsTextMode(false);
  }, [currentMap, defaultTextFormat, toMapCoordinates]);

  const createCommentElement = useCallback((clientX: number, clientY: number) => {
    const coordinates = toMapCoordinates(clientX, clientY);
    if (!coordinates) return;

    const newComment: CommentElement = {
      id: `comment-${Date.now()}`,
      x: coordinates.x,
      y: coordinates.y,
      comments: [],
      isExpanded: true, // Start expanded so user can add first comment
    };

    setCommentElements(prev => [...prev, newComment]);
    setSelectedCommentId(newComment.id);
    setIsCommentMode(false);
  }, [toMapCoordinates]);

  const createBoxElement = useCallback((clientX: number, clientY: number) => {
    const coordinates = toMapCoordinates(clientX, clientY);
    if (!coordinates) return;

    const baseBoxFormat: TextFormat = {
      ...defaultTextFormat,
      boxType: selectedBoxType,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderThickness: 2,
      borderColor: '#000000',
    };

    const presets: Record<BoxType, Partial<TextFormat>> = {
      box: { width: 150, height: 100 },
      parallelogram: { width: 200, height: 150 },
      postit: { backgroundColor: '#fef08a', width: 180, height: 120 },
      dialogue: { width: 200, height: 100 },
      circle: { width: 120, height: 120 },
      rounded: { width: 160, height: 100 },
    };

    const boxFormat = {
      ...baseBoxFormat,
      ...(presets[selectedBoxType] ?? presets.box),
    };

    const newBox: TextElement = {
      id: `box-${Date.now()}`,
      x: coordinates.x,
      y: coordinates.y,
      text: currentMap, // Default to current map name
      format: boxFormat,
      type: 'text',
    };

    setTextElements(prev => [...prev, newBox]);
    setSelectedTextId(newBox.id);
    setIsBoxMode(false);
  }, [currentMap, defaultTextFormat, selectedBoxType, toMapCoordinates]);

  const handleTextChange = useCallback((id: string, text: string) => {
    setTextElements(prev =>
      prev.map(el => el.id === id ? { ...el, text } : el)
    );
  }, []);

  const handleTextPositionChange = useCallback((id: string, x: number, y: number) => {
    setTextElements(prev =>
      prev.map(el => el.id === id ? { ...el, x, y } : el)
    );
  }, []);

  const handleTextFormatChange = useCallback((id: string, format: TextFormat) => {
    setTextElements(prev =>
      prev.map(el => el.id === id ? { ...el, format } : el)
    );
  }, []);

  const handleTextSelect = useCallback((id: string) => {
    setSelectedTextId(id);
  }, []);

  const handleTextDragStart = useCallback(() => {
    setIsTextDragging(true);
  }, []);

  const handleTextDragEnd = useCallback(() => {
    setIsTextDragging(false);
  }, []);

  const handleTextDelete = useCallback((id: string) => {
    setTextElements(prev => prev.filter(el => el.id !== id));
    setSelectedTextId(previous => (previous === id ? null : previous));
  }, []);

  const handleCommentPositionChange = useCallback((id: string, x: number, y: number) => {
    setCommentElements(prev =>
      prev.map(el => el.id === id ? { ...el, x, y } : el)
    );
  }, []);

  const handleCommentSelect = useCallback((id: string) => {
    setSelectedCommentId(id);
    setSelectedTextId(null); // Deselect text when selecting comment
  }, []);

  const handleCommentToggleExpand = useCallback((id: string) => {
    setCommentElements(prev =>
      prev.map(el => el.id === id ? { ...el, isExpanded: !el.isExpanded } : el)
    );
  }, []);

  const handleCommentAdd = useCallback((commentId: string, content: string) => {
    const newComment: Comment = {
      id: `comment-${Date.now()}-${Math.random()}`,
      author: 'Carlos Saunders',
      authorInitials: 'CS',
      content: content,
      timestamp: new Date()
    };

    setCommentElements(prev =>
      prev.map(el =>
        el.id === commentId
          ? { ...el, comments: [...el.comments, newComment] }
          : el
      )
    );
  }, []);

  const handleCommentDelete = useCallback((id: string) => {
    setCommentElements(prev => prev.filter(el => el.id !== id));
    setSelectedCommentId(previous => (previous === id ? null : previous));
  }, []);

  const handleCommentDragStart = useCallback(() => {
    setIsCommentDragging(true);
  }, []);

  const handleCommentDragEnd = useCallback(() => {
    setIsCommentDragging(false);
  }, []);

  const handleMapNameUpdate = useCallback((oldName: string, newName: string) => {
    setExistingMaps(prev => prev.map(map => map === oldName ? newName : map));
    setCurrentMap(prev => (prev === oldName ? newName : prev));
  }, []);



  // Handle scroll wheel zoom with cursor focus
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!isCanvasLayout) {
      return;
    }
    event.preventDefault();

    const mapElement = mapRef.current;
    if (!mapElement) return;

    const rect = mapElement.getBoundingClientRect();
    const cursorX = event.clientX - rect.left - SIDEBAR_OFFSET;
    const cursorY = event.clientY - rect.top;

    setZoom(previousZoom => {
      const zoomDelta = event.deltaY < 0 ? ZOOM_WHEEL_STEP : -ZOOM_WHEEL_STEP;
      const nextZoom = clamp(previousZoom + zoomDelta, ZOOM_MIN, ZOOM_MAX);

      if (nextZoom === previousZoom) {
        return previousZoom;
      }

      setMapPosition(previousPosition => {
        const worldX = (cursorX - previousPosition.x) / (previousZoom / 100);
        const worldY = (cursorY - previousPosition.y) / (previousZoom / 100);

        const newWorldX = worldX * (nextZoom / 100);
        const newWorldY = worldY * (nextZoom / 100);

        return {
          x: cursorX - newWorldX,
          y: cursorY - newWorldY,
        };
      });

      return nextZoom;
    });
  }, [isCanvasLayout]);

  useEffect(() => {
    const mapElement = mapRef.current;
    if (!mapElement || !isCanvasLayout) return;

    mapElement.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      mapElement.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel, isCanvasLayout]);

  // Handle drag functionality - only right-click to avoid conflicts with text box resizing
  const isRightButton = (buttons: number) => buttons === 2;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isTextMode && e.button === 0) {
      // Create text element in text mode
      createTextElement(e.clientX, e.clientY);
      return;
    }

    if (isBoxMode && e.button === 0) {
      // Create box element in box mode
      createBoxElement(e.clientX, e.clientY);
      return;
    }

    if (isCommentMode && e.button === 0) {
      // Create comment element in comment mode
      createCommentElement(e.clientX, e.clientY);
      return;
    }

    if (e.button === 2) {
      // Only right mouse button for map dragging
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastDragPosition(mapPosition);
      clearSelections();
      e.preventDefault();
    } else if (e.button === 0) {
      // Left click just deselects text and comments, doesn't drag map
      clearSelections();
      setIsDragging(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      if (!isRightButton(e.buttons)) {
        setIsDragging(false);
        return;
      }

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      const newPosition = {
        x: lastDragPosition.x + deltaX,
        y: lastDragPosition.y + deltaY,
      };

      setMapPosition(newPosition);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        if (!isRightButton(e.buttons)) {
          setIsDragging(false);
          return;
        }

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        const newPosition = {
          x: lastDragPosition.x + deltaX,
          y: lastDragPosition.y + deltaY,
        };

        setMapPosition(newPosition);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected elements when Delete key is pressed
      if (e.key === 'Delete') {
        if (selectedTextId) {
          e.preventDefault();
          handleTextDelete(selectedTextId);
        } else if (selectedCommentId) {
          e.preventDefault();
          handleCommentDelete(selectedCommentId);
        }
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    dragStart,
    handleCommentDelete,
    handleTextDelete,
    isDragging,
    lastDragPosition,
    selectedCommentId,
    selectedTextId,
  ]);

  const gridOverlay = useMemo(() => {
    if (!showGrid || gridThickness <= 0) {
      return null;
    }

    const baseGridSize = 50;
    const zoomFactor = zoom / 100;
    let gridSize = baseGridSize;
    let gridOpacity = 0.3;

    if (zoomFactor > 4) {
      gridSize = baseGridSize / 4;
      gridOpacity = 0.2;
    } else if (zoomFactor > 2) {
      gridSize = baseGridSize / 2;
      gridOpacity = 0.25;
    } else if (zoomFactor < 0.3) {
      gridSize = baseGridSize * 4;
      gridOpacity = 0.4;
    } else if (zoomFactor < 0.7) {
      gridSize = baseGridSize * 2;
      gridOpacity = 0.35;
    }

    return (
      <div
        className="absolute pointer-events-none -z-10"
        style={{
          left: "-50000px",
          top: "-50000px",
          width: "100000px",
          height: "100000px",
          opacity: gridOpacity,
          backgroundImage: `
            linear-gradient(to right, var(--border) ${gridThickness}px, transparent ${gridThickness}px),
            linear-gradient(to bottom, var(--border) ${gridThickness}px, transparent ${gridThickness}px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: "0px 0px",
        }}
      />
    );
  }, [gridThickness, showGrid, zoom]);

  const textToolbar = useMemo(() => {
    if (
      selectedLayout === 'bubble-size' ||
      selectedLayout === 'activity-map' ||
      !selectedTextId ||
      isTextDragging ||
      isCommentDragging
    ) {
      return null;
    }

    const selectedElement = textElements.find(el => el.id === selectedTextId);
    if (!selectedElement) {
      return null;
    }

    return (
      <TextToolbar
        x={(selectedElement.x * zoom / 100) + mapPosition.x + SIDEBAR_OFFSET}
        y={(selectedElement.y * zoom / 100) + mapPosition.y}
        format={selectedElement.format}
        onFormatChange={(format) => handleTextFormatChange(selectedTextId, format)}
        onDelete={() => handleTextDelete(selectedTextId)}
        zoom={zoom}
      />
    );
  }, [
    handleTextDelete,
    handleTextFormatChange,
    isCommentDragging,
    isTextDragging,
    mapPosition,
    selectedLayout,
    selectedTextId,
    textElements,
    zoom,
  ]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-200 overflow-hidden">
      {/* Fixed UI Elements */}
      <Sidebar
        isDark={isDark}
        onToggleDark={toggleDarkMode}
        showGrid={showGrid}
        onToggleGrid={toggleGrid}
        gridThickness={gridThickness}
        onGridThicknessChange={handleGridThicknessChange}
        onCreateText={handleTextModeToggle}
        isTextMode={isTextMode}
        onCreateBox={handleCreateBox}
        onCenterMap={handleCenterMap}
        onCreateComment={handleCommentModeToggle}
        isCommentMode={isCommentMode}
        onLayoutSelect={handleLayoutSelect}
        selectedLayout={selectedLayout}
        onPaletteSelect={setSelectedPaletteId}
        selectedPaletteId={selectedPaletteId}
      />
      <RightSidebar
        isDark={isDark}
        onFolderDataChange={handleFolderDataChange}
        currentMap={currentMap}
        existingMaps={existingMaps}
        onMapChange={setCurrentMap}
        onMapNameUpdate={handleMapNameUpdate}
        onFolderActionsChange={handleFolderActionsChange}
      />
      <TopNavigation
        isDark={isDark}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenterMap={handleCenterMap}
        folderData={folderData}
      />

      {/* Map Area */}
      <div
        ref={mapRef}
        className={`fixed inset-0 ${
          isCanvasLayout ? "overflow-hidden" : "overflow-y-auto"
        } ${
          isCanvasLayout && (isTextMode || isBoxMode || isCommentMode)
            ? "cursor-crosshair"
            : isCanvasLayout && isDragging
              ? "cursor-grabbing"
              : "cursor-default"
        }`}
        style={{
          paddingLeft: `${SIDEBAR_OFFSET}px`, // Left sidebar width (48px + 16px margin)
          paddingRight: `${SIDEBAR_OFFSET}px`, // Right sidebar width (48px + 16px margin)
        }}
        onMouseDown={isCanvasLayout ? handleMouseDown : undefined}
        onMouseMove={isCanvasLayout ? handleMouseMove : undefined}
        onMouseUp={isCanvasLayout ? handleMouseUp : undefined}
        onContextMenu={event => {
          if (isCanvasLayout) {
            event.preventDefault();
          }
        }}
      >
        {isCanvasLayout ? (
          <div className="relative w-full h-full">
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${mapPosition.x}px, ${mapPosition.y}px) scale(${zoom / 100})`,
                transformOrigin: "0 0",
              }}
            >
              <div className="relative w-full h-full">
                {gridOverlay}

                {selectedLayout === 'bubble-size' && (
                  <BubbleSizeMap folders={folderData} colorPaletteId={selectedPaletteId} />
                )}
                {selectedLayout === 'orbital' && (
                  <OrbitalMap
                    folders={folderData}
                    colorPaletteId={selectedPaletteId}
                    onFolderSelectionChange={handleFolderSelectionChange}
                  />
                )}
                {selectedLayout === 'fox-three' && (
                  <FoxThreeMap folders={folderData} />
                )}
                {selectedLayout === 'radial-tree' && (
                  <RadialTreeMap folders={folderData} colorPaletteId={selectedPaletteId} />
                )}
                {selectedLayout === 'sun-burst' && (
                  <SunBurstMap folders={folderData} />
                )}

                {/* Text Elements */}
                {textElements.map(textElement => (
                  <TextBox
                    key={textElement.id}
                    id={textElement.id}
                    x={textElement.x}
                    y={textElement.y}
                    text={textElement.text}
                    format={textElement.format}
                    isSelected={selectedTextId === textElement.id}
                    zoom={zoom}
                    onTextChange={handleTextChange}
                    onPositionChange={handleTextPositionChange}
                    onFormatChange={handleTextFormatChange}
                    onSelect={handleTextSelect}
                    onDragStart={handleTextDragStart}
                    onDragEnd={handleTextDragEnd}
                  />
                ))}

                {/* Comment Elements */}
                {commentElements.map(commentElement => (
                  <CommentBox
                    key={commentElement.id}
                    id={commentElement.id}
                    x={commentElement.x}
                    y={commentElement.y}
                    comments={commentElement.comments}
                    isSelected={selectedCommentId === commentElement.id}
                    isExpanded={commentElement.isExpanded}
                    zoom={zoom}
                    onPositionChange={handleCommentPositionChange}
                    onSelect={handleCommentSelect}
                    onToggleExpand={handleCommentToggleExpand}
                    onAddComment={handleCommentAdd}
                    onDelete={handleCommentDelete}
                    onDragStart={handleCommentDragStart}
                    onDragEnd={handleCommentDragEnd}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full">
            <ActivityMap folders={folderData} />
          </div>
        )}
      </div>

      {/* Text Toolbar - only show when text is selected and not dragging */}
      {textToolbar}
    </div>
  );
}
