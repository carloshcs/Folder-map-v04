import React, { useState, useEffect, useRef } from "react";
import {
  Map,
  Palette,
  Square,
  Type,
  Undo,
  Sun,
  Moon,
  Circle,
  Grid3X3,
  Move,
  MessageCircle,
} from "lucide-react";
import Image from "next/image";
import { MenuItem } from "./MenuItem";
import { HorizontalSubmenu } from "./HorizontalSubmenu";
import { LayoutMenu } from "./LayoutMenu";
import { GridSliderSubmenu } from "./GridSliderSubmenu";
import PostItNote from "./svg/PostItNote";
import DialogueIcon from "./svg/DialogueIcon";
import Parallelogram from "./svg/Parallelogram";
import logoIcon from "../../../public/assets/folder-fox.png";
import { BOX_TYPES, BoxType } from "@/lib/mapTypes";

interface SidebarProps {
  isDark: boolean;
  onToggleDark: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  gridThickness: number;
  onGridThicknessChange: (thickness: number) => void;
  onCreateText: () => void;
  isTextMode: boolean;
  onCreateBox: (boxType: BoxType) => void;
  onCenterMap: () => void;
  onCreateComment: () => void;
  isCommentMode: boolean;
  onLayoutSelect: (layoutId: string) => void;
  selectedLayout: string | null;
  onPaletteSelect: (paletteId: string) => void;
  selectedPaletteId: string;
}

export function Sidebar({
  isDark,
  onToggleDark,
  showGrid,
  onToggleGrid,
  gridThickness,
  onGridThicknessChange,
  onCreateText,
  isTextMode,
  onCreateBox,
  onCenterMap,
  onCreateComment,
  isCommentMode,
  onLayoutSelect,
  selectedLayout,
  onPaletteSelect,
  selectedPaletteId,
}: SidebarProps) {
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [showLogoTooltip, setShowLogoTooltip] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const colorOptions = [
    {
      id: "system",
      label: "System",
      description: "Adapts to light or dark theme automatically",
      gradient: isDark
        ? "linear-gradient(90deg, #1f2937 0%, #334155 35%, #60a5fa 100%)"
        : "linear-gradient(90deg, #e0f2fe 0%, #bfdbfe 45%, #2563eb 100%)",
      previewColors: isDark
        ? ["#1f2937", "#334155", "#4c51bf", "#60a5fa", "#e0f2fe"]
        : ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "minimal",
      label: "Minimal",
      description: "Single-tone palette that follows your theme",
      gradient: isDark
        ? "linear-gradient(90deg, #0f172a 0%, #111827 100%)"
        : "linear-gradient(90deg, #ffffff 0%, #f8fafc 100%)",
      previewColors: isDark
        ? ["#111827", "#1f2937", "#111827", "#1f2937", "#111827"]
        : ["#ffffff", "#f8fafc", "#ffffff", "#f8fafc", "#ffffff"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "rainbow",
      label: "Rainbow",
      description: "Vibrant spectrum for standout maps",
      gradient: "linear-gradient(90deg, #ef4444 0%, #f97316 20%, #facc15 40%, #22c55e 60%, #3b82f6 80%, #a855f7 100%)",
      previewColors: ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "heatmap",
      label: "Heatmap",
      description: "From hot reds to cool blues",
      gradient: "linear-gradient(90deg, #b91c1c 0%, #f97316 45%, #60a5fa 80%, #1d4ed8 100%)",
      previewColors: ["#b91c1c", "#ef4444", "#f97316", "#60a5fa", "#2563eb", "#1d4ed8"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "slate",
      label: "Slate",
      description: "Minimal cool neutrals",
      gradient: "linear-gradient(90deg, #0f172a 0%, #1f2937 40%, #64748b 100%)",
      previewColors: ["#0f172a", "#1f2937", "#334155", "#475569", "#64748b"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "stone",
      label: "Stone",
      description: "Warm modern greys",
      gradient: "linear-gradient(90deg, #1f2933 0%, #52606d 45%, #d9e2ec 100%)",
      previewColors: ["#1f2933", "#323f4b", "#3e4c59", "#52606d", "#d9e2ec"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "forest",
      label: "Forest",
      description: "Earthy, muted greens",
      gradient: "linear-gradient(90deg, #0b3d2e 0%, #1f6f4a 50%, #95d5b2 100%)",
      previewColors: ["#0b3d2e", "#14553c", "#1f6f4a", "#2f8552", "#95d5b2"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "mist",
      label: "Mist",
      description: "Soft cool pastels",
      gradient: "linear-gradient(90deg, #1f2937 0%, #4c1d95 50%, #c7d2fe 100%)",
      previewColors: ["#312e81", "#4338ca", "#6366f1", "#a5b4fc", "#e0e7ff"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "blush",
      label: "Blush",
      description: "Understated rosy tones",
      gradient: "linear-gradient(90deg, #5b2333 0%, #9d4b73 50%, #f4c6d7 100%)",
      previewColors: ["#5b2333", "#7a2f4b", "#9d4b73", "#d783a6", "#f4c6d7"],
      variant: "color" as const,
      row: 0,
    },
    {
      id: "random",
      label: "Random colors",
      description: "Assigns unique hues to each branch",
      gradient:
        "linear-gradient(90deg, #ff6b6b 0%, #facc15 20%, #22c55e 40%, #3b82f6 60%, #a855f7 80%, #ec4899 100%)",
      previewColors: ["#ff6b6b", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"],
      variant: "color" as const,
      row: 0,
    },
  ];

  const shapeOptions = [
    { id: "box", label: "Box", icon: <Square size={16} />, description: "Basic rectangular box" },
    { id: "circle", label: "Circle", icon: <Circle size={16} />, description: "Circular shape" },
    {
      id: "parallelogram",
      label: "Parallelogram",
      icon: (
        <Parallelogram
          width={12}
          height={16}
          slant={4}
          fillColor="transparent"
          strokeColor="currentColor"
          strokeWidth={1.5}
        />
      ),
      description: "Parallelogram sticky note",
    },
    {
      id: "dialogue",
      label: "Dialogue",
      icon: (
        <DialogueIcon
          width={16}
          height={16}
          fillColor="transparent"
          strokeColor="currentColor"
          strokeWidth={1.5}
        />
      ),
      description: "Speech bubble with tail",
    },
    {
      id: "postit",
      label: "Post-it",
      icon: (
        <PostItNote
          width={16}
          height={16}
          noteColor="#fef08a"
          withShadow={false}
          foldSize={4}
          radius={2}
        />
      ),
      description: "Post-it note with pin",
    },
  ] satisfies Array<{ id: BoxType; label: string; icon: React.ReactNode; description: string }>;

  const toggleSubmenu = (submenu: string) => {
    if (activeSubmenu !== submenu) {
      setActiveSubmenu(submenu);
      if (isTextMode) {
        onCreateText(); // deactivate text mode when opening another submenu
      }
    } else {
      setActiveSubmenu(null);
    }
  };

  const handleOptionSelect = (optionId: string) => {
    if (activeSubmenu === "shapes") {
      if (BOX_TYPES.includes(optionId as BoxType)) {
        onCreateBox(optionId as BoxType);
      }
    }
    if (activeSubmenu === "layout") {
      onLayoutSelect(optionId);
    }
    if (activeSubmenu === "colors") {
      onPaletteSelect(optionId);
    }
    setActiveSubmenu(null);
  };

  const handleGridThicknessSliderChange = (value: number) => {
    onGridThicknessChange(value);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setActiveSubmenu(null);
      }
    };

    if (activeSubmenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeSubmenu]);

  return (
    <div
      ref={sidebarRef}
      className="fixed left-4 top-4 bottom-4 w-12 
                 bg-white dark:bg-neutral-900 
                 border border-border rounded-xl shadow-lg 
                 flex flex-col z-40"
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-border">
        <div
          className="relative"
          onMouseEnter={() => setShowLogoTooltip(true)}
          onMouseLeave={() => setShowLogoTooltip(false)}
        >
          <button className="cursor-pointer w-10 h-10 flex items-center justify-center">
            <Image
              src={logoIcon}
              alt="Logo"
              width={40}
              height={40}
              className="w-9 h-9 object-contain"
              priority
            />
          </button>

          {/* Tooltip */}
          {showLogoTooltip && (
            <div
              className="absolute left-full top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-50"
              style={{ marginLeft: "16px" }}
            >
              <div
                className="w-3 h-3 bg-primary rotate-45 -mr-[6px] z-10"
                style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)" }}
              />
              <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs whitespace-nowrap shadow-lg animate-in fade-in-0 slide-in-from-left-2 duration-200">
                Go to dashboard
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 flex flex-col items-center py-4 gap-2">
        <MenuItem icon={Move} tooltip="Center map" onClick={onCenterMap} />

        <div className="relative">
          <MenuItem
            icon={Map}
            tooltip="Choose layout"
            onClick={() => toggleSubmenu("layout")}
            isActive={activeSubmenu === "layout"}
          />
          <LayoutMenu
            isOpen={activeSubmenu === "layout"}
            onSelect={handleOptionSelect}
            selectedLayout={selectedLayout}
          />
        </div>

        <div className="relative">
          <MenuItem
            icon={Palette}
            tooltip="Color palette"
            onClick={() => toggleSubmenu("colors")}
            isActive={activeSubmenu === "colors"}
          />
          <HorizontalSubmenu
            isOpen={activeSubmenu === "colors"}
            options={colorOptions}
            onSelect={handleOptionSelect}
            selectedOptionId={selectedPaletteId}
            className="w-[280px]"
            rowClassName={() => "flex w-full flex-col gap-2"}
            itemClassName="w-full"
          />
        </div>

        <div className="relative">
          <MenuItem
            icon={Square}
            tooltip="Create box"
            onClick={() => toggleSubmenu("shapes")}
            isActive={activeSubmenu === "shapes"}
          />
          <HorizontalSubmenu
            isOpen={activeSubmenu === "shapes"}
            options={shapeOptions}
            onSelect={handleOptionSelect}
          />
        </div>

        <MenuItem
          icon={Type}
          tooltip={isTextMode ? "Exit text mode" : "Create text"}
          onClick={() => {
            if (!isTextMode) setActiveSubmenu(null);
            onCreateText();
          }}
          isActive={isTextMode}
        />

        <MenuItem
          icon={MessageCircle}
          tooltip={isCommentMode ? "Exit comment mode" : "Create comment"}
          onClick={() => {
            if (!isCommentMode) setActiveSubmenu(null);
            onCreateComment();
          }}
          isActive={isCommentMode}
        />
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-2 p-4 border-t border-border">
        <MenuItem icon={Undo} tooltip="Undo" onClick={() => console.log("Undo")} />

        <div className="relative">
          <MenuItem
            icon={Grid3X3}
            tooltip={showGrid ? "Grid settings" : "Show grid"}
            onClick={() => {
              if (!showGrid) {
                onToggleGrid();
              } else {
                toggleSubmenu("grid");
              }
            }}
            isActive={activeSubmenu === "grid"}
          />
          {showGrid && (
            <GridSliderSubmenu
              isOpen={activeSubmenu === "grid"}
              value={gridThickness}
              onValueChange={handleGridThicknessSliderChange}
            />
          )}
        </div>

        <MenuItem
          icon={isDark ? Sun : Moon}
          tooltip={isDark ? "Light mode" : "Dark mode"}
          onClick={onToggleDark}
        />
      </div>
    </div>
  );
}
